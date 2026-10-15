import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { asList, readingAgeMinutes } from '../../shared/agronomy.ts';
import { writeAudit, personActor } from '../../shared/audit.ts';

// Detects stale readings and disconnected devices. It never rewrites history and never
// presents an old value as a current field condition: it marks the device offline and
// raises one open alert per device (no duplicates while an alert is still open).

const STALE_MINUTES = 360;
const SOURCE = 'device-health-check';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    const farmId = payload.farm_id ? String(payload.farm_id) : null;

    const devices = asList(await base44.entities.Device.filter(farmId ? { farm_id: farmId } : {}, { limit: 100 }));
    if (!devices.length) {
      return Response.json({
        status: 'no_devices',
        checked: 0,
        stale: [],
        alerts_created: 0,
        message: 'No sensor devices are registered yet, so there was nothing to check.',
      });
    }

    const openAlerts = asList(
      await base44.entities.Alert.filter({ status: { $ne: 'resolved' }, source: SOURCE }, { limit: 200 })
    );
    const alreadyAlerted = new Set(openAlerts.map((alert) => alert.related_id));

    const stale = [];
    let created = 0;

    for (const device of devices) {
      const ageMinutes = device.last_reading_at ? readingAgeMinutes(device.last_reading_at) : null;
      const isStale = ageMinutes === null || ageMinutes > STALE_MINUTES;
      const nextStatus = isStale ? 'offline' : 'active';

      if (device.status !== nextStatus) {
        await base44.entities.Device.update(device.id, { status: nextStatus });
      }

      if (!isStale) continue;

      stale.push({
        device_id: device.device_id,
        farm_name: device.farm_name || '',
        last_reading_at: device.last_reading_at || null,
        age_minutes: ageMinutes,
      });

      if (alreadyAlerted.has(device.id)) continue;

      await base44.entities.Alert.create({
        farm_id: device.farm_id,
        farm_name: device.farm_name || '',
        severity: device.last_reading_at ? 'warning' : 'info',
        title: device.last_reading_at
          ? `${device.device_id} has stopped reporting`
          : `${device.device_id} has never sent a reading`,
        message: device.last_reading_at
          ? `Its newest reading is ${ageMinutes} minutes old, past the ${STALE_MINUTES}-minute freshness limit. Values from this device are shown as stale and are not treated as current field conditions.`
          : 'The device is registered but has not posted anything yet, so no reading from it can be trusted as current.',
        source: SOURCE,
        related_type: 'Device',
        related_id: device.id,
        status: 'open',
      });
      created += 1;
    }

    await writeAudit(base44, {
      ...personActor(user),
      action: 'device_checked',
      summary: `Device check: ${devices.length} checked, ${stale.length} with stale or missing readings, ${created} alert(s) raised`,
      entity_name: 'Device',
      record_label: `${devices.length} device(s)`,
      detail: stale.length
        ? `Stale or silent devices: ${stale
            .map((item) => item.device_id)
            .slice(0, 8)
            .join(', ')}`
        : 'Every device reported inside the freshness limit.',
    });

    if (created > 0) {
      await writeAudit(base44, {
        ...personActor(user),
        action: 'alert_raised',
        summary: `${created} device alert(s) raised`,
        entity_name: 'Alert',
        record_label: 'Device staleness',
        detail: `Raised by ${SOURCE}: one open alert per device that stopped reporting or has never reported a reading.`,
      });
    }

    return Response.json({
      status: 'ok',
      checked: devices.length,
      stale_minutes: STALE_MINUTES,
      stale,
      alerts_created: created,
      message: stale.length
        ? `${stale.length} of ${devices.length} device(s) have stale or missing readings.`
        : `All ${devices.length} device(s) have reported within the last ${STALE_MINUTES} minutes.`,
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}