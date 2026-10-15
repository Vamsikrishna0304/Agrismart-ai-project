import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FarmSelect from "@/components/common/FarmSelect";
import { CROP_OPTIONS, GROWTH_STAGES, SEASONS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const EMPTY = {
  farm_id: "",
  crop_name: "",
  variety: "",
  season: "kharif",
  planting_date: "",
  growth_stage: "sowing",
  area_hectares: "",
  expected_harvest_date: "",
  status: "active",
  notes: "",
};

export default function CropFormDialog({ open, onOpenChange, crop, farms, defaultFarmId, onSubmit, saving }) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      crop
        ? { ...EMPTY, ...crop, area_hectares: crop.area_hectares ?? "" }
        : { ...EMPTY, farm_id: defaultFarmId || (farms[0] ? farms[0].id : "") }
    );
  }, [crop, open, defaultFarmId, farms]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    const farm = farms.find((f) => f.id === form.farm_id);
    onSubmit({
      ...form,
      farm_name: farm ? farm.name : "",
      area_hectares: form.area_hectares === "" ? undefined : Number(form.area_hectares),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{crop ? t("Edit crop record") : t("Add a crop record")}</DialogTitle>
          <DialogDescription>
            {t("What was planted, where, and how far along it is. These are your own records.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("Farm")} *</Label>
            <FarmSelect farms={farms} value={form.farm_id} onChange={(v) => setForm((p) => ({ ...p, farm_id: v }))} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crop-name">{t("Crop *")}</Label>
              <select
                id="crop-name"
                value={form.crop_name}
                onChange={set("crop_name")}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t("Select a crop")}</option>
                {CROP_OPTIONS.map((name) => (
                  <option key={name} value={name}>
                    {t(name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-variety">{t("Variety")}</Label>
              <Input id="crop-variety" value={form.variety} onChange={set("variety")} placeholder="Pusa Ruby" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crop-season">{t("Season")}</Label>
              <select
                id="crop-season"
                value={form.season}
                onChange={set("season")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SEASONS.map((season) => (
                  <option key={season} value={season}>
                    {t(season)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-stage">{t("Growth stage")}</Label>
              <select
                id="crop-stage"
                value={form.growth_stage}
                onChange={set("growth_stage")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {GROWTH_STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {t(stage.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crop-planting">{t("Planting date")}</Label>
              <Input id="crop-planting" type="date" value={form.planting_date || ""} onChange={set("planting_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-harvest">{t("Expected harvest")}</Label>
              <Input id="crop-harvest" type="date" value={form.expected_harvest_date || ""} onChange={set("expected_harvest_date")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="crop-area">{t("Area (hectares)")}</Label>
              <Input id="crop-area" type="number" min="0" step="0.1" value={form.area_hectares} onChange={set("area_hectares")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-status">{t("Status")}</Label>
              <select
                id="crop-status"
                value={form.status}
                onChange={set("status")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">{t("Active")}</option>
                <option value="harvested">{t("Harvested")}</option>
                <option value="failed">{t("Failed")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="crop-notes">{t("Notes")}</Label>
            <Textarea id="crop-notes" rows={2} value={form.notes} onChange={set("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={saving || !form.farm_id || !form.crop_name}>
              {saving ? t("Saving…") : crop ? t("Save changes") : t("Add crop")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}