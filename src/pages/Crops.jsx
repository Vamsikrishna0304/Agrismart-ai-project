import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { auditedCreate, auditedUpdate } from "@/lib/audit";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import Pill from "@/components/common/Pill";
import FarmSelect from "@/components/common/FarmSelect";
import CropFormDialog from "@/components/crops/CropFormDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { GROWTH_STAGES, formatDate } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const STATUS_TONE = { active: "ok", harvested: "neutral", failed: "critical" };

export default function Crops() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [farms, setFarms] = useState([]);
  const [crops, setCrops] = useState([]);
  const [farmFilter, setFarmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadFarms() {
    const page = await base44.entities.Farm.filter({}, { sort: "name", limit: 100 });
    setFarms(page.items || []);
  }

  async function loadCrops(farmId, status) {
    setLoading(true);
    const query = {};
    if (farmId && farmId !== "all") query.farm_id = farmId;
    if (status && status !== "all") query.status = status;
    const page = await base44.entities.Crop.filter(query, { sort: "-created_date", limit: 100 });
    setCrops(page.items || []);
    setLoading(false);
  }

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    loadCrops(farmFilter, statusFilter);
  }, [farmFilter, statusFilter]);

  const farmNameById = useMemo(() => {
    const map = {};
    farms.forEach((farm) => {
      map[farm.id] = farm.name;
    });
    return map;
  }, [farms]);

  async function handleSubmit(form) {
    setSaving(true);
    try {
      if (editing) {
        await auditedUpdate("Crop", editing.id, form, editing, {
          farm_id: form.farm_id,
          farm_name: form.farm_name,
        });
        toast({ title: t("Crop record updated") });
      } else {
        await auditedCreate("Crop", form, { farm_id: form.farm_id, farm_name: form.farm_name });
        toast({
          title: t("Crop recorded"),
          description: t("{crop} at {farm}.", { crop: t(form.crop_name), farm: form.farm_name }),
        });
      }
      setDialogOpen(false);
      setEditing(null);
      await loadCrops(farmFilter, statusFilter);
    } catch (error) {
      toast({ variant: "destructive", title: t("That did not save"), description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("Crops")}
        description={t(
          "What is planted where, and how far along it is. Growth stage also decides the irrigation thresholds."
        )}
        actions={
          <Button
            disabled={!farms.length}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> {t("Add crop")}
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="crop-filter-farm">
            {t("Farm")}
          </label>
          <FarmSelect id="crop-filter-farm" farms={farms} value={farmFilter} onChange={setFarmFilter} allowAll />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="crop-filter-status">
            {t("Status")}
          </label>
          <select
            id="crop-filter-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">{t("All statuses")}</option>
            <option value="active">{t("Active")}</option>
            <option value="harvested">{t("Harvested")}</option>
            <option value="failed">{t("Failed")}</option>
          </select>
        </div>
      </div>

      {!farms.length ? (
        <EmptyState
          icon={Leaf}
          title={t("Add a farm first")}
          description={t("Crop records belong to a farm, so create one before planting anything in the app.")}
          action={
            <Button asChild>
              <Link to="/farms">{t("Go to farms")}</Link>
            </Button>
          }
        />
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : crops.length ? (
        <ul className="space-y-3">
          {crops.map((crop) => (
            <li key={crop.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-base font-semibold text-foreground">{t(crop.crop_name)}</h2>
                  <Pill tone={STATUS_TONE[crop.status] || "neutral"}>{t(crop.status)}</Pill>
                  {crop.season ? <Pill tone="neutral">{t(crop.season)}</Pill> : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {crop.farm_name || farmNameById[crop.farm_id] || t("Farm removed")}
                  {crop.variety ? ` · ${crop.variety}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(GROWTH_STAGES.find((stage) => stage.value === crop.growth_stage)?.label || "Stage not set")}
                  {crop.planting_date ? ` · ${t("planted {date}", { date: formatDate(crop.planting_date) })}` : ""}
                  {crop.area_hectares ? ` · ${t("{count} ha", { count: crop.area_hectares })}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(crop);
                    setDialogOpen(true);
                  }}
                >
                  {t("Edit")}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/irrigation?farm=${crop.farm_id}`}>{t("Irrigation advice")}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Leaf}
          title={t("No crop records here yet")}
          description={t(
            "Add the crops on your farm so recommendations, disease checks and irrigation advice can use them."
          )}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> {t("Add crop")}
            </Button>
          }
        />
      )}

      <CropFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        crop={editing}
        farms={farms}
        defaultFarmId={farmFilter !== "all" ? farmFilter : undefined}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}