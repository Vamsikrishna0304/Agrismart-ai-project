import React from "react";

export default function StatCard({ label, value, unit, hint, icon: Icon, badge }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-primary/70" /> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold text-foreground">{value}</span>
        {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
      </div>
      {badge ? <div className="mt-3">{badge}</div> : null}
      {hint ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}