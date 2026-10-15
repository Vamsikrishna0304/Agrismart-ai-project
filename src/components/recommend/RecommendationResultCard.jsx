import React from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ShieldAlert, Sprout } from "lucide-react";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import { useI18n } from "@/lib/i18n";

const COLORS = ["#1d6f4f", "#3f8f6b", "#6aa986", "#9ac4ad", "#c2dccf", "#deeae3"];

export default function RecommendationResultCard({ result }) {
  const { t } = useI18n();
  const data = (result.ranked || []).map((row) => ({ name: t(row.crop), score: row.score }));

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge kind="rule" label={t("Suitability score, not a probability")} />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("Best match for these inputs")}</p>
          <p className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold text-foreground">
            <Sprout className="h-6 w-6 text-primary" />
            {t(result.top.crop)}
          </p>
        </div>
        <p className="rounded-xl bg-accent px-3 py-1.5 font-display text-lg text-accent-foreground">
          {result.top.score} <span className="text-xs">/ 100</span>
        </p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{result.explanation}</p>

      <div className="mt-6 h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} />
            <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={16}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-4 space-y-3">
        {(result.ranked || []).map((row) => (
          <li key={row.crop} className="rounded-xl border border-border p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{t(row.crop)}</p>
              <p className="font-mono text-xs text-muted-foreground">{row.score}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("Supports: {factors}", { factors: row.supports })}</p>
            <p className="mt-0.5 text-xs text-amber-800">{t("Watch: {factors}", { factors: row.limiting })}</p>
          </li>
        ))}
      </ul>

      <section className="mt-5 rounded-xl border border-border bg-muted/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("How this was produced, and what it cannot tell you")}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.method}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.limitations}</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          {t("model: {id}", { id: result.model_id })}
        </p>
      </section>
    </div>
  );
}