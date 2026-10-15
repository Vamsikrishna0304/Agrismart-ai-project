import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, MapPin, Plus, Sprout } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { auditedCreate, auditedUpdate } from "@/lib/audit";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import Pill from "@/components/common/Pill";
import FarmFormDialog from "@/components/farms/FarmFormDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export default function Farms() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [farms, setFarms] = useState([]);
  const [cropCounts, setCropCounts] = useState({});
  const [alertCounts, setAlertCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [farmPage, cropAgg, alertAgg] = await Promise.all([
      base44.entities.Farm.filter({}, { sort: "-created_date", limit: 50 }),
      base44.entities.Crop.aggregate({ groupBy: "farm_id" }),
      base44.entities.Alert.aggregate({ query: { status: "open" }, groupBy: "farm_id" }),
    ]);

    const nextCropCounts = {};
    (cropAgg.rows || []).forEach((row) => {
      nextCropCounts[row.farm_id] = row.count;
    });
    const nextAlertCounts = {};
    (alertAgg.rows || []).forEach((row) => {
      nextAlertCounts[row.farm_id] = row.count;
    });

    setFarms(farmPage.items || []);
    setCropCounts(nextCropCounts);
    setAlertCounts(nextAlertCounts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(form) {
    setSaving(true);
    try {
      if (editing) {
        await auditedUpdate("Farm", editing.id, form, editing);
        toast({ title: t("Farm updated") });
      } else {
        await auditedCreate("Farm", form);
        toast({ title: t("Farm added"), description: t("{name} is ready for crop and soil records.", { name: form.name }) });
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

  return (
    <div>
      <PageHeader
        title={t("Farms")}
        description={t("The land you manage. Every crop, soil sample and device hangs off one of these records.")}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> {t("Add farm")}
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((key) => (
            <div key={key} className="h-48 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : farms.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {farms.map((farm) => (
            <article key={farm.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-foreground">{farm.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {[farm.location, farm.region].filter(Boolean).join(", ") || t("Location not recorded")}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Sprout className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {farm.area_hectares ? <Pill tone="neutral">{t("{count} ha", { count: farm.area_hectares })}</Pill> : null}
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
                {alertCounts[farm.id] ? (
                  <Pill tone="critical">{t("{count} open alert(s)", { count: alertCounts[farm.id] })}</Pill>
                ) : null}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {t("{count} crop record(s) · added {date}", {
                  count: cropCounts[farm.id] || 0,
                  date: formatDate(farm.created_date),
                })}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to={`/farms/${farm.id}`}>
                    {t("Open farm")} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(farm);
                    setDialogOpen(true);
                  }}
                >
                  {t("Edit")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Sprout}
          title={t("No farms yet")}
          description={t("Add your first farm so crops, soil samples and sensors have somewhere to live.")}
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("Add farm")}
            </Button>
          }
        />
      )}

      <FarmFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        farm={editing}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}