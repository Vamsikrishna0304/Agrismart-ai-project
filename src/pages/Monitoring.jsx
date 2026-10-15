import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Download, PlugZap, Radio, RefreshCw, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import FarmSelect from "@/components/common/FarmSelect";
import DeviceCard from "@/components/iot/DeviceCard";
import SensorChart from "@/components/iot/SensorChart";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { READING_SOURCE_META, SENSOR_META, SENSOR_TYPES, formatDateTime, freshnessLabel } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { useI18n } from "@/lib/i18n";

const INGEST_STATE_TEXT = {
  configured: {
    tone: "ok",
    label: "Device ingestion configured",
    detail: "A device token is set, so a physical node can post readings.",
  },
  configuration_missing: {
    tone: "warning",
    label: "Device ingestion not configured",
    detail: "No device token is set yet, so only simulated readings can be stored.",
  },
  unknown: { tone: "neutral", label: "Ingestion status unknown", detail: "The status check could not be completed." },
};

export default function Monitoring() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState([]);
  const [sensorType, setSensorType] = useState("soil_moisture");
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState(null);
  const [ingestState, setIngestState] = useState("unknown");

  async function loadFarm(farm) {
    setLoading(true);
    const [devicePage, readingPage] = await Promise.all([
      base44.entities.Device.filter({ farm_id: farm.id }, { limit: 20 }),
      base44.entities.SensorReading.filter({ farm_id: farm.id }, { sort: "-recorded_at", limit: 200 }),
    ]);
    setDevices(devicePage.items || []);
    setReadings(readingPage.items || []);
    setLoading(false);
  }

  useEffect(() => {
    base44.entities.Farm.filter({}, { sort: "name", limit: 100 }).then(async (page) => {
      const items = page.items || [];
      setFarms(items);
      // Open on the farm that actually has sensor data, so the page is never blank by default.
      const newest = await base44.entities.SensorReading.filter({}, { sort: "-recorded_at", limit: 1 });
      const withData = (newest.items || [])[0];
      const preferred = withData && items.some((farm) => farm.id === withData.farm_id) ? withData.farm_id : null;
      setFarmId((current) => current || preferred || (items[0] ? items[0].id : ""));
    });
    base44.entities.IntegrationSetting.filter({ key: "iot_ingestion" }, { limit: 1 }).then((page) => {
      const row = (page.items || [])[0];
      if (row) setIngestState(row.state === "connected" ? "configured" : row.state);
    });
  }, []);

  useEffect(() => {
    const farm = farms.find((item) => item.id === farmId);
    if (!farm) return;
    loadFarm(farm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, farms]);

  const byType = useMemo(() => {
    const grouped = {};
    readings.forEach((reading) => {
      if (!grouped[reading.sensor_type]) grouped[reading.sensor_type] = [];
      grouped[reading.sensor_type].push(reading);
    });
    Object.keys(grouped).forEach((type) => {
      grouped[type].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    });
    return grouped;
  }, [readings]);

  const latestByType = useMemo(() => {
    const latest = {};
    Object.keys(byType).forEach((type) => {
      latest[type] = byType[type][byType[type].length - 1];
    });
    return latest;
  }, [byType]);

  async function handleSimulate(device) {
    setSimulating(true);
    try {
      const response = await base44.functions.invoke("simulateSensors", {
        farm_id: farmId,
        device_id: device.device_id,
        hours: 24,
        interval_minutes: 60,
      });
      const data = response.data || {};
      if (data.status === "ok") {
        toast({
          title: t("{created} simulated readings stored", { created: data.created }),
          description: t("{devices} · labelled as simulated, never as measurements.", {
            devices: (data.devices || []).join(", "),
          }),
        });
        const farm = farms.find((item) => item.id === farmId);
        if (farm) await loadFarm(farm);
      } else {
        toast({ variant: "destructive", title: t("Simulation did not run"), description: data.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: t("Simulation did not run"), description: error.message });
    } finally {
      setSimulating(false);
    }
  }

  async function handleHealthCheck() {
    setChecking(true);
    try {
      const response = await base44.functions.invoke("checkDeviceHealth", { farm_id: farmId });
      const data = response.data || {};
      setHealth(data);
      toast({
        title: t("Device check finished"),
        description: data.message || t("{count} alert(s) raised.", { count: data.alerts_created }),
      });
      const farm = farms.find((item) => item.id === farmId);
      if (farm) await loadFarm(farm);
    } catch (error) {
      toast({ variant: "destructive", title: t("Device check failed"), description: error.message });
    } finally {
      setChecking(false);
    }
  }

  async function exportReadings() {
    const farm = farms.find((item) => item.id === farmId);
    if (!farm) return;
    setExporting(true);
    try {
      const rows = [];
      let nextCursor;
      // Walk every page so the file holds the farm's whole stored history, not only the 200 readings on screen.
      for (let round = 0; round < 40; round += 1) {
        const page = await base44.entities.SensorReading.filter(
          { farm_id: farm.id },
          { sort: "-recorded_at", limit: 200, cursor: nextCursor }
        );
        rows.push(...(page.items || []));
        if (!page.has_more || !page.next_cursor) break;
        nextCursor = page.next_cursor;
      }

      if (!rows.length) {
        toast({ title: t("No readings to export yet"), description: t("Nothing is stored for this farm yet.") });
        return;
      }

      const header = [
        t("Farm"),
        t("Device"),
        t("Sensor"),
        t("Value"),
        t("Unit"),
        t("Recorded at (ISO)"),
        t("Source"),
        t("Validation"),
        t("Notes"),
      ];
      const body = rows.map((reading) => {
        const meta = SENSOR_META[reading.sensor_type];
        const source = READING_SOURCE_META[reading.source] || READING_SOURCE_META.manual;
        return [
          farm.name || "",
          reading.device_id || "",
          meta ? t(meta.label) : reading.sensor_type || "",
          reading.value,
          meta ? meta.unitLabel : reading.unit || "",
          reading.recorded_at || "",
          t(source.label),
          reading.validation_status || "unverified",
          reading.notes || "",
        ];
      });

      const slug =
        (farm.name || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "farm";
      downloadCsv(`agrismart-readings-${slug}-${new Date().toISOString().slice(0, 10)}.csv`, header, body);
      toast({
        title: t("Readings exported"),
        description: t("{count} readings written to the file.", { count: rows.length }),
      });
    } catch (error) {
      toast({ variant: "destructive", title: t("The readings could not be exported"), description: error.message });
    } finally {
      setExporting(false);
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
      setIngestState(response.data.status === "configuration_missing" ? "configuration_missing" : "configured");
    } catch (error) {
      const status = error && error.response ? error.response.status : null;
      if (status === 401 || status === 404) setIngestState("configured");
      else if (status === 503) setIngestState("configuration_missing");
      else setIngestState("unknown");
    }
  }

  const ingest = INGEST_STATE_TEXT[ingestState] || INGEST_STATE_TEXT.unknown;
  const selectedPoints = (byType[sensorType] || []).slice(-24);
  const latest = latestByType[sensorType];

  if (!farms.length) {
    return (
      <div>
        <PageHeader title={t("Sensor monitoring")} description={t("Device registry, stored readings and staleness checks.")} />
        <EmptyState
          icon={Radio}
          title={t("Add a farm first")}
          description={t("Devices and readings belong to a farm.")}
          action={
            <Button asChild>
              <Link to="/farms">{t("Go to farms")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("Sensor monitoring")}
        description={t(
          "Every reading is stored with its device, timestamp and where it came from. Values older than the freshness limit are shown as stale, never as current conditions."
        )}
        actions={
          <>
            <Button variant="outline" onClick={handleHealthCheck} disabled={checking}>
              <Activity className="mr-2 h-4 w-4" />
              {checking ? t("Checking devices…") : t("Check device health")}
            </Button>
            <Button variant="outline" onClick={exportReadings} disabled={exporting || loading || !farmId}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? t("Preparing the file…") : t("Export readings as CSV")}
            </Button>
          </>
        }
      />

      <div className="mb-8 grid gap-3 lg:max-w-md">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="monitor-farm">
            {t("Farm")}
          </label>
          <FarmSelect id="monitor-farm" farms={farms} value={farmId} onChange={setFarmId} />
        </div>
        {health ? (
          <p className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            {health.status === "ok"
              ? t("{stale} of {checked} device(s) have stale or missing readings.", {
                  stale: (health.stale || []).length,
                  checked: health.checked,
                })
              : health.message}
            {health.stale_minutes
              ? ` ${t("Freshness limit: {minutes} minutes.", { minutes: health.stale_minutes })}`
              : ""}
          </p>
        ) : null}
      </div>

      <section>
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{t("Registered devices")}</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((key) => (
              <div key={key} className="h-56 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : devices.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} onSimulate={handleSimulate} simulating={simulating} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Radio}
            title={t("No devices registered for this farm")}
            description={t(
              "A device is the source of sensor readings. Without one, only hand-entered soil values are available."
            )}
          />
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">{t("Stored readings")}</h2>
          <div className="flex flex-wrap gap-2">
            {SENSOR_TYPES.map((type) => (
              <Button
                key={type}
                size="sm"
                variant={sensorType === type ? "default" : "outline"}
                onClick={() => setSensorType(type)}
              >
                {t(SENSOR_META[type].label)}
              </Button>
            ))}
          </div>
        </div>

        {latest ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("Newest {label}", { label: t(SENSOR_META[sensorType].label) })}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold text-foreground">
                  {latest.value}
                  <span className="ml-1 text-sm text-muted-foreground">{SENSOR_META[sensorType].unitLabel}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pill tone={(READING_SOURCE_META[latest.source] || READING_SOURCE_META.manual).tone}>
                    {t((READING_SOURCE_META[latest.source] || READING_SOURCE_META.manual).label)}
                  </Pill>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(latest.recorded_at)} ·{" "}
                    {freshnessLabel(Math.round((Date.now() - new Date(latest.recorded_at).getTime()) / 60000))}
                  </span>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {t((READING_SOURCE_META[latest.source] || READING_SOURCE_META.manual).note)}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {t("Last {count} readings", { count: selectedPoints.length })}
                  </p>
                  <ProvenanceBadge kind="measured" label="Stored series" />
                </div>
                <SensorChart sensorType={sensorType} points={selectedPoints} />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Recorded")}</TableHead>
                    <TableHead>{t("Device")}</TableHead>
                    <TableHead className="text-right">{t("Value")}</TableHead>
                    <TableHead>{t("Source")}</TableHead>
                    <TableHead>{t("Validation")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings
                    .filter((reading) => reading.sensor_type === sensorType)
                    .slice(0, 10)
                    .map((reading) => {
                      const source = READING_SOURCE_META[reading.source] || READING_SOURCE_META.manual;
                      return (
                        <TableRow key={reading.id}>
                          <TableCell className="whitespace-nowrap text-xs">{formatDateTime(reading.recorded_at)}</TableCell>
                          <TableCell className="font-mono text-xs">{reading.device_id}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {reading.value} {SENSOR_META[reading.sensor_type]?.unitLabel}
                          </TableCell>
                          <TableCell>
                            <Pill tone={source.tone}>{t(source.label)}</Pill>
                          </TableCell>
                          <TableCell className="text-xs capitalize text-muted-foreground">
                            {t(reading.validation_status || "unverified")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Activity}
            title={t("No {sensor} readings stored", { sensor: t(SENSOR_META[sensorType].label) })}
            description={t(
              "Generate a simulated day from a device above, or post a real reading from a physical device."
            )}
          />
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <PlugZap className="h-4 w-4" /> {t("Physical device ingestion")}
          </h2>
          <Pill tone={ingest.tone}>{t(ingest.label)}</Pill>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(ingest.detail)}</p>

        <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4">
          <p className="text-xs font-medium text-foreground">{t("How an ESP32 or ESP8266 node posts a reading")}</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0b2a1f] p-3 text-[11px] leading-relaxed text-emerald-50">
{`POST /functions/ingestReading
Content-Type: application/json

{
  "device_token": "<the token set in app environment variables>",
  "device_id": "AGRI-NODE-01",
  "sensor_type": "soil_moisture",
  "value": 41.5,
  "recorded_at": "2026-10-12T06:30:00Z"
}`}
          </pre>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-muted-foreground">
            <li>{t("The token is a server-side secret. It is never placed in the browser or in this app's code.")}</li>
            <li>{t("The device must already be registered, and the sensor type must be one it is registered for.")}</li>
            <li>{t("Values outside the valid range for that sensor are rejected with the reason, not stored.")}</li>
            <li>{t("MQTT is not bridged yet; an HTTP post is the working path today.")}</li>
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={probeIngestion}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("Check ingestion status")}
          </Button>
          <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("Device credentials are never exposed to the browser.")}
          </p>
        </div>
      </section>
    </div>
  );
}