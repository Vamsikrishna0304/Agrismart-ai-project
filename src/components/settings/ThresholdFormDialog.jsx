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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CROP_OPTIONS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const EMPTY = {
  crop_name: "",
  min_soil_moisture_percent: "40",
  target_soil_moisture_percent: "60",
  rain_skip_mm: "15",
  critical_offset_percent: "8",
  max_reading_age_minutes: "360",
  active: true,
  notes: "",
};

export default function ThresholdFormDialog({ open, onOpenChange, rule, onSubmit, saving }) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(rule ? { ...EMPTY, ...rule } : EMPTY);
  }, [rule, open]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      min_soil_moisture_percent: Number(form.min_soil_moisture_percent),
      target_soil_moisture_percent: form.target_soil_moisture_percent === "" ? undefined : Number(form.target_soil_moisture_percent),
      rain_skip_mm: form.rain_skip_mm === "" ? undefined : Number(form.rain_skip_mm),
      critical_offset_percent: form.critical_offset_percent === "" ? undefined : Number(form.critical_offset_percent),
      max_reading_age_minutes: form.max_reading_age_minutes === "" ? undefined : Number(form.max_reading_age_minutes),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {rule ? t("Edit thresholds for {crop}", { crop: t(rule.crop_name) }) : t("Add crop thresholds")}
          </DialogTitle>
          <DialogDescription>
            {t("These numbers drive the irrigation rule engine for this crop. They are your settings, not a model's.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-crop">{t("Crop *")}</Label>
            <select
              id="rule-crop"
              value={form.crop_name}
              onChange={set("crop_name")}
              required
              disabled={Boolean(rule)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">{t("Select a crop")}</option>
              {CROP_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {t(name)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-min">{t("Minimum soil moisture (%) *")}</Label>
              <Input id="rule-min" type="number" min="0" max="100" value={form.min_soil_moisture_percent} onChange={set("min_soil_moisture_percent")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-target">{t("Target after watering (%)")}</Label>
              <Input id="rule-target" type="number" min="0" max="100" value={form.target_soil_moisture_percent} onChange={set("target_soil_moisture_percent")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-rain">{t("Skip if rain expected (mm)")}</Label>
              <Input id="rule-rain" type="number" min="0" value={form.rain_skip_mm} onChange={set("rain_skip_mm")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-offset">{t("Critical deficit (points below)")}</Label>
              <Input id="rule-offset" type="number" min="0" max="50" value={form.critical_offset_percent} onChange={set("critical_offset_percent")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rule-age">{t("Freshness limit for readings (minutes)")}</Label>
              <Input id="rule-age" type="number" min="30" max="2880" value={form.max_reading_age_minutes} onChange={set("max_reading_age_minutes")} />
              <p className="text-[11px] text-muted-foreground">
                {t("Readings older than this are treated as stale, and no irrigation instruction is given from them.")}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm text-foreground">{t("Rule active")}</p>
              <p className="text-[11px] text-muted-foreground">{t("Inactive rules are ignored and the defaults apply.")}</p>
            </div>
            <Switch checked={Boolean(form.active)} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-notes">{t("Why you set these numbers")}</Label>
            <Textarea id="rule-notes" rows={2} value={form.notes} onChange={set("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button type="submit" disabled={saving || !form.crop_name}>
              {saving ? t("Saving…") : rule ? t("Save thresholds") : t("Add thresholds")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}