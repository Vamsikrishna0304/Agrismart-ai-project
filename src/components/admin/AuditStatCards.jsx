import React from "react";
import { Activity, CalendarClock, History, UserRound } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import { useI18n } from "@/lib/i18n";

export default function AuditStatCards({ stats }) {
  const { t } = useI18n();
  const engine = (stats.system || 0) + (stats.device || 0);

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t("Entries")} value={stats.total || 0} icon={History} hint={t("With the filters above")} />
      <StatCard label={t("Today")} value={stats.today || 0} icon={CalendarClock} hint={t("Recorded since midnight")} />
      <StatCard
        label={t("Signed-in actions")}
        value={stats.signed_in_user || 0}
        icon={UserRound}
        hint={t("Actions by a signed-in account")}
      />
      <StatCard
        label={t("Engine actions")}
        value={engine}
        icon={Activity}
        hint={t("Devices and the app's own engines")}
      />
    </div>
  );
}