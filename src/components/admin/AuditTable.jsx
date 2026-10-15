import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import Pill from "@/components/common/Pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_ACTION_META, AUDIT_ACTOR_META, ENTITY_DISPLAY, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

function actionMeta(action) {
  return AUDIT_ACTION_META[action] || { label: action, tone: "neutral" };
}

function actorMeta(actorType) {
  return AUDIT_ACTOR_META[actorType] || { label: actorType || "—", tone: "neutral" };
}

export default function AuditTable({ entries }) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("When")}</TableHead>
            <TableHead>{t("Action")}</TableHead>
            <TableHead>{t("Record")}</TableHead>
            <TableHead>{t("Summary")}</TableHead>
            <TableHead>{t("Actor")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const meta = actionMeta(entry.action);
            const actor = actorMeta(entry.actor_type);
            const open = openId === entry.id;
            return (
              <React.Fragment key={entry.id}>
                <TableRow>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{formatDateTime(entry.created_date)}</TableCell>
                  <TableCell>
                    <Pill tone={meta.tone}>{t(meta.label)}</Pill>
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.entity_name ? (
                      <>
                        <span className="text-foreground">{t(ENTITY_DISPLAY[entry.entity_name] || entry.entity_name)}</span>
                        {entry.record_label ? (
                          <span className="block text-xs text-muted-foreground">{entry.record_label}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md text-sm text-muted-foreground">{entry.summary}</TableCell>
                  <TableCell className="text-sm">
                    <span className="text-foreground">{t(actor.label)}</span>
                    <span className="block text-xs text-muted-foreground">{entry.actor_label}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : entry.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      aria-label={t("Show the recorded detail")}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/40">
                      <dl className="grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-foreground">{t("What changed")}</dt>
                          <dd className="text-muted-foreground">{entry.changes || t("No field value changed.")}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">{t("Detail")}</dt>
                          <dd className="text-muted-foreground">{entry.detail || t("No extra detail was recorded.")}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">{t("Channel")}</dt>
                          <dd className="text-muted-foreground">{entry.channel || "—"}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-foreground">{t("Signed-in account")}</dt>
                          <dd className="text-muted-foreground">{entry.actor_email || t("None — recorded as an anonymous action.")}</dd>
                        </div>
                      </dl>
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}