import { base44 } from "@/api/base44Client";

/**
 * Audit trail for actions taken in the interface.
 *
 * An entry records what changed, on which record, and who the app knows acted. When
 * nobody is signed in on this public app, the actor is recorded as an anonymous
 * visitor instead of being attributed to a person. Entries are appended only — the
 * console reads them back and nothing here edits or deletes them.
 *
 * A failed audit write must never break the change it describes, so failures are
 * swallowed here rather than surfaced to the user.
 */

let actorPromise = null;

function anonymousActor() {
  return {
    actor_type: "anonymous_visitor",
    actor_label: "Anonymous visitor (app is public, no sign-in)",
    actor_email: undefined,
  };
}

function loadActor() {
  if (!actorPromise) {
    actorPromise = base44.auth
      .me()
      .then((user) =>
        user
          ? {
              actor_type: "signed_in_user",
              actor_label: user.full_name || user.email || "Signed-in user",
              actor_email: user.email || undefined,
            }
          : anonymousActor()
      )
      .catch(() => anonymousActor());
  }
  return actorPromise;
}

const SKIP_FIELDS = new Set([
  "id",
  "created_date",
  "updated_date",
  "created_by_id",
  "created_by",
  "farm_id",
  "farm_name",
]);

function clip(value, limit) {
  const text = String(value === null || value === undefined ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function plain(value) {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "object") return clip(JSON.stringify(value), 60);
  return clip(value, 60);
}

/** "field: before → after" for the fields that actually changed. */
export function describeChanges(before, after) {
  if (!before || !after) return "";
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const parts = [];
  keys.forEach((key) => {
    if (SKIP_FIELDS.has(key)) return;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return;
    parts.push(`${key}: ${plain(before[key])} → ${plain(after[key])}`);
  });
  return parts.join("; ");
}

export function recordLabel(entityName, record) {
  if (!record) return entityName;
  const candidate =
    record.name ||
    record.title ||
    record.crop_name ||
    record.device_id ||
    record.conversation_title ||
    record.farm_name;
  return candidate ? String(candidate) : entityName;
}

export async function logAudit(entry) {
  try {
    const actor = await loadActor();
    await base44.entities.AuditLog.create({
      action: entry.action,
      summary: clip(entry.summary, 400),
      changes: entry.changes ? clip(entry.changes, 700) : undefined,
      entity_name: entry.entity_name || undefined,
      record_id: entry.record_id || undefined,
      record_label: entry.record_label ? clip(entry.record_label, 120) : undefined,
      actor_type: entry.actor_type || actor.actor_type,
      actor_label: entry.actor_label || actor.actor_label,
      actor_email: entry.actor_email || actor.actor_email,
      channel: "app_interface",
      farm_id: entry.farm_id || undefined,
      farm_name: entry.farm_name || undefined,
      detail: entry.detail ? clip(entry.detail, 500) : undefined,
    });
  } catch (error) {
    // Never break the change the entry describes.
  }
}

export async function auditedCreate(entityName, data, context = {}) {
  const created = await base44.entities[entityName].create(data);
  const label = recordLabel(entityName, created);
  await logAudit({
    action: "record_created",
    entity_name: entityName,
    record_id: created.id,
    record_label: label,
    summary: `Added ${entityName} record: ${label}`,
    farm_id: context.farm_id || created.farm_id,
    farm_name: context.farm_name || created.farm_name,
    detail: context.detail,
  });
  return created;
}

export async function auditedUpdate(entityName, id, data, before, context = {}) {
  const updated = await base44.entities[entityName].update(id, data);
  const label = recordLabel(entityName, updated || before);
  const changes = describeChanges(before, { ...before, ...data });
  await logAudit({
    action: "record_updated",
    entity_name: entityName,
    record_id: id,
    record_label: label,
    summary: `Changed ${entityName} record: ${label}`,
    changes: changes || "No field value changed.",
    farm_id: context.farm_id || (updated && updated.farm_id) || (before && before.farm_id),
    farm_name: context.farm_name || (updated && updated.farm_name) || (before && before.farm_name),
    detail: context.detail,
  });
  return updated;
}

export async function auditedDelete(entityName, id, before, context = {}) {
  const result = await base44.entities[entityName].delete(id);
  const label = recordLabel(entityName, before);
  await logAudit({
    action: "record_deleted",
    entity_name: entityName,
    record_id: id,
    record_label: label,
    summary: `Removed ${entityName} record: ${label}`,
    detail: context.detail,
    farm_id: context.farm_id || (before && before.id) || id,
    farm_name: context.farm_name || (before && before.name),
  });
  return result;
}