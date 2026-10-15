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
import { SOURCE_OPTIONS } from "@/lib/sourceOptions";
import { useI18n } from "@/lib/i18n";

const EMPTY = {
  farm_id: "",
  sampled_on: "",
  nitrogen_kg_ha: "",
  phosphorus_kg_ha: "",
  potassium_kg_ha: "",
  ph: "",
  moisture_percent: "",
  temperature_c: "",
  source: "lab_measured",
  method: "",
  notes: "",
};

const NUMBER_FIELDS = [
  { key: "nitrogen_kg_ha", label: "Nitrogen (kg/ha)", min: 0, max: 400 },
  { key: "phosphorus_kg_ha", label: "Phosphorus (kg/ha)", min: 0, max: 300 },
  { key: "potassium_kg_ha", label: "Potassium (kg/ha)", min: 0, max: 500 },
  { key: "ph", label: "Soil pH", min: 3, max: 10, step: "0.1" },
  { key: "moisture_percent", label: "Moisture (%)", min: 0, max: 100 },
  { key: "temperature_c", label: "Temperature (°C)", min: -10, max: 60 },
];

export default function SoilSampleFormDialog({ open, onOpenChange, sample, farms, defaultFarmId, onSubmit, saving }) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setForm(
      sample
        ? { ...EMPTY, ...sample }
        : { ...EMPTY, sampled_on: today, farm_id: defaultFarmId || (farms[0] ? farms[0].id : "") }
    );
  }, [sample, open, defaultFarmId, farms]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const fieldValue = (key) => (form[key] === null || form[key] === undefined ? "" : form[key]);

  const submit = (event) => {
    event.preventDefault();
    const farm = farms.find((f) => f.id === form.farm_id);
    const payload = { ...form, farm_name: farm ? farm.name : "" };
    for (const field of NUMBER_FIELDS) {
      payload[field.key] = form[field.key] === "" ? undefined : Number(form[field.key]);
    }
    onSubmit(payload);
  };

  const outOfRange = NUMBER_FIELDS.filter((f) => {
    const value = Number(form[f.key]);
    return form[f.key] !== "" && Number.isFinite(value) && (value < f.min || value > f.max);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sample ? t("Edit soil sample") : t("Record a soil sample")}</DialogTitle>
          <DialogDescription>
            {t(
              "Enter the units your lab or kit reported. These are measurements, and they are what the crop recommendation and irrigation advice read from."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("Farm")} *</Label>
              <FarmSelect farms={farms} value={form.farm_id} onChange={(v) => setForm((p) => ({ ...p, farm_id: v }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-date">{t("Sampled on *")}</Label>
              <Input id="soil-date" type="date" value={form.sampled_on} onChange={set("sampled_on")} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {NUMBER_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`soil-${field.key}`}>{t(field.label)}</Label>
                <Input
                  id={`soil-${field.key}`}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step || "1"}
                  value={fieldValue(field.key)}
                  onChange={set(field.key)}
                />
              </div>
            ))}
          </div>

          {outOfRange.length ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {t("Out of the range this record accepts: {fields}. Check the value or the unit you recorded.", {
                fields: outOfRange.map((f) => `${t(f.label)} (${f.min}–${f.max})`).join(", "),
              })}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="soil-source">{t("Where did these numbers come from?")}</Label>
              <select
                id="soil-source"
                value={form.source}
                onChange={set("source")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-method">{t("Method")}</Label>
              <Input id="soil-method" value={form.method} onChange={set("method")} placeholder="Composite of 12 cores, 0–15 cm" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="soil-notes">{t("Notes")}</Label>
            <Textarea id="soil-notes" rows={2} value={form.notes} onChange={set("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={saving || !form.farm_id || !form.sampled_on}>
              {saving ? t("Saving…") : sample ? t("Save changes") : t("Save sample")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}