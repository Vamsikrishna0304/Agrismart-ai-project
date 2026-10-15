import React from "react";
import { AlertTriangle, Radio, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pill from "@/components/common/Pill";
import { SENSOR_META, formatDateTime, freshnessLabel } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const STATUS_META = {
  active: { label: "Reporting", tone: "ok" },
  offline: { label: "Offline", tone: "critical" },
  never_reported: { label: "Never reported", tone: "neutral" },
};

const INGESTION_LABEL = {
  simulated: "Simulator only",
  http_ingest: "Device posts over HTTPS",
  mqtt_planned: "MQTT planned",
};

export default function DeviceCard({ device, onSimulate, simulating, staleAfterMinutes = 360 }) {
  const { t } = useI18n();
  const status = STATUS_META[device.status] || STATUS_META.never_reported;
  const ageMinutes = device.last_reading_at
    ? Math.round((Date.now() - new Date(device.last_reading_at).getTime()) / 60000)
    : null;
  const stale = ageMinutes !== null && ageMinutes > staleAfterMinutes;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-semibold text-foreground">{device.name || device.device_id}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{device.device_id}</p>
        </div>
        <Pill tone={status.tone}>{t(status.label)}</Pill>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(device.sensor_types || []).map((type) => (
          <span key={type} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {SENSOR_META[type] ? t(SENSOR_META[type].label) : type}
          </span>
        ))}
      </div>

      <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>{t("Last reading")}</dt>
          <dd className="text-right text-foreground">
            {device.last_reading_at ? `${formatDateTime(device.last_reading_at)} · ${freshnessLabel(ageMinutes)}` : t("never")}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t("Ingestion")}</dt>
          <dd className="text-right text-foreground">{t(INGESTION_LABEL[device.ingestion_method] || device.ingestion_method)}</dd>
        </div>
      </dl>

      {stale ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t(
            "This device has not reported recently. Its last values are stale and are labelled that way rather than shown as current."
          )}
        </p>
      ) : null}

      <div className="mt-auto pt-5">
        <Button variant="outline" size="sm" className="w-full" onClick={() => onSimulate(device)} disabled={simulating}>
          <Waves className="mr-2 h-3.5 w-3.5" />
          {simulating ? t("Generating…") : t("Generate a day of simulated readings")}
        </Button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Radio className="h-3 w-3" /> {t("Labelled simulated, never passed off as measured")}
        </p>
      </div>
    </div>
  );
}