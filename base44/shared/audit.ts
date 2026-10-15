// One place that writes the audit trail, so every backend engine records what it did
// in the same shape.
//
// HONESTY CONTRACT
// - An entry states what the app knows about the actor: a signed-in account, a device
//   that presented the ingestion token, or the app's own engine when it acted on its
//   own (a simulation, a scheduled digest). It never guesses a person's name.
// - Logging must never break the action it describes, so a failed write returns null
//   and is reported in the function log instead of failing the request.
//
// The console reads this entity back; nothing in the app edits or deletes entries.

export const AUDIT_ACTIONS = [
  'record_created',
  'record_updated',
  'record_deleted',
  'reading_ingested',
  'readings_simulated',
  'device_checked',
  'alert_raised',
  'irrigation_decided',
  'crop_recommended',
  'disease_analysed',
  'assistant_asked',
  'digest_sent',
];

const LIMITS = { summary: 400, changes: 700, label: 120, detail: 500 };

// Fields that describe the record itself rather than a value a person chose, so a
// change log stays about what actually changed.
const SKIP_FIELDS = new Set([
  'id',
  'created_date',
  'updated_date',
  'created_by_id',
  'created_by',
  'farm_id',
  'farm_name',
]);

function clip(value, limit) {
  const text = String(value === null || value === undefined ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function plain(value) {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'object') return clip(JSON.stringify(value), 60);
  return clip(value, 60);
}

/** "field: before → after" for the fields that actually changed. */
export function describeChanges(before, after) {
  if (!before || !after) return '';
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const parts = [];
  keys.forEach((key) => {
    if (SKIP_FIELDS.has(key)) return;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return;
    parts.push(`${key}: ${plain(before[key])} → ${plain(after[key])}`);
  });
  return parts.join('; ');
}

/** The app's own engine acted — an irrigation rule, a simulation, the digest sender. */
export function systemActor(label) {
  return { actor_type: 'system', actor_label: label, channel: 'backend_function' };
}

/** A physical node posted through the authenticated ingestion endpoint. */
export function deviceActor(deviceId) {
  return { actor_type: 'device', actor_label: `Device ${deviceId}`, channel: 'device_endpoint' };
}

/**
 * A person who used the app. `user` is what base44.auth.me() returned, which is null
 * when the app is in public mode and nobody is signed in — that is recorded as an
 * anonymous visitor rather than attributed to anyone.
 */
export function personActor(user, channel = 'backend_function') {
  if (!user) {
    return {
      actor_type: 'anonymous_visitor',
      actor_label: 'Anonymous visitor (app is public, no sign-in)',
      channel,
    };
  }
  return {
    actor_type: 'signed_in_user',
    actor_label: user.full_name || user.email || 'Signed-in user',
    actor_email: user.email || undefined,
    channel,
  };
}

export async function writeAudit(base44, entry) {
  try {
    return await base44.entities.AuditLog.create({
      action: entry.action,
      summary: clip(entry.summary, LIMITS.summary),
      changes: entry.changes ? clip(entry.changes, LIMITS.changes) : undefined,
      entity_name: entry.entity_name || undefined,
      record_id: entry.record_id || undefined,
      record_label: entry.record_label ? clip(entry.record_label, LIMITS.label) : undefined,
      actor_type: entry.actor_type || 'system',
      actor_label: clip(entry.actor_label || 'App system', LIMITS.label),
      actor_email: entry.actor_email || undefined,
      channel: entry.channel || 'backend_function',
      farm_id: entry.farm_id || undefined,
      farm_name: entry.farm_name || undefined,
      detail: entry.detail ? clip(entry.detail, LIMITS.detail) : undefined,
    });
  } catch (error) {
    console.log('audit_write_failed', entry && entry.action, error && error.message);
    return null;
  }
}