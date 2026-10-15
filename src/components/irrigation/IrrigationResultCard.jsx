import React from "react";
import { Calculator, Droplets, Gauge, ShieldAlert } from "lucide-react";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import { DECISION_META, GROWTH_STAGES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const SOURCE_LABEL = {
  sensor: "sensor reading",
  soil_sample: "soil sample",
  manual: "value you typed",
};

const FORECAST_LABEL = {
  live: "live forecast, not a hand-entered figure",
  hand: "entered by hand, not a live feed",
  none: "no forecast was available",
};

function stageLabel(stage) {
  const found = GROWTH_STAGES.find((item) => item.value === stage);
  return found ? found.label : String(stage || "").replace(/_/g, " ");
}

export default function IrrigationResultCard({ result }) {
  const { t } = useI18n();
  const meta = DECISION_META[result.decision] || DECISION_META.insufficient_data;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={meta.tone}>{t(meta.label)}</Pill>
        <ProvenanceBadge kind="rule" />
        {result.data_freshness ? (
          <Pill tone={result.data_freshness === "fresh" ? "ok" : "warning"}>
            {t("data {value}", { value: t(result.data_freshness) })}
          </Pill>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("Assessed: {farm}", { farm: result.farm_name || t("farm not named") })}
        {result.crop_name ? ` · ${t(result.crop_name)}` : ""}
        {result.growth_stage ? ` · ${t(stageLabel(result.growth_stage))}` : ""}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-foreground">{result.reason}</p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> {t("Soil moisture")}
          </dt>
          <dd className="mt-1 font-display text-lg text-foreground">
            {result.soil_moisture_percent === null || result.soil_moisture_percent === undefined
              ? "—"
              : `${result.soil_moisture_percent}%`}
          </dd>
          <dd className="text-[11px] text-muted-foreground">
            {t(SOURCE_LABEL[result.soil_moisture_source] || result.soil_moisture_source)}
            {result.reading_age_minutes !== null && result.reading_age_minutes !== undefined
              ? ` · ${t("{minutes} min old", { minutes: result.reading_age_minutes })}`
              : ""}
          </dd>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Calculator className="h-3.5 w-3.5" /> {t("Threshold used")}
          </dt>
          <dd className="mt-1 font-display text-lg text-foreground">
            {result.threshold_percent === null || result.threshold_percent === undefined
              ? "—"
              : `${result.threshold_percent}%`}
          </dd>
          <dd className="text-[11px] text-muted-foreground">{t("below this, the rule triggers")}</dd>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Droplets className="h-3.5 w-3.5" /> {t("Expected rain")}
          </dt>
          <dd className="mt-1 font-display text-lg text-foreground">
            {result.rain_forecast_mm === null || result.rain_forecast_mm === undefined ? "—" : `${result.rain_forecast_mm} mm`}
          </dd>
          <dd className="text-[11px] text-muted-foreground">
            {t(FORECAST_LABEL[result.forecast_kind] || FORECAST_LABEL.hand)}
          </dd>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("Pump switched?")}</dt>
          <dd className="mt-1 font-display text-lg text-foreground">{t("No")}</dd>
          <dd className="text-[11px] text-muted-foreground">{t("advice only, never automatic")}</dd>
        </div>
      </dl>

      <section className="mt-5 rounded-xl border border-border bg-muted/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("How this was decided")}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.method}</p>
        {result.forecast_source ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.forecast_source}</p>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.limitations}</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {t("rule version: {version}", { version: result.rule_version })}
        </p>
      </section>
    </div>
  );
}