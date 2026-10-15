import React from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pill from "@/components/common/Pill";
import { SEVERITY_META, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const STATUS_META = {
  open: { label: "Open", tone: "critical" },
  acknowledged: { label: "Acknowledged", tone: "warning" },
  resolved: { label: "Resolved", tone: "ok" },
};

export default function AlertRow({ alert, onStatusChange, busy }) {
  const { t } = useI18n();
  const severity = SEVERITY_META[alert.severity] || SEVERITY_META.info;
  const status = STATUS_META[alert.status] || STATUS_META.open;

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={severity.tone}>
          <BellRing className="h-3 w-3" />
          {t(severity.label)}
        </Pill>
        <Pill tone={status.tone}>{t(status.label)}</Pill>
        {alert.farm_name ? <span className="text-xs text-muted-foreground">{alert.farm_name}</span> : null}
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDateTime(alert.created_date)}</span>
      </div>

      <p className="mt-3 font-heading text-sm font-semibold text-foreground">{alert.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{alert.message}</p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">{t("raised by: {source}", { source: alert.source })}</p>

      {alert.status !== "resolved" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {alert.status === "open" ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatusChange(alert, "acknowledged")}>
              {t("Acknowledge")}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatusChange(alert, "resolved")}>
            {t("Mark resolved")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
