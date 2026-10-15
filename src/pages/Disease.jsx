import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, History, ScanLine, ShieldAlert, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import FarmSelect from "@/components/common/FarmSelect";
import DiseaseResultCard from "@/components/disease/DiseaseResultCard";
import PrivateImage from "@/components/disease/PrivateImage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OUTCOME_META, PLANT_OPTIONS, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const MAX_BYTES = 8 * 1024 * 1024;

export default function Disease() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState(searchParams.get("farm") || "");
  const [plantType, setPlantType] = useState("Tomato");
  const [cropName, setCropName] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    const page = await base44.entities.DiseaseAnalysis.filter({}, { sort: "-created_date", limit: 8 });
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
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFile(event) {
    const chosen = event.target.files && event.target.files[0];
    setResult(null);
    setError(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    if (!chosen.type.startsWith("image/")) {
      setError(t("That file is not an image. Upload a JPEG, PNG or WebP photo of the plant."));
      setFile(null);
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError(t("That photo is larger than 8 MB. Take a smaller picture or compress it first."));
      setFile(null);
      return;
    }
    setFile(chosen);
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const upload = await base44.integrations.Core.UploadPrivateFile({ file });
      const farm = farms.find((item) => item.id === farmId);
      const response = await base44.functions.invoke("analyzePlantDisease", {
        farm_id: farmId,
        farm_name: farm ? farm.name : "",
        crop_name: cropName,
        plant_type: plantType,
        image_uri: upload.file_uri,
      });
      const data = response.data || {};
      if (data.status === "ok") {
        setResult(data);
      } else {
        setError(data.error || t("The analysis could not be completed."));
      }
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("Plant disease detection")}
        description={t(
          "Send one clear photo of the plant. The model reports what it can see, how confident it is, and what the photo cannot tell anyone."
        )}
        badge={<ProvenanceBadge kind="modelled" label={t("Vision model output")} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("Farm")}</Label>
                <FarmSelect farms={farms} value={farmId} onChange={setFarmId} placeholder={t("Select a farm (optional)")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disease-plant">{t("Which plant is in the photo? *")}</Label>
                <select
                  id="disease-plant"
                  value={plantType}
                  onChange={(event) => setPlantType(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLANT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disease-crop">{t("Crop record (optional)")}</Label>
                <input
                  id="disease-crop"
                  value={cropName}
                  onChange={(event) => setCropName(event.target.value)}
                  placeholder={t("e.g. Tomato — north block")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disease-file">{t("Photo *")}</Label>
                <label
                  htmlFor="disease-file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:bg-muted"
                >
                  <Upload className="h-5 w-5 text-primary" />
                  <span className="mt-2 text-sm text-foreground">{t("Choose or take a photo")}</span>
                  <span className="mt-1 text-xs text-muted-foreground">{t("JPEG, PNG or WebP · up to 8 MB")}</span>
                  <input id="disease-file" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                </label>
              </div>

              {previewUrl ? (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <img src={previewUrl} alt={t("The plant photo you selected")} className="h-56 w-full object-cover" />
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>{t("No analysis produced")}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button className="w-full" onClick={handleAnalyze} disabled={!file || analyzing}>
                <ScanLine className="mr-2 h-4 w-4" />
                {analyzing ? t("Reading the photo…") : t("Analyse photo")}
              </Button>

              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t(
                  "Photos are stored privately — they are not public links, and only your app session can open them. Image classification is not a laboratory diagnosis, and no chemical dosage is ever given."
                )}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <History className="h-4 w-4" /> {t("Earlier analyses")}
            </h2>
            {history.length ? (
              <ul className="mt-4 space-y-3">
                {history.map((item) => {
                  const outcome = OUTCOME_META[item.outcome] || OUTCOME_META.inconclusive;
                  return (
                    <li key={item.id} className="flex gap-3 rounded-xl border border-border p-3">
                      <PrivateImage
                        fileUri={item.image_uri}
                        alt={t("Stored plant photo")}
                        className="h-16 w-16 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={outcome.tone}>{t(outcome.label)}</Pill>
                          <span className="text-xs text-muted-foreground">{t(item.plant_type) || item.plant_type}</span>
                        </div>
                        <p className="mt-1 truncate text-sm text-foreground">
                          {item.predicted_condition || item.identified_plant || t("No condition named")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(item.created_date)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("No photo has been analysed yet.")}</p>
            )}
          </div>
        </div>

        <div>
          {result ? (
            <DiseaseResultCard result={result} />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <Camera className="h-6 w-6 text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">
                {t(
                  "The result appears here: the plant the model sees, the condition it names (or why it will not name one), first steps, and the model's own limits."
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}