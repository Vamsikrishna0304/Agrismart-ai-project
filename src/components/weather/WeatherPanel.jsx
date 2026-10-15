import React from "react";
import { AlertTriangle, CloudSun, RefreshCw } from "lucide-react";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import WeatherTiles from "@/components/weather/WeatherTiles";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

// Display-only: the page owns the fetch (useFarmWeather) so it can reuse the same values.
export default function WeatherPanel({ data, loading, error, refresh }) {
  const { t } = useI18n();

  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <CloudSun className="h-4 w-4" /> {t("Live weather")}
        </h3>
        <div className="flex items-center gap-2">
          <ProvenanceBadge
            kind="modelled"
            note={t("Live model output for the nearest grid cell, not an instrument in your field.")}
          />
          <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("Refresh")}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-3 h-24 animate-pulse rounded-xl bg-muted" />
      ) : error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>{t("Live weather is not available for this farm")}</AlertTitle>
          <AlertDescription>{error.message || t("The weather service could not be reached.")}</AlertDescription>
        </Alert>
      ) : data ? (
        <>
          <WeatherTiles data={data} />
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("Nearest point used: {place}", {
              place: [data.place.name, data.place.region].filter(Boolean).join(", "),
            })}{" "}
            · {data.provider.label}
            {data.updated_at ? ` · ${t("model run {time}", { time: formatDateTime(data.updated_at) })}` : ""}
            {" · "}
            {t("fetched {time}", { time: formatDateTime(data.fetched_at) })}
          </p>
          {data.place.matched_on === "region only" ? (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t(
                "Your farm's village was not found in the place search, so the district centre was used: these figures describe that point rather than your plot."
              )}
            </p>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{data.limitations}</p>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("Select a farm to read its live conditions.")}</p>
      )}
    </section>
  );
}