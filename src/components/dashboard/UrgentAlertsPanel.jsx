import React from "react";
import { Link } from "react-router-dom";
import { BellRing, CheckCircle2 } from "lucide-react";
import Pill from "@/components/common/Pill";
import { SEVERITY_META, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

/**
 * Critical and warning alerts that are still unresolved, placed at the top of the
 * dashboard. Only urgent severities reach this panel: informational notices stay on
 * the alerts page so they cannot push an urgent irrigation problem down the screen.
 */
export default function UrgentAlertsPanel({ alerts }) {
  const { t } = useI18n();

  // Critical before warning, newest first within a severity. The list is a single
  // page of at most four alerts, so ordering it for display is all that is needed.
  const ordered = [...alerts].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <BellRing className="h-4 w-4" /> {t("Alerts needing attention")}
        </h2>
        <Link to="/alerts" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("All alerts")}
        </Link>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {t("Critical and warning alerts, raised by the irrigation rules and the device checks, are listed first.")}
      </p>

      {ordered.length ? (
        <ul className="mt-4 space-y-3">
          {ordered.map((alert) => {
            const meta = SEVERITY_META[alert.severity] || SEVERITY_META.warning;
            return (
              <li
                key={alert.id}
                className={`rounded-xl border p-4 ${
                  alert.severity === "critical" ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={meta.tone}>{t(meta.label)}</Pill>
                  {alert.farm_name ? <span className="text-xs font-medium text-foreground">{alert.farm_name}</span> : null}
                  <span className="text-[11px] text-muted-foreground">{formatDateTime(alert.created_date)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{alert.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{alert.message}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-border bg-background p-5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t("Nothing urgent right now")}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t("No critical or warning alert is open. Informational alerts stay on the alerts page.")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}