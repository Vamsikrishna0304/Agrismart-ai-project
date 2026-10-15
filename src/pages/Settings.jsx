import React, { useEffect, useState } from "react";
import { CloudSun, Database, Lock, Plus, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { auditedCreate, auditedUpdate } from "@/lib/audit";
import PageHeader from "@/components/common/PageHeader";
import Pill from "@/components/common/Pill";
import ThresholdFormDialog from "@/components/settings/ThresholdFormDialog";
import DigestCard from "@/components/settings/DigestCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { INTEGRATION_STATE_META, formatDateTime } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

const NOTE_BLOCKS = [
  {
    Icon: Database,
    title: "Where the data lives",
    body: "Farms, crops, soil samples, devices, readings, alerts, recommendations, photo analyses and chat messages are stored as records in this app's own database, written and read through validated server endpoints. Nothing is kept in the browser.",
  },
  {
    Icon: ShieldCheck,
    title: "Validation and access",
    body: "Numeric ranges are checked on the server before anything is stored, device posts must present a token that only exists server-side, and plant photos are held privately and opened through short-lived signed links. This app is currently in public mode, so anyone who opens it can see and edit the farm records in it — switching the app to private mode with sign-in roles is what would separate one farmer's records from another's.",
  },
  {
    Icon: Lock,
    title: "What is never done",
    body: "No pump or valve is ever switched, no chemical dose is ever suggested, and no simulated reading is ever shown as a measurement. Every result carries a label saying how it was produced.",
  },
];

export default function Settings() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [rules, setRules] = useState([]);
  const [settings, setSettings] = useState([]);
  const [firstFarm, setFirstFarm] = useState(null);
  const [checkingWeather, setCheckingWeather] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [probe, setProbe] = useState(null);

  async function load() {
    const [rulePage, settingPage, farmPage] = await Promise.all([
      base44.entities.IrrigationRule.filter({}, { sort: "crop_name", limit: 50 }),
      base44.entities.IntegrationSetting.list("-label", 20),
      base44.entities.Farm.filter({}, { limit: 1 }),
    ]);
    setRules(rulePage.items || []);
    setSettings(settingPage.items || []);
    setFirstFarm((farmPage.items || [])[0] || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(form) {
    setSaving(true);
    try {
      if (editing) {
        await auditedUpdate("IrrigationRule", editing.id, form, editing);
        toast({ title: t("Thresholds updated") });
      } else {
        await auditedCreate("IrrigationRule", form);
        toast({
          title: t("Thresholds added"),
          description: t("Irrigation rules for {crop} now use your numbers.", { crop: t(form.crop_name) }),
        });
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: t("That did not save"), description: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule) {
    try {
      await auditedUpdate("IrrigationRule", rule.id, { active: !rule.active }, rule);
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: t("Could not change that"), description: error.message });
    }
  }

  async function probeIngestion() {
    try {
      const response = await base44.functions.invoke("ingestReading", {
        device_token: "__status_check__",
        device_id: "__status_check__",
        sensor_type: "soil_moisture",
        value: 50,
      });
      setProbe(response.data.status === "configuration_missing" ? "configuration_missing" : "connected");
    } catch (error) {
      const status = error && error.response ? error.response.status : null;
      setProbe(status === 401 || status === 404 ? "connected" : status === 503 ? "configuration_missing" : null);
    }
  }

  async function checkWeather() {
    if (!firstFarm) {
      toast({
        variant: "destructive",
        title: t("Add a farm first"),
        description: t("Live weather is located from a farm's village or district, so one farm is needed to look it up."),
      });
      return;
    }
    setCheckingWeather(true);
    try {
      const response = await base44.functions.invoke("farmWeather", { farm_id: firstFarm.id });
      const data = response.data || {};
      if (data.status === "ok") {
        toast({
          title: t("Live weather is responding"),
          description: t("{place}: {temp}°C now, {rain} mm of rain expected in the next 24 hours", {
            place: data.place.name,
            temp: data.current.temperature_c,
            rain: data.rain.next_24h_mm,
          }),
        });
      } else {
        toast({ variant: "destructive", title: t("Live weather could not be read"), description: data.error });
      }
    } catch (error) {
      const payload = error && error.response ? error.response.data : null;
      toast({
        variant: "destructive",
        title: t("Live weather could not be read"),
        description: (payload && payload.error) || error.message,
      });
    } finally {
      setCheckingWeather(false);
      await load();
    }
  }

  return (
    <div>
      <PageHeader
        title={t("Settings")}
        description={t(
          "The numbers that drive the irrigation engine, the state of each integration, and how your data is handled."
        )}
      />

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4" /> {t("Irrigation thresholds")}
          </h2>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> {t("Add crop thresholds")}
          </Button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t(
            "When no rule exists for a crop, built-in defaults apply and the decision says so. Rules only change the numbers — the engine stays the same transparent rule set, and the rule version is recorded on every decision."
          )}
        </p>

        {loading ? (
          <div className="mt-4 h-40 animate-pulse rounded-xl bg-muted" />
        ) : rules.length ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Crop")}</TableHead>
                  <TableHead className="text-right">{t("Minimum")}</TableHead>
                  <TableHead className="text-right">{t("Target")}</TableHead>
                  <TableHead className="text-right">{t("Rain skip")}</TableHead>
                  <TableHead className="text-right">{t("Freshness")}</TableHead>
                  <TableHead>{t("Active")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="text-sm">{t(rule.crop_name)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{rule.min_soil_moisture_percent}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{rule.target_soil_moisture_percent ?? "—"}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{rule.rain_skip_mm ?? "—"} mm</TableCell>
                    <TableCell className="text-right font-mono text-xs">{rule.max_reading_age_minutes ?? 360} min</TableCell>
                    <TableCell>
                      <Switch
                        checked={Boolean(rule.active)}
                        onCheckedChange={() => toggleActive(rule)}
                        aria-label={t("Toggle {crop} rule", { crop: t(rule.crop_name) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(rule);
                          setDialogOpen(true);
                        }}
                      >
                        {t("Edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("No custom thresholds yet — the built-in per-crop defaults are being used.")}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <CloudSun className="h-4 w-4" /> {t("Integrations")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("Each integration reports its real state. Nothing here is shown as working when it is not.")}
        </p>

        <ul className="mt-4 space-y-3">
          {settings.map((setting) => {
            const meta = INTEGRATION_STATE_META[setting.state] || INTEGRATION_STATE_META.configuration_missing;
            return (
              <li key={setting.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{setting.label || setting.key}</p>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{setting.detail}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <Pill tone={meta.tone}>{t(meta.label)}</Pill>
                  {setting.checked_at ? (
                    <span className="text-[11px] text-muted-foreground">
                      {t("checked {date}", { date: formatDateTime(setting.checked_at) })}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={checkWeather} disabled={checkingWeather}>
            <CloudSun className="mr-2 h-3.5 w-3.5" /> {t("Check live weather now")}
          </Button>
          <Button variant="outline" size="sm" onClick={probeIngestion}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("Check device ingestion now")}
          </Button>
          {probe ? (
            <Pill tone={INTEGRATION_STATE_META[probe].tone}>
              {probe === "connected" ? t("Device token is set") : t("No device token set")}
            </Pill>
          ) : null}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {t(
            "Live weather is read from MET Norway, which needs no API key: the app reads it whenever a farm is assessed, and the state shown here is what the provider actually answered. Device ingestion still needs an IOT_INGEST_TOKEN secret in the dashboard; until it is set the endpoint reports that configuration is missing, and the app never substitutes demo data for a failed service."
          )}
        </p>
      </section>

      <DigestCard />

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {NOTE_BLOCKS.map(({ Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">{t(title)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
          </div>
        ))}
      </section>

      <ThresholdFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        rule={editing}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}