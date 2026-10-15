import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import AuditFilters from "@/components/admin/AuditFilters";
import AuditStatCards from "@/components/admin/AuditStatCards";
import AuditTable from "@/components/admin/AuditTable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AUDIT_ACTION_META, formatDateTime } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { useI18n } from "@/lib/i18n";

const PAGE_SIZE = 50;
const EMPTY_FILTERS = { farm_id: "all", entity_name: "all", action: "all", actor_type: "all", days: "30" };

export default function Admin() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [access, setAccess] = useState("checking");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState({});
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    base44.auth
      .me()
      .then((user) => setAccess(user ? (user.role === "admin" ? "admin" : "not_admin") : "signed_out"))
      .catch(() => setAccess("signed_out"));
    base44.entities.Farm
      .list("-created_date", 50)
      .then((rows) => setFarms(Array.isArray(rows) ? rows : []))
      .catch(() => setFarms([]));
  }, []);

  function buildQuery() {
    const query = {};
    if (filters.farm_id !== "all") query.farm_id = filters.farm_id;
    if (filters.entity_name !== "all") query.entity_name = filters.entity_name;
    if (filters.action !== "all") query.action = filters.action;
    if (filters.actor_type !== "all") query.actor_type = filters.actor_type;
    if (filters.days !== "all") {
      query.created_date = { $gte: new Date(Date.now() - Number(filters.days) * 86400000).toISOString() };
    }
    return query;
  }

  useEffect(() => {
    if (access !== "admin") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const query = buildQuery();
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);

      const [page, byActor, todayCount] = await Promise.all([
        base44.entities.AuditLog.filter(query, { sort: "-created_date", limit: PAGE_SIZE }),
        base44.entities.AuditLog.aggregate({ query, groupBy: "actor_type" }),
        base44.entities.AuditLog.count({ created_date: { $gte: midnight.toISOString() } }),
      ]);
      if (cancelled) return;

      const items = page.items || [];
      const counts = {};
      let total = 0;
      (byActor.rows || []).forEach((row) => {
        counts[row.actor_type] = row.count;
        total += row.count;
      });

      setEntries(items);
      setCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
      setStats({ ...counts, total, today: todayCount });
      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) {
        setLoading(false);
        toast({ variant: "destructive", title: t("The history could not be read") });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, filters]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.AuditLog.filter(buildQuery(), {
        sort: "-created_date",
        limit: PAGE_SIZE,
        cursor,
      });
      setEntries((current) => [...current, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
    } finally {
      setLoadingMore(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const query = buildQuery();
      const rows = [];
      let nextCursor;
      for (let round = 0; round < 40; round += 1) {
        const page = await base44.entities.AuditLog.filter(query, {
          sort: "-created_date",
          limit: 200,
          cursor: nextCursor,
        });
        rows.push(...(page.items || []));
        if (!page.has_more || !page.next_cursor) break;
        nextCursor = page.next_cursor;
      }

      const header = [
        t("When"),
        t("Action"),
        t("Record type"),
        t("Record"),
        t("Summary"),
        t("What changed"),
        t("Actor"),
        t("Signed-in account"),
        t("Detail"),
      ];
      const body = rows.map((row) => {
        const meta = AUDIT_ACTION_META[row.action];
        return [
          formatDateTime(row.created_date),
          meta ? t(meta.label) : row.action,
          row.entity_name || "",
          row.record_label || "",
          row.summary || "",
          row.changes || "",
          row.actor_label || "",
          row.actor_email || "",
          row.detail || "",
        ];
      });
      downloadCsv(`agrismart-audit-${new Date().toISOString().slice(0, 10)}.csv`, header, body);

      toast({ title: t("History exported"), description: t("{count} entries written to the file.", { count: rows.length }) });
    } catch (error) {
      toast({ variant: "destructive", title: t("The history could not be exported"), description: error.message });
    } finally {
      setExporting(false);
    }
  }

  if (access !== "admin") {
    return (
      <div>
        <PageHeader
          title={t("Administration console")}
          description={t("The audit trail of every record change and every engine action.")}
        />
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {access === "not_admin"
              ? t("This account is signed in but is not an administrator, so the audit trail stays closed to it.")
              : t(
                  "The audit trail can be read only by a signed-in administrator, and this app is currently in public mode, so a visitor who has not signed in cannot open this console."
                )}
          </p>
          {access !== "checking" ? (
            <Button asChild variant="outline">
              <Link to="/login">{t("Sign in as an administrator")}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("Administration console")}
        description={t(
          "Every record change, every engine action and the actor the app knows about, newest first. Entries are added as things happen and are never edited from here."
        )}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={exporting || loading}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? t("Preparing the file…") : t("Export history as CSV")}
          </Button>
        }
      />

      <AuditStatCards stats={stats} />
      <AuditFilters farms={farms} filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((key) => (
            <div key={key} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : entries.length ? (
        <>
          <AuditTable entries={entries} />
          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t("Loading more…") : t("Load more entries")}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={t("Nothing matches these filters yet")}
          description={t(
            "Entries are written whenever a record is added, changed or removed, a device posts a reading, or one of the app's engines produces a result."
          )}
        />
      )}

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        {t(
          "An entry records only what the app actually knows about the actor. While the app is in public mode, actions taken without signing in are recorded as an anonymous visitor rather than tied to a person; switching the app to private mode with sign-in is what attaches every action to a named account. Nothing in this console edits or deletes an entry."
        )}
      </p>
    </div>
  );
}