import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BellRing, Droplets, History, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import FarmSelect from "@/components/common/FarmSelect";
import IrrigationResultCard from "@/components/irrigation/IrrigationResultCard";
import WeatherPanel from "@/components/weather/WeatherPanel";
import useFarmWeather from "@/hooks/useFarmWeather";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DECISION_META, GROWTH_STAGES, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

function stageLabel(stage) {
  const found = GROWTH_STAGES.find((item) => item.value === stage);
  return found ? found.label : stage;
}

export default function Irrigation() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState(searchParams.get("farm") || "");
  const [crops, setCrops] = useState([]);
  const [cropId, setCropId] = useState("");
  const [moisture, setMoisture] = useState("");
  const [rain, setRain] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const weather = useFarmWeather(farmId);

  async function loadHistory() {
    const page = await base44.entities.IrrigationRecommendation.filter({}, { sort: "-created_date", limit: 8 });
    setHistory(page.items || []);
  }

  useEffect(() => {
    base44.entities.Farm.filter({}, { sort: "name", limit: 100 }).then((page) => {
      const items = page.items || [];
      setFarms(items);
      setFarmId((current) => current || (items[0] ? items[0].id : ""));
    });
    loadHistory();
  }, []);

  useEffect(() => {
    if (!farmId) return;
    base44.entities.Crop.filter({ farm_id: farmId, status: "active" }, { sort: "-created_date", limit: 20 }).then((page) => {
      const items = page.items || [];
      setCrops(items);
      setCropId(items[0] ? items[0].id : "");
    });
  }, [farmId]);

  async function handleRun(event) {
    event.preventDefault();
    if (crops.length && !cropId) {
      setError(t("Choose which crop to assess before running the rules."));
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const payload = { farm_id: farmId, crop_id: cropId || undefined };
      if (moisture !== "") payload.soil_moisture_percent = Number(moisture);
      if (rain !== "") payload.rain_forecast_mm = Number(rain);

      const response = await base44.functions.invoke("irrigationRecommend", payload);
      const data = response.data || {};
      if (data.status === "ok") {
        setResult(data);
        await loadHistory();
      } else {
        setError(data.error || t("The recommendation could not be produced."));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("Smart irrigation")}
        description={t(
          "A transparent threshold engine: it compares the latest soil moisture with the crop's minimum, adjusts for growth stage and expected rain, and writes out its reasoning."
        )}
        badge={<ProvenanceBadge kind="rule" label={t("Rules, not machine learning")} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <form onSubmit={handleRun} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-2">
            <Label>{t("Farm *")}</Label>
            <FarmSelect farms={farms} value={farmId} onChange={setFarmId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="irrigation-crop">{t("Crop")}</Label>
            <select
              id="irrigation-crop"
              value={cropId}
              onChange={(event) => setCropId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {crops.length ? (
                crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {t(crop.crop_name)} · {t(stageLabel(crop.growth_stage))}
                  </option>
                ))
              ) : (
                <option value="">{t("No active crop on this farm")}</option>
              )}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {t("Growth stage matters: flowering and fruiting raise the minimum by 5 points.")}
            </p>
          </div>

          <WeatherPanel {...weather} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="irrigation-moisture">{t("Measured soil moisture (%)")}</Label>
              <Input
                id="irrigation-moisture"
                type="number"
                min="0"
                max="100"
                value={moisture}
                onChange={(event) => setMoisture(event.target.value)}
                placeholder={t("leave blank to use the newest reading")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="irrigation-rain">{t("Expected rain (mm)")}</Label>
              <Input
                id="irrigation-rain"
                type="number"
                min="0"
                value={rain}
                onChange={(event) => setRain(event.target.value)}
                placeholder={t("leave blank to use the live forecast")}
              />
            </div>
          </div>

          <p className="rounded-xl border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {t(
              "Leave the rain field empty and the live forecast for this farm is used, and the decision says so. A figure you type overrides it and is then labelled as hand-entered. If you leave the moisture blank, the newest sensor reading or soil sample is used, and its age decides whether it is fresh enough."
            )}
          </p>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{t("No recommendation produced")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={running || !farmId || (crops.length > 0 && !cropId)}>
            <Droplets className="mr-2 h-4 w-4" />
            {running ? t("Applying the rules…") : t("Get irrigation advice")}
          </Button>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t(
              "This engine never opens a valve or switches a pump. Any physical actuation would need an authorised operator and a manual override."
            )}
          </p>

          <Link to="/settings" className="block text-xs text-primary underline-offset-4 hover:underline">
            {t("Change the thresholds used for each crop")}
          </Link>
        </form>

        <div className="space-y-6">
          {result ? (
            <>
              <IrrigationResultCard result={result} />
              {result.alert_id ? (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTitle className="flex items-center gap-2 text-red-900">
                    <BellRing className="h-4 w-4" /> {t("A critical alert was raised")}
                  </AlertTitle>
                  <AlertDescription className="text-red-900">
                    {t("Because irrigation is needed now, an alert was created so it does not get missed.")}{" "}
                    <Link to="/alerts" className="underline underline-offset-4">
                      {t("Open alerts")}
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : null}
            </>
          ) : (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t(
                  "The decision, the values it used, the freshness of those values and the exact rule version appear here."
                )}
              </p>
            </div>
          )}

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <History className="h-4 w-4" /> {t("Recent decisions")}
            </h2>
            {history.length ? (
              <ul className="mt-4 space-y-3">
                {history.map((item) => {
                  const meta = DECISION_META[item.decision] || DECISION_META.insufficient_data;
                  return (
                    <li key={item.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={meta.tone}>{t(meta.label)}</Pill>
                        <span className="text-xs text-muted-foreground">
                          {item.farm_name} · {item.crop_name ? t(item.crop_name) : ""}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDateTime(item.created_date)} ·{" "}
                        {t("data {value}", { value: t(item.data_freshness || "aging") })} · {item.rule_version}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("No decision has been recorded yet.")}</p>
            )}
          </section>
        </div>
      </div>

      {!farms.length ? (
        <EmptyState
          icon={Droplets}
          title={t("Add a farm first")}
          description={t("Irrigation advice needs a farm and an active crop.")}
          action={
            <Button asChild className="mt-2">
              <Link to="/farms">{t("Go to farms")}</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}