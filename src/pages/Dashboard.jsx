import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  Droplets,
  FlaskConical,
  Leaf,
  MessageSquare,
  Radio,
  ScanLine,
  Sparkles,
  Sprout,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import UrgentAlertsPanel from "@/components/dashboard/UrgentAlertsPanel";
import FieldConditionsPanel from "@/components/dashboard/FieldConditionsPanel";
import { Button } from "@/components/ui/button";
import { DECISION_META } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const QUICK_ACTIONS = [
  { to: "/recommend", label: "Crop recommendation", Icon: Sparkles },
  { to: "/disease", label: "Check a plant photo", Icon: ScanLine },
  { to: "/assistant", label: "Ask the assistant", Icon: MessageSquare },
  { to: "/irrigation", label: "Irrigation advice", Icon: Droplets },
  { to: "/monitoring", label: "Sensor monitoring", Icon: Radio },
];

export default function Dashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ farms: 0, crops: 0, alerts: 0, analyses: 0, samples: 0 });
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const [farms, crops, openAlerts, analyses, samples, readingPage, urgentPage, advicePage, recPage] =
        await Promise.all([
          base44.entities.Farm.count({}),
          base44.entities.Crop.count({ status: "active" }),
          base44.entities.Alert.count({ status: "open" }),
          base44.entities.DiseaseAnalysis.count({}),
          base44.entities.SoilSample.count({}),
          base44.entities.SensorReading.filter({}, { sort: "-recorded_at", limit: 60 }),
          // Urgent only, filtered on the server: unresolved critical and warning alerts,
          // so an urgent irrigation or device problem is never pushed down by routine notices.
          base44.entities.Alert.filter(
            { status: { $ne: "resolved" }, severity: { $in: ["critical", "warning"] } },
            { sort: "-created_date", limit: 4 }
          ),
          base44.entities.IrrigationRecommendation.filter({}, { sort: "-created_date", limit: 1 }),
          base44.entities.CropRecommendation.filter({}, { sort: "-created_date", limit: 1 }),
        ]);

      if (!active) return;

      setCounts({ farms, crops, alerts: openAlerts, analyses, samples });
      setAlerts(urgentPage.items || []);
      setAdvice((advicePage.items || [])[0] || null);
      setRecommendation((recPage.items || [])[0] || null);

      const latestByType = {};
      for (const reading of readingPage.items || []) {
        if (!latestByType[reading.sensor_type]) latestByType[reading.sensor_type] = reading;
      }
      setReadings(Object.values(latestByType));
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-1/2 animate-pulse rounded-xl bg-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("Farm overview")}
        description={t(
          "Everything in one place: what you recorded, what the models predicted, and what the field sensors reported."
        )}
        actions={
          <Button asChild variant="outline">
            <Link to="/farms">
              <Sprout className="mr-2 h-4 w-4" /> {t("Manage farms")}
            </Link>
          </Button>
        }
      />

      {/* Farm status first: what needs acting on, then what the field is reporting. */}
      <div className="space-y-10">
        <UrgentAlertsPanel alerts={alerts} />
        <FieldConditionsPanel readings={readings} />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Farms")} value={counts.farms} icon={Sprout} hint={t("Records you created")} />
        <StatCard label={t("Active crops")} value={counts.crops} icon={Leaf} hint={t("Plantings marked active")} />
        <StatCard
          label={t("Open alerts")}
          value={counts.alerts}
          icon={BellRing}
          hint={t("Raised by the irrigation rules and device checks")}
        />
        <StatCard
          label={t("Soil samples")}
          value={counts.samples}
          icon={FlaskConical}
          hint={t("{count} plant-photo analyses stored", { count: counts.analyses })}
        />
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">{t("Latest irrigation decision")}</h2>
            <ProvenanceBadge kind="rule" />
          </div>
          {advice ? (
            <>
              <div className="mt-4">
                <Pill tone={(DECISION_META[advice.decision] || DECISION_META.insufficient_data).tone}>
                  {t((DECISION_META[advice.decision] || DECISION_META.insufficient_data).label)}
                </Pill>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{advice.reason}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {advice.farm_name} · {t(advice.crop_name)} · {t("rule version")} {advice.rule_version}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/irrigation">{t("Run it again")}</Link>
              </Button>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("No irrigation advice has been generated yet. Run the rule engine to get a decision with its reasons.")}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">{t("Latest crop recommendation")}</h2>
            <ProvenanceBadge kind="rule" />
          </div>
          {recommendation ? (
            <>
              <p className="mt-4 font-display text-2xl font-semibold text-foreground">
                {t(recommendation.top_crop)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {t("{score} / 100 fit", { score: recommendation.top_score })}
                </span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{recommendation.explanation}</p>
              <p className="mt-3 text-xs text-muted-foreground">{recommendation.model_id}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("No recommendation stored yet. Enter your soil values and get a ranked shortlist.")}
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t("Quick actions")}</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ to, label, Icon }) => (
            <Button key={to} asChild variant="secondary">
              <Link to={to}>
                <Icon className="mr-2 h-4 w-4" /> {t(label)}
              </Link>
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}