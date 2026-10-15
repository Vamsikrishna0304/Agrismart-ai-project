import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CloudSun, History, Sparkles, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import FarmSelect from "@/components/common/FarmSelect";
import RecommendationResultCard from "@/components/recommend/RecommendationResultCard";
import WeatherPanel from "@/components/weather/WeatherPanel";
import useFarmWeather from "@/hooks/useFarmWeather";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { SEASONS, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const FIELDS = [
  { key: "nitrogen_kg_ha", label: "Nitrogen (kg/ha)", min: 0, max: 400, placeholder: "95" },
  { key: "phosphorus_kg_ha", label: "Phosphorus (kg/ha)", min: 0, max: 300, placeholder: "48" },
  { key: "potassium_kg_ha", label: "Potassium (kg/ha)", min: 0, max: 500, placeholder: "72" },
  { key: "ph", label: "Soil pH", min: 3, max: 10, step: "0.1", placeholder: "6.8" },
  { key: "temperature_c", label: "Temperature (°C)", min: -10, max: 60, placeholder: "27" },
  { key: "humidity_percent", label: "Humidity (%)", min: 0, max: 100, placeholder: "62" },
  { key: "rainfall_mm", label: "Rainfall (mm)", min: 0, max: 5000, placeholder: "85" },
];

const EMPTY = {
  nitrogen_kg_ha: "",
  phosphorus_kg_ha: "",
  potassium_kg_ha: "",
  ph: "",
  temperature_c: "",
  humidity_percent: "",
  rainfall_mm: "",
  season: "",
  location: "",
};

export default function Recommend() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState(searchParams.get("farm") || "");
  const [form, setForm] = useState(EMPTY);
  const [inputsSource, setInputsSource] = useState("user_entered");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [running, setRunning] = useState(false);
  const [prefilling, setPrefilling] = useState(false);
  const [history, setHistory] = useState([]);
  const [climateSource, setClimateSource] = useState("user_entered");
  const weather = useFarmWeather(farmId);

  async function loadHistory() {
    const page = await base44.entities.CropRecommendation.filter({}, { sort: "-created_date", limit: 10 });
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
    const farm = farms.find((item) => item.id === farmId);
    if (farm && !form.location) {
      setForm((prev) => ({ ...prev, location: [farm.location, farm.region].filter(Boolean).join(", ") }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, farms]);

  async function prefillFromSoil() {
    if (!farmId) return;
    setPrefilling(true);
    try {
      const page = await base44.entities.SoilSample.filter({ farm_id: farmId }, { sort: "-sampled_on", limit: 1 });
      const sample = (page.items || [])[0];
      if (!sample) {
        toast({
          variant: "destructive",
          title: t("No soil sample for this farm"),
          description: t("Record a soil sample first, or type the values in."),
        });
        return;
      }
      setForm((prev) => ({
        ...prev,
        nitrogen_kg_ha: sample.nitrogen_kg_ha ?? "",
        phosphorus_kg_ha: sample.phosphorus_kg_ha ?? "",
        potassium_kg_ha: sample.potassium_kg_ha ?? "",
        ph: sample.ph ?? "",
        temperature_c: sample.temperature_c ?? "",
      }));
      setInputsSource("soil_sample");
      toast({
        title: t("Filled in from your latest soil sample"),
        description: t("Add humidity and rainfall, then run it."),
      });
    } finally {
      setPrefilling(false);
    }
  }

  async function fillFromLiveWeather() {
    const live = weather.data && weather.data.status === "ok" ? weather.data : await weather.refresh();
    if (!live || live.status !== "ok") {
      toast({
        variant: "destructive",
        title: t("Live weather is not available for this farm"),
        description: (weather.error && weather.error.message) || t("The weather service could not be reached."),
      });
      return;
    }
    setForm((prev) => ({
      ...prev,
      temperature_c: live.current.temperature_c ?? "",
      humidity_percent: live.current.humidity_percent ?? "",
    }));
    setClimateSource("live_weather");
    toast({
      title: t("Filled from live weather"),
      description: t(
        "Temperature and humidity now hold current conditions, not a season average. Rainfall stays the season figure you enter — the panel shows recent and forecast rain as context."
      ),
    });
  }

  async function handleRun(event) {
    event.preventDefault();
    setRunning(true);
    setErrors([]);
    setResult(null);
    try {
      const payload = {
        farm_id: farmId,
        season: form.season,
        location: form.location,
        inputs_source: inputsSource,
        climate_source: climateSource,
        ...form,
      };
      const response = await base44.functions.invoke("recommendCrop", payload);
      const data = response.data || {};
      if (data.status === "validation_error") {
        setErrors(data.errors || []);
      } else if (data.status === "ok") {
        setResult(data);
        if (data.save_warning) {
          toast({ variant: "destructive", title: t("Not saved to history"), description: data.save_warning });
        }
        await loadHistory();
      } else {
        setErrors([data.error || t("The recommendation could not be produced.")]);
      }
    } catch (error) {
      setErrors([error.message]);
    } finally {
      setRunning(false);
    }
  }

  const set = (key) => (event) => {
    if (key === "temperature_c" || key === "humidity_percent") setClimateSource("user_entered");
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  return (
    <div>
      <PageHeader
        title={t("Crop recommendation")}
        description={t(
          "Enter your soil and climate values and get a ranked shortlist, with the limiting factor spelled out for each crop."
        )}
        badge={<ProvenanceBadge kind="rule" label={t("Rule engine, not a trained model")} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <form onSubmit={handleRun} className="rounded-2xl border border-border bg-card p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Farm")}</Label>
              <FarmSelect farms={farms} value={farmId} onChange={setFarmId} placeholder={t("Select a farm (optional)")} />
              <p className="text-[11px] text-muted-foreground">
                {t("Storing the result against a farm puts it in the history and makes it available to the assistant.")}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" onClick={prefillFromSoil} disabled={prefilling || !farmId}>
                <Wand2 className="mr-2 h-4 w-4" />
                {prefilling ? t("Reading your soil sample…") : t("Fill in from latest soil sample")}
              </Button>
              <Button type="button" variant="secondary" onClick={fillFromLiveWeather} disabled={!farmId || weather.loading}>
                <CloudSun className="mr-2 h-4 w-4" />
                {weather.loading ? t("Reading the live weather…") : t("Fill temperature and humidity from live weather")}
              </Button>
            </div>

            <WeatherPanel {...weather} />

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "Temperature and humidity are the only inputs a live feed can stand in for. Rainfall is a season total you enter; the panel's recent and forecast rain is context, not that value."
              )}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`rec-${field.key}`}>{t(field.label)}</Label>
                  <Input
                    id={`rec-${field.key}`}
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step || "1"}
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={set(field.key)}
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rec-season">{t("Season (optional)")}</Label>
                <select
                  id="rec-season"
                  value={form.season}
                  onChange={set("season")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
                >
                  <option value="">{t("No season filter")}</option>
                  {SEASONS.map((season) => (
                    <option key={season} value={season}>
                      {t(season)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-location">{t("Location (optional)")}</Label>
                <Input id="rec-location" value={form.location} onChange={set("location")} />
              </div>
            </div>

            {errors.length ? (
              <Alert variant="destructive">
                <AlertTitle>{t("Check these inputs")}</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={running}>
              <Sparkles className="mr-2 h-4 w-4" />
              {running ? t("Scoring 17 crops…") : t("Get recommendation")}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "Weights: soil pH, temperature and rainfall carry the most influence. A season filter, when set, penalises crops that do not belong to it."
              )}
            </p>
          </div>
        </form>

        <div className="space-y-6">
          {result ? (
            <RecommendationResultCard result={result} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("Results appear here with the score for each crop and the factor that limits it.")}
              </p>
            </div>
          )}

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <History className="h-4 w-4" /> {t("Saved recommendations")}
            </h2>
            {history.length ? (
              <ul className="mt-4 space-y-3">
                {history.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm text-foreground">
                        {t(item.top_crop)} <span className="text-muted-foreground">· {item.top_score}/100</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.farm_name || t("no farm attached")} · {formatDateTime(item.created_date)} · {item.model_id}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="neutral">
                        {item.inputs_source === "soil_sample" ? t("from soil sample") : t("typed in")}
                      </Pill>
                      {item.climate_source === "live_weather" ? (
                        <Pill tone="info">{t("climate from live weather")}</Pill>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("Nothing stored yet.")}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}