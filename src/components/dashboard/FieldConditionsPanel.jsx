import React from "react";
import { Link } from "react-router-dom";
import Pill from "@/components/common/Pill";
import {
  READING_SOURCE_META,
  SENSOR_META,
  SENSOR_TYPES,
  formatDateTime,
  freshnessLabel,
  freshnessState,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

/**
 * The newest stored value for each sensor type, shown near the top of the dashboard.
 * A value past the freshness limit is marked stale rather than left looking current,
 * and every card names its source so a simulated number is never read as a measurement.
 */
export default function FieldConditionsPanel({ readings }) {
  const { t } = useI18n();

  // A fixed sensor order, so the same reading sits in the same place on every visit.
  const ordered = SENSOR_TYPES.map((type) => readings.find((reading) => reading.sensor_type === type)).filter(Boolean);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">{t("Field conditions right now")}</h2>
        <Link to="/monitoring" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("Sensor monitoring")}
        </Link>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t("The newest stored value for each sensor type, with its source and age.")}
      </p>

      {ordered.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((reading) => {
            const meta = SENSOR_META[reading.sensor_type] || { label: reading.sensor_type, unitLabel: "" };
            const source = READING_SOURCE_META[reading.source] || READING_SOURCE_META.manual;
            const age = Math.round((Date.now() - new Date(reading.recorded_at).getTime()) / 60000);
            const state = freshnessState(age);
            return (
              <div
                key={reading.sensor_type}
                className={`rounded-2xl border bg-card p-5 ${state === "stale" ? "border-amber-300" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(meta.label)}</p>
                  {state === "stale" ? <Pill tone="warning">{t("stale")}</Pill> : null}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                  {reading.value}
                  <span className="ml-1 text-sm text-muted-foreground">{meta.unitLabel}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pill tone={source.tone}>{t(source.label)}</Pill>
                  <span className="text-[11px] text-muted-foreground">
                    {reading.farm_name ? `${reading.farm_name} · ` : ""}
                    {formatDateTime(reading.recorded_at)} · {freshnessLabel(age)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              "No sensor readings stored yet. Register a device and generate a simulated day of readings to see the dashboard fill in."
            )}
          </p>
        </div>
      )}
    </section>
  );
}
