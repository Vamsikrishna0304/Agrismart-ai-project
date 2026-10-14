import React, { useEffect, useState } from "react";
import { Activity, BellRing, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { auditedUpdate } from "@/lib/audit";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import StatCard from "@/components/common/StatCard";
import AlertRow from "@/components/alerts/AlertRow";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useI18n } from "@/lib/i18n";

export default function Alerts() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [alerts, setAlerts] = useState([]);
  const [counts, setCounts] = useState({});
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  async function load() {
    setLoading(true);
    const query = {};
    if (statusFilter !== "all") query.status = statusFilter;
    if (severityFilter !== "all") query.severity = severityFilter;

    const [page, severityAgg, openCount] = await Promise.all([
      base44.entities.Alert.filter(query, { sort: "-created_date", limit: 100 }),
      base44.entities.Alert.aggregate({ query: { status: { $ne: "resolved" } }, groupBy: "severity" }),
      base44.entities.Alert.count({ status: "open" }),
    ]);

    const nextCounts = { open: openCount };
    (severityAgg.rows || []).forEach((row) => {
      nextCounts[row.severity] = row.count;
    });

    setAlerts(page.items || []);
    setCounts(nextCounts);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, severityFilter]);

  async function handleStatusChange(alert, status) {
    setBusy(true);
    try {
      await auditedUpdate("Alert", alert.id, { status }, alert, {
        farm_id: alert.farm_id,
        farm_name: alert.farm_name,
      });
      toast({ title: status === "resolved" ? t("Alert resolved") : t("Alert acknowledged") });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: t("That did not update"), description: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeviceCheck() {
    setChecking(true);
    try {
      const response = await base44.functions.invoke("checkDeviceHealth", {});
      const data = response.data || {};
      toast({
        title: data.status === "ok" ? t("Device check finished") : t("Device check could not run"),
        description: data.message || data.error,
      });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: t("Device check failed"), description: error.message });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("Alerts")}
        description={t("Raised by the irrigation rules and by the device staleness check. Each alert names what triggered it.")}
        actions={
          <Button variant="outline" onClick={handleDeviceCheck} disabled={checking}>
            <Activity className="mr-2 h-4 w-4" />
            {checking ? t("Checking devices…") : t("Check devices for stale readings")}
          </Button>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Open")} value={counts.open || 0} icon={BellRing} hint={t("Not yet acknowledged")} />
        <StatCard label={t("Critical")} value={counts.critical || 0} icon={BellRing} hint={t("Unresolved critical alerts")} />
        <StatCard label={t("Warnings")} value={counts.warning || 0} icon={BellRing} hint={t("Unresolved warnings")} />
        <StatCard label={t("Resolved")} value={counts.resolved || 0} icon={CheckCircle2} hint={t("Closed by you")} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="alert-status">
            {t("Status")}
          </label>
          <select
            id="alert-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="open">{t("Open")}</option>
            <option value="acknowledged">{t("Acknowledged")}</option>
            <option value="resolved">{t("Resolved")}</option>
            <option value="all">{t("All statuses")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="alert-severity">
            {t("Severity")}
          </label>
          <select
            id="alert-severity"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">{t("All severities")}</option>
            <option value="critical">{t("Critical")}</option>
            <option value="warning">{t("Warning")}</option>
            <option value="info">{t("Info")}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : alerts.length ? (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onStatusChange={handleStatusChange} busy={busy} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={BellRing}
          title={t("Nothing to show with these filters")}
          description={t(
            "Alerts appear when the irrigation rule finds a critical deficit or when a device stops reporting."
          )}
          action={
            <Button variant="outline" onClick={() => setStatusFilter("all")}>
              {t("Show all statuses")}
            </Button>
          }
        />
      )}
    </div>
  );
}
