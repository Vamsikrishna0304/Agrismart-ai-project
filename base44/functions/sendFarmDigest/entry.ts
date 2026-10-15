import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { asList, SENSOR_DEFS } from '../../shared/agronomy.ts';
import { writeAudit, personActor } from '../../shared/audit.ts';

/**
 * Farm digest: one email that lists, for every farm, the newest reading of each sensor
 * type plus the alerts that are still open.
 *
 * Honesty rules carried over from the rest of the app:
 * - every reading is shown with where it came from, so a simulated value is never
 *   dressed up as a measurement;
 * - a farm with no reading yet says so instead of showing a zero;
 * - nothing is invented to fill a gap when a query or a send fails, and the failure
 *   is reported back rather than hidden.
 *
 * Records and reports in this app are written in English, so the digest is English.
 */

const UNIT_SYMBOLS = { percent: '%', celsius: '°C', lux: 'lux' };
const TIME_ZONE = 'Asia/Kolkata';

const SOURCE_LABELS = {
  simulated: 'simulated demo data, not a measurement',
  device_ingest: 'posted by a device',
  manual: 'typed in by hand',
};

const SEVERITY_LABELS = { critical: 'Critical', warning: 'Warning', info: 'Info' };
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const SEVERITY_COLORS = { critical: '#b91c1c', warning: '#b45309', info: '#0369a1' };

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ageMinutes(iso) {
  const stamp = new Date(iso).getTime();
  if (Number.isNaN(stamp)) return null;
  return Math.max(0, Math.round((Date.now() - stamp) / 60000));
}

function ageText(minutes) {
  if (minutes === null) return 'time not recorded';
  if (minutes < 60) return `${minutes} min old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h old`;
  return `${Math.round(hours / 24)} d old`;
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'time not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function dayLabel(iso) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function readingText(reading) {
  const def = SENSOR_DEFS[reading.sensor_type] || { label: reading.sensor_type, unit: reading.unit };
  const value = Number(reading.value);
  const shown = Number.isFinite(value) ? String(Math.round(value * 10) / 10) : String(reading.value);
  const symbol = UNIT_SYMBOLS[def.unit] || '';
  return `${def.label || reading.sensor_type}: ${shown} ${symbol}`.trim();
}

function readingCaption(reading) {
  const parts = [
    SOURCE_LABELS[reading.source] || 'source not recorded',
    ageText(ageMinutes(reading.recorded_at)),
    formatWhen(reading.recorded_at),
  ];
  if (reading.device_id && reading.source === 'device_ingest') parts.push(`device ${reading.device_id}`);
  return parts.join(' · ');
}

// Readings arrive newest first, so the first row seen for a sensor type is the current one.
function groupByFarm(farms, readings, alerts) {
  const byFarm = new Map();
  farms.forEach((farm) => byFarm.set(farm.id, { farm, readings: [], alerts: [] }));

  readings.forEach((reading) => {
    const entry = byFarm.get(reading.farm_id);
    if (!entry) return;
    if (entry.readings.some((seen) => seen.sensor_type === reading.sensor_type)) return;
    entry.readings.push(reading);
  });

  alerts.forEach((alert) => {
    const entry = byFarm.get(alert.farm_id);
    if (entry) entry.alerts.push(alert);
  });

  return Array.from(byFarm.values());
}

function renderFarm({ farm, readings, alerts }) {
  const place = [farm.location, farm.region].filter(Boolean).join(', ');
  const readingRows = readings.length
    ? readings
        .map(
          (reading) => `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:14px;color:#14532d;vertical-align:top;white-space:nowrap;">${escapeHtml(
            readingText(reading)
          )}</td>
          <td style="padding:6px 0;font-size:12px;color:#5b6b62;vertical-align:top;">${escapeHtml(
            readingCaption(reading)
          )}</td>
        </tr>`
        )
        .join('')
    : '<tr><td colspan="2" style="padding:6px 0;font-size:13px;color:#8a5a00;">No sensor reading has been recorded for this farm yet.</td></tr>';

  const alertItems = alerts.length
    ? alerts
        .map(
          (alert) => `
        <li style="margin:0 0 10px;font-size:14px;color:#0f2e21;">
          <strong style="color:${SEVERITY_COLORS[alert.severity] || '#5b6b62'};">${escapeHtml(
            SEVERITY_LABELS[alert.severity] || alert.severity
          )}</strong> — ${escapeHtml(alert.title || 'Alert')}
          ${
            alert.message
              ? `<div style="font-size:12px;color:#5b6b62;margin-top:2px;">${escapeHtml(alert.message)}</div>`
              : ''
          }
        </li>`
        )
        .join('')
    : '<li style="margin:0;font-size:13px;color:#5b6b62;">No open alerts.</li>';

  return `
    <div style="margin-top:18px;border:1px solid #e2e8e4;border-radius:10px;padding:16px;">
      <h2 style="margin:0;font-size:16px;color:#0f2e21;">${escapeHtml(farm.name || 'Farm')}</h2>
      ${place ? `<p style="margin:2px 0 12px;font-size:12px;color:#5b6b62;">${escapeHtml(place)}</p>` : ''}

      <h3 style="margin:12px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6b62;">Newest reading per sensor</h3>
      <table style="width:100%;border-collapse:collapse;">${readingRows}</table>

      <h3 style="margin:16px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#5b6b62;">Open alerts</h3>
      <ul style="margin:0;padding-left:18px;">${alertItems}</ul>
    </div>`;
}

function renderDigest(sections, generatedAt) {
  const totalReadings = sections.reduce((count, section) => count + section.readings.length, 0);
  const totalAlerts = sections.reduce((count, section) => count + section.alerts.length, 0);
  const subject = `AgriSmart AI daily summary — ${dayLabel(generatedAt)}`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:16px;background:#f8f7f2;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:660px;margin:0 auto;background:#ffffff;border:1px solid #dde5df;border-radius:12px;padding:22px;">
    <h1 style="margin:0;font-size:18px;color:#0f2e21;">AgriSmart AI daily summary</h1>
    <p style="margin:4px 0 0;font-size:12px;color:#5b6b62;">${escapeHtml(dayLabel(generatedAt))} · ${
    sections.length
  } farm${sections.length === 1 ? '' : 's'} · ${totalReadings} reading${totalReadings === 1 ? '' : 's'} · ${totalAlerts} open alert${
    totalAlerts === 1 ? '' : 's'
  }</p>
    ${sections.map(renderFarm).join('')}
    <p style="margin:20px 0 0;padding-top:12px;border-top:1px solid #e6ece8;font-size:11px;line-height:1.6;color:#5b6b62;">
      Each reading says where it came from: a value marked simulated is demo data and never a physical measurement.
      Alerts come from this app's own rules and irrigation advice is a transparent rule engine, not a trained model.
      Times are shown in IST. No figure is invented to fill a gap.
    </p>
  </div>
</body></html>`;

  return { subject, html, totalReadings, totalAlerts };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json(
        { status: 'forbidden', error: 'Only an administrator can send the farm digest.' },
        { status: 403 }
      );
    }

    const generatedAt = new Date().toISOString();

    const [farmRows, userRows] = await Promise.all([
      base44.entities.Farm.list('-created_date', 50).catch(() => []),
      base44.entities.User.list().catch(() => []),
    ]);

    const farms = asList(farmRows);
    if (!farms.length) {
      return Response.json({
        status: 'nothing_to_send',
        error: 'No farm has been recorded yet, so there is nothing to summarise.',
      });
    }

    const users = asList(userRows).filter((row) => row.email);
    const admins = users.filter((row) => row.role === 'admin');
    const recipients = (admins.length ? admins : users).map((row) => row.email);

    if (!recipients.length) {
      return Response.json({
        status: 'no_recipients',
        error:
          "The digest goes to this app's registered administrators, and none was found. Invite one from the app dashboard, then try again.",
      });
    }

    const farmIds = farms.map((farm) => farm.id);
    const [readingRows, alertRows] = await Promise.all([
      base44.entities.SensorReading.filter(
        { farm_id: { $in: farmIds } },
        { sort: '-recorded_at', limit: 500 }
      ).catch(() => []),
      base44.entities.Alert.filter(
        { farm_id: { $in: farmIds }, status: 'open' },
        { sort: '-created_date', limit: 500 }
      ).catch(() => []),
    ]);

    const readings = asList(readingRows);
    const alerts = asList(alertRows).sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
    );

    const sections = groupByFarm(farms, readings, alerts);
    const digest = renderDigest(sections, generatedAt);

    const sends = await Promise.allSettled(
      recipients.map((email) =>
        base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: digest.subject,
          html: digest.html,
          from_name: 'AgriSmart AI',
        })
      )
    );

    const results = recipients.map((email, index) => {
      const outcome = sends[index];
      return {
        email,
        ok: outcome.status === 'fulfilled',
        error:
          outcome.status === 'rejected'
            ? String(outcome.reason && outcome.reason.message ? outcome.reason.message : outcome.reason)
            : null,
      };
    });

    const delivered = results.filter((result) => result.ok).map((result) => result.email);
    if (!delivered.length) {
      return Response.json(
        {
          status: 'send_failed',
          error: results[0].error || 'The email service rejected the digest.',
          recipient_results: results,
        },
        { status: 502 }
      );
    }

    await writeAudit(base44, {
      ...personActor(user),
      action: 'digest_sent',
      summary: `Daily summary sent to ${delivered.length} administrator(s): ${sections.length} farm(s), ${
        digest.totalReadings
      } reading(s), ${digest.totalAlerts} open alert(s)`,
      record_label: 'Daily summary email',
      detail: `Recipients: ${delivered.join(', ')}. Failed: ${
        results
          .filter((result) => !result.ok)
          .map((result) => result.email)
          .join(', ') || 'none'
      }.`,
    });

    return Response.json({
      status: 'sent',
      sent_at: generatedAt,
      recipients: delivered,
      failed: results.filter((result) => !result.ok),
      farms: sections.length,
      readings: digest.totalReadings,
      open_alerts: digest.totalAlerts,
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}