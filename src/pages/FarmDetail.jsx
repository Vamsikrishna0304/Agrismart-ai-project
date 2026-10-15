import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BellRing, Droplets, FlaskConical, Leaf, MapPin, Plus, Radio, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { auditedCreate, auditedUpdate, auditedDelete } from "@/lib/audit";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import Pill from "@/components/common/Pill";
import FarmFormDialog from "@/components/farms/FarmFormDialog";
import CropFormDialog from "@/components/crops/CropFormDialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { GROWTH_STAGES, SENSOR_META, formatDate, formatDateTime, freshnessLabel } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const CHILD_ENTITIES = [
  "Crop",
  "SoilSample",
  "Device",
  "SensorReading",
  "Alert",
  "CropRecommendation",
  "IrrigationRecommendation",
  "DiseaseAnalysis",
];

export default function FarmDetail() {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const [farm, setFarm] = useState(null);
  const [crops, setCrops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const loaded = await base44.entities.Farm.get(farmId).catch(() => null);
    if (!loaded) {
      setFarm(null);
      setLoading(false);
      return;
    }
    setFarm(loaded);

    const [cropPage, samplePage, devicePage, alertPage] = await Promise.all([
      base44.entities.Crop.filter({ farm_id: farmId }, { sort: "-created_date", limit: 50 }),
      base44.entities.SoilSample.filter({ farm_id: farmId }, { sort: "-sampled_on", limit: 3 }),
      base44.entities.Device.filter({ farm_id: farmId }, { limit: 20 }),
      base44.entities.Alert.filter({ farm_id: farmId, status: { $ne: "resolved" } }, { sort: "-created_date", limit: 5 }),
    ]);

    setCrops(cropPage.items || []);
    setSamples(samplePage.items || []);
    setDevices(devicePage.items || []);
    setAlerts(alertPage.items || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId]);

  async function handleEdit(form) {
    setBusy(true);
    try {
      await auditedUpdate("Farm", farmId, form, farm);
      toast({ title: t("Farm updated") });
      setEditOpen(false);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: t("That did not save"), description: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCrop(form) {
    setBusy(true);
    try {
      await auditedCreate("Crop", { ...form, farm_id: farmId, farm_name: farm.name }, {
        farm_id: farmId,
        farm_name: farm.name,
      });
      toast({ title: t("Crop recorded") });
      setCropOpen(false);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: t("That did not save"), description: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      for (const entityName of CHILD_ENTITIES) {
        await base44.entities[entityName].deleteMany({ farm_id: farmId });
      }
      await auditedDelete("Farm", farmId, farm, {
        detail: `Its related records (${CHILD_ENTITIES.join(", ")}) were removed with it. The audit history of this farm is kept.`,
      });
      toast({ title: t("Farm removed"), description: t("Its crops, samples, devices and alerts were removed with it.") });
      navigate("/farms");
    } catch (error) {
      toast({ variant: "destructive", title: t("Could not remove the farm"), description: error.message });
      setBusy(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;

  if (!farm) {
    return (
      <EmptyState
        icon={Leaf}
        title={t("That farm could not be found")}
        description={t("It may have been removed. Go back to the farm list to pick another one.")}
        action={
          <Button asChild>
            <Link to="/farms">{t("Back to farms")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link to="/farms">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("All farms")}
        </Link>
      </Button>

      <PageHeader
        title={farm.name}
        description={farm.notes || t("Notes about this farm have not been added yet.")}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              {t("Edit farm")}
            </Button>
            <Button variant="outline" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> {t("Delete")}
            </Button>
          </>
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Pill tone="neutral">
            <MapPin className="h-3 w-3" />{" "}
            {[farm.location, farm.region].filter(Boolean).join(", ") || t("location not recorded")}
          </Pill>
          {farm.area_hectares ? <Pill tone="neutral">{farm.area_hectares} ha</Pill> : null}
          {farm.soil_type ? (
            <Pill tone="neutral">
              {t(farm.soil_type)} {t("soil")}
            </Pill>
          ) : null}
          {farm.irrigation_type ? (
            <Pill tone="neutral">
              <Droplets className="h-3 w-3" /> {t(farm.irrigation_type)}
            </Pill>
          ) : null}
          {farm.climate_zone ? <Pill tone="neutral">{farm.climate_zone}</Pill> : null}
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/irrigation?farm=${farm.id}`}>
            <Droplets className="mr-2 h-4 w-4" /> {t("Get irrigation advice")}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to={`/recommend?farm=${farm.id}`}>{t("Crop recommendation")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to={`/disease?farm=${farm.id}`}>{t("Check a plant photo")}</Link>
        </Button>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <Leaf className="h-4 w-4" /> {t("Crops here")}
            </h2>
            <Button size="sm" variant="outline" onClick={() => setCropOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" /> {t("Add")}
            </Button>
          </div>
          {crops.length ? (
            <ul className="mt-4 space-y-3">
              {crops.map((crop) => (
                <li key={crop.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{t(crop.crop_name)}</p>
                    <Pill tone={crop.status === "active" ? "ok" : "neutral"}>{t(crop.status)}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(GROWTH_STAGES.find((stage) => stage.value === crop.growth_stage)?.label || "Stage not set")}
                    {crop.planting_date ? ` · ${t("planted {date}", { date: formatDate(crop.planting_date) })}` : ""}
                    {crop.variety ? ` · ${crop.variety}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("Nothing planted here yet in the app.")}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <FlaskConical className="h-4 w-4" /> {t("Recent soil samples")}
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/soil">{t("All samples")}</Link>
            </Button>
          </div>
          {samples.length ? (
            <ul className="mt-4 space-y-3">
              {samples.map((sample) => (
                <li key={sample.id} className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                  <p className="text-sm text-foreground">{formatDate(sample.sampled_on)}</p>
                  <p className="mt-1 font-mono">
                    N {sample.nitrogen_kg_ha ?? "—"} · P {sample.phosphorus_kg_ha ?? "—"} · K {sample.potassium_kg_ha ?? "—"} · pH{" "}
                    {sample.ph ?? "—"} ·{" "}
                    {sample.moisture_percent === null || sample.moisture_percent === undefined
                      ? t("Moisture") + " —"
                      : t("{value}% moisture", { value: sample.moisture_percent })}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("No soil sample recorded for this farm yet.")}</p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <Radio className="h-4 w-4" /> {t("Devices")}
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/monitoring">{t("Monitoring")}</Link>
            </Button>
          </div>
          {devices.length ? (
            <ul className="mt-4 space-y-3">
              {devices.map((device) => {
                const age = device.last_reading_at
                  ? Math.round((Date.now() - new Date(device.last_reading_at).getTime()) / 60000)
                  : null;
                return (
                  <li key={device.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{device.name || device.device_id}</p>
                      <Pill tone={device.status === "active" && age !== null && age <= 360 ? "ok" : "warning"}>
                        {device.last_reading_at ? freshnessLabel(age) : t("never reported")}
                      </Pill>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(device.sensor_types || [])
                        .map((type) => (SENSOR_META[type] ? t(SENSOR_META[type].label) : type))
                        .join(", ")}
                    </p>
                    {device.last_reading_at ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("Last reading")} {formatDateTime(device.last_reading_at)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("No sensor device is registered for this farm.")}</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <BellRing className="h-4 w-4" /> {t("Unresolved alerts")}
            </h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/alerts">{t("All alerts")}</Link>
            </Button>
          </div>
          {alerts.length ? (
            <ul className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id} className="rounded-xl border border-border p-3">
                  <Pill tone={alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "info"}>
                    {t(alert.severity)}
                  </Pill>
                  <p className="mt-2 text-sm text-foreground">{alert.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("Nothing needs attention on this farm right now.")}</p>
          )}
        </div>
      </section>

      <FarmFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        farm={farm}
        onSubmit={handleEdit}
        saving={busy}
      />

      <CropFormDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        farms={[farm]}
        defaultFarmId={farm.id}
        onSubmit={handleAddCrop}
        saving={busy}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete {name}?", { name: farm.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "This also removes the crop records, soil samples, devices, readings, alerts, recommendations and photo analyses stored for this farm. It cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep farm")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy}>
              {busy ? t("Removing…") : t("Delete farm and its records")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}