import React from "react";
import FarmSelect from "@/components/common/FarmSelect";
import { AUDIT_ACTION_META, AUDIT_ACTOR_META, AUDIT_ENTITY_OPTIONS, ENTITY_DISPLAY } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const FIELD_CLASS = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const WINDOWS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function AuditFilters({ farms, filters, onChange }) {
  const { t } = useI18n();
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="audit-farm">
          {t("Farm")}
        </label>
        <FarmSelect
          farms={farms}
          value={filters.farm_id}
          onChange={(value) => onChange({ ...filters, farm_id: value })}
          placeholder="All farms"
          allowAll
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="audit-entity">
          {t("Record type")}
        </label>
        <select id="audit-entity" value={filters.entity_name} onChange={set("entity_name")} className={FIELD_CLASS}>
          <option value="all">{t("All record types")}</option>
          {AUDIT_ENTITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(ENTITY_DISPLAY[option] || option)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="audit-action">
          {t("Action")}
        </label>
        <select id="audit-action" value={filters.action} onChange={set("action")} className={FIELD_CLASS}>
          <option value="all">{t("All actions")}</option>
          {Object.keys(AUDIT_ACTION_META).map((key) => (
            <option key={key} value={key}>
              {t(AUDIT_ACTION_META[key].label)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="audit-actor">
          {t("Actor")}
        </label>
        <select id="audit-actor" value={filters.actor_type} onChange={set("actor_type")} className={FIELD_CLASS}>
          <option value="all">{t("All actors")}</option>
          {Object.keys(AUDIT_ACTOR_META).map((key) => (
            <option key={key} value={key}>
              {t(AUDIT_ACTOR_META[key].label)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="audit-window">
          {t("Window")}
        </label>
        <select id="audit-window" value={filters.days} onChange={set("days")} className={FIELD_CLASS}>
          {WINDOWS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}