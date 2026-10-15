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
import { IRRIGATION_TYPES, SOIL_TYPES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const EMPTY = {
  name: "",
  location: "",
  region: "",
  area_hectares: "",
  soil_type: "loamy",
  irrigation_type: "rainfed",
  climate_zone: "",
  notes: "",
};

export default function FarmFormDialog({ open, onOpenChange, farm, onSubmit, saving }) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(farm ? { ...EMPTY, ...farm, area_hectares: farm.area_hectares ?? "" } : EMPTY);
  }, [farm, open]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      area_hectares: form.area_hectares === "" ? undefined : Number(form.area_hectares),
      name: form.name.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{farm ? t("Edit farm") : t("Add a farm")}</DialogTitle>
          <DialogDescription>
            {t("These fields are what you recorded about the land. They are not model output.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="farm-name">{t("Farm name *")}</Label>
            <Input id="farm-name" value={form.name} onChange={set("name")} required placeholder="Sundarpur Farm" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="farm-location">{t("Village / district")}</Label>
              <Input id="farm-location" value={form.location} onChange={set("location")} placeholder="Nashik" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="farm-region">{t("State / region")}</Label>
              <Input id="farm-region" value={form.region} onChange={set("region")} placeholder="Maharashtra" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="farm-area">{t("Area (hectares)")}</Label>
              <Input id="farm-area" type="number" min="0" step="0.1" value={form.area_hectares} onChange={set("area_hectares")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="farm-soil">{t("Soil type")}</Label>
              <select
                id="farm-soil"
                value={form.soil_type}
                onChange={set("soil_type")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SOIL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(type)} {t("soil")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="farm-irrigation">{t("Water source")}</Label>
              <select
                id="farm-irrigation"
                value={form.irrigation_type}
                onChange={set("irrigation_type")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {IRRIGATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="farm-climate">{t("Climate zone (optional)")}</Label>
            <Input id="farm-climate" value={form.climate_zone} onChange={set("climate_zone")} placeholder="Semi-arid" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="farm-notes">{t("Notes")}</Label>
            <Textarea id="farm-notes" rows={3} value={form.notes} onChange={set("notes")} placeholder="Blocks, drainage, anything worth remembering." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? t("Saving…") : farm ? t("Save changes") : t("Add farm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}