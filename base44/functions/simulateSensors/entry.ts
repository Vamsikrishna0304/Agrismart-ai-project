import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { SIM_MODEL_ID, SIM_LABEL, SENSOR_DEFS, asList, simulateSensorSeries } from '../../shared/agronomy.ts';
import { writeAudit, personActor } from '../../shared/audit.ts';

const MAX_RECORDS = 500;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    const user = await base44.auth.me().catch(() => null);
    const farmId = String(payload.farm_id || '').trim();
    if (!farmId) {
      return Response.json({ status: 'validation_error', error: 'Select a farm to simulate readings for.' }, { status: 400 });
    }

    const hours = Math.min(72, Math.max(1, Number(payload.hours) || 24));
    const intervalMinutes = Math.max(15, Number(payload.interval_minutes) || 60);

    const farm = await base44.entities.Farm.get(farmId).catch(() => null);
    if (!farm) {
      return Response.json({ status: 'validation_error', error: 'That farm could not be found.' }, { status: 404 });
    }

    const deviceQuery = payload.device_id ? { farm_id: farmId, device_id: payload.device_id } : { farm_id: farmId };
    const devices = asList(await base44.entities.Device.filter(deviceQuery, { limit: 20 }));

    if (!devices.length) {
      return Response.json(
        { status: 'no_devices', error: 'No sensor devices are registered for this farm yet. Add a device first.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const perPoint = Math.max(1, Math.ceil((hours * 60) / intervalMinutes));
    const records = [];
    const touched = [];

    for (const device of devices) {
      const sensorTypes = Array.isArray(device.sensor_types) ? device.sensor_types : [];
      for (const sensorType of sensorTypes) {
        if (!SENSOR_DEFS[sensorType]) continue;
        const series = simulateSensorSeries({
          sensor_type: sensorType,
          hours,
          interval_minutes: intervalMinutes,
          now,
          soil_type: farm.soil_type || 'loamy',
          irrigation_type: farm.irrigation_type || 'rainfed',
          device_id: device.device_id,
        });
        for (const point of series) {
          if (records.length >= MAX_RECORDS) break;
          records.push({
            device_id: device.device_id,
            farm_id: farmId,
            farm_name: farm.name,
            sensor_type: sensorType,
            value: point.value,
            unit: SENSOR_DEFS[sensorType].unit,
            recorded_at: point.recorded_at,
            source: 'simulated',
            validation_status: 'valid',
            notes: SIM_LABEL,
          });
        }
      }
      touched.push(device);
    }

    if (!records.length) {
      return Response.json(
        { status: 'no_sensors', error: 'The registered devices have no supported sensor types, so nothing was simulated.' },
        { status: 400 }
      );
    }

    await base44.entities.SensorReading.bulkCreate(records);

    await Promise.all(
      touched.map((device) =>
        base44.entities.Device.update(device.id, {
          status: 'active',
          last_reading_at: now.toISOString(),
        })
      )
    );

    await writeAudit(base44, {
      ...personActor(user),
      action: 'readings_simulated',
      summary: `Simulated ${records.length} readings for ${farm.name} across ${touched.length} device(s)`,
      entity_name: 'SensorReading',
      record_label: `${farm.name} · simulated series`,
      farm_id: farmId,
      farm_name: farm.name,
      detail: `${SIM_LABEL} Model ${SIM_MODEL_ID}, ${hours} h at ${intervalMinutes}-minute intervals.`,
    });

    return Response.json({
      status: 'ok',
      created: records.length,
      devices: touched.map((d) => d.device_id),
      hours,
      interval_minutes: intervalMinutes,
      points_per_sensor: perPoint,
      model_id: SIM_MODEL_ID,
      label: SIM_LABEL,
      source: 'simulated',
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}