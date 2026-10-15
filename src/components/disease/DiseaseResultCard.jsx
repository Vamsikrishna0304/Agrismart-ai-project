import React from "react";
import { Info, Leaf, ListChecks, ShieldAlert } from "lucide-react";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import { OUTCOME_META } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export default function DiseaseResultCard({ result }) {
  const { t } = useI18n();
  const outcome = OUTCOME_META[result.outcome] || OUTCOME_META.inconclusive;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={outcome.tone}>{t(outcome.label)}</Pill>
        <ProvenanceBadge kind="modelled" />
      </div>

      <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
        {result.outcome === "conclusive" && result.predicted_condition
          ? result.predicted_condition
          : t("No condition named from this photo")}
      </h2>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Plant in photo")}</dt>
          <dd className="mt-1 text-foreground">{result.identified_plant || t("not identified")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Model confidence")}</dt>
          <dd className="mt-1 text-foreground">
            {result.confidence_percent === null || result.confidence_percent === undefined
              ? t("not given")
              : `${result.confidence_percent}%`}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{t("Photo quality")}</dt>
          <dd className="mt-1 capitalize text-foreground">{result.image_quality ? t(result.image_quality) : t("unrated")}</dd>
        </div>
      </dl>

      {result.outcome_note ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {result.outcome_note}
        </p>
      ) : null}

      {result.observations ? (
        <section className="mt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Leaf className="h-4 w-4" /> {t("What the model could see")}
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{result.observations}</p>
        </section>
      ) : null}

      {result.recommended_actions && result.recommended_actions.length ? (
        <section className="mt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4" /> {t("What to do next")}
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {result.recommended_actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-5 rounded-xl border border-border bg-muted/60 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldAlert className="h-4 w-4" /> {t("How this was produced, and what it cannot tell you")}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.analysis_method}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.limitations}</p>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">{t("model: {id}", { id: result.model_id })}</p>
      </section>
    </div>
  );
}