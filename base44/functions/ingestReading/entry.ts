import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { SENSOR_DEFS, asList, validateSensorValue } from '../../shared/agronomy.ts';
import { writeAudit, deviceActor } from '../../shared/audit.ts';

// Authenticated ingestion endpoint for physical devices (ESP32 / ESP8266 over HTTPS).
// The device never holds a user session: it presents a shared ingest token that is compared
// with the IOT_INGEST_TOKEN secret, which exists only on the server.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let expectedToken = null;
    try {
      expectedToken = secrets.get('IOT_INGEST_TOKEN');
    } catch (secretError) {
      expectedToken = null;
    }
    if (!expectedToken) {
      return Response.json(
        {
          status: 'configuration_missing',
          error:
            'Device ingestion is not configured: no IOT_INGEST_TOKEN secret is set for this app. Add it in the dashboard environment variables before pointing a device here.',
        },
        { status: 503 }
      );
    }

    const presented = String(payload.device_token || '');
    if (!presented || presented !== expectedToken) {
      return Response.json({ status: 'unauthorized', error: 'Invalid or missing device token.' }, { status: 401 });
    }

    const deviceId = String(payload.device_id || '').trim();
    const sensorType = String(payload.sensor_type || '').trim();
    const value = typeof payload.value === 'string' ? Number(payload.value) : payload.value;
    const recordedAt = payload.recorded_at ? new Date(payload.recorded_at) : new Date();

    if (!deviceId) {
      return Response.json({ status: 'validation_error', error: 'device_id is required.' }, { status: 400 });
    }
    if (!SENSOR_DEFS[sensorType]) {
      return Response.json(
        { status: 'validation_error', error: `sensor_type must be one of: ${Object.keys(SENSOR_DEFS).join(', ')}` },
        { status: 400 }
      );
    }
    const valueCheck = validateSensorValue(sensorType, value);
    if (!valueCheck.ok) {
      return Response.json({ status: 'validation_error', error: valueCheck.error }, { status: 422 });
    }
    if (Number.isNaN(recordedAt.getTime())) {
      return Response.json({ status: 'validation_error', error: 'recorded_at must be an ISO 8601 timestamp.' }, { status: 400 });
    }

    const devices = asList(await base44.asServiceRole.entities.Device.filter({ device_id: deviceId }, { limit: 1 }));
    if (!devices.length) {
      return Response.json(
        { status: 'unknown_device', error: `Device "${deviceId}" is not registered in this app. Register it first.` },
        { status: 404 }
      );
    }
    const device = devices[0];
    const supported = Array.isArray(device.sensor_types) ? device.sensor_types : [];
    if (supported.length && !supported.includes(sensorType)) {
      return Response.json(
        {
          status: 'validation_error',
          error: `Device "${deviceId}" is registered for ${supported.join(', ')} and not for ${sensorType}.`,
        },
        { status: 422 }
      );
    }

    const farm = await base44.asServiceRole.entities.Farm.get(device.farm_id).catch(() => null);
    if (!farm) {
      return Response.json(
        { status: 'validation_error', error: `Device "${deviceId}" points at a farm that no longer exists.` },
        { status: 422 }
      );
    }

    const reading = await base44.asServiceRole.entities.SensorReading.create({
      device_id: deviceId,
      farm_id: device.farm_id,
      farm_name: farm.name,
      sensor_type: sensorType,
      value,
      unit: SENSOR_DEFS[sensorType].unit,
      recorded_at: recordedAt.toISOString(),
      source: 'device_ingest',
      validation_status: 'valid',
      notes: 'Received from a physical device through the authenticated ingestion endpoint.',
    });

    await base44.asServiceRole.entities.Device.update(device.id, {
      status: 'active',
      last_reading_at: recordedAt.toISOString(),
      ingestion_method: device.ingestion_method === 'mqtt_planned' ? 'http_ingest' : device.ingestion_method,
    });

    await writeAudit(base44, {
      ...deviceActor(deviceId),
      action: 'reading_ingested',
      summary: `Reading posted by ${deviceId}: ${SENSOR_DEFS[sensorType].label} ${value} at ${farm.name}`,
      entity_name: 'SensorReading',
      record_id: reading.id,
      record_label: `${deviceId} · ${SENSOR_DEFS[sensorType].label}`,
      farm_id: device.farm_id,
      farm_name: farm.name,
      detail:
        'Received through the authenticated ingestion endpoint and stored as a device reading, never as a simulation. The device status was refreshed at the same time.',
    });

    return Response.json({
      status: 'accepted',
      reading_id: reading.id,
      device_id: deviceId,
      farm_id: device.farm_id,
      sensor_type: sensorType,
      unit: SENSOR_DEFS[sensorType].unit,
      source: 'device_ingest',
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}