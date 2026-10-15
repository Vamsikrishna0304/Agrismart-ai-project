import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { auditedCreate, auditedUpdate } from "@/lib/audit";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import Pill from "@/components/common/Pill";
import ProvenanceBadge from "@/components/common/ProvenanceBadge";
import FarmSelect from "@/components/common/FarmSelect";
import SoilSampleFormDialog from "@/components/soil/SoilSampleFormDialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/constants";
import { SOURCE_LABELS } from "@/lib/sourceOptions";
import { useI18n } from "@/lib/i18n";

function value(cell) {
  return cell === null || cell === undefined || cell === "" ? "—" : cell;
}

export default function Soil() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [farms, setFarms] = useState([]);
  const [samples, setSamples] = useState([]);
  const [farmFilter, setFarmFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadFarms() {
    const page = await base44.entities.Farm.filter({}, { sort: "name", limit: 100 });
    setFarms(page.items || []);
  }

  async function loadSamples(farmId) {
    setLoading(true);
    const query = farmId && farmId !== "all" ? { farm_id: farmId } : {};
    const page = await base44.entities.SoilSample.filter(query, { sort: "-sampled_on", limit: 100 });
    setSamples(page.items || []);
    setLoading(false);
  }

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    loadSamples(farmFilter);
  }, [farmFilter]);

  async function handleSubmit(form) {
    setSaving(true);
    try {
      if (editing) {
        await auditedUpdate("SoilSample", editing.id, form, editing, {
          farm_id: form.farm_id,
          farm_name: form.farm_name,
        });
        toast({ title: t("Soil sample updated") });
      } else {
        await auditedCreate("SoilSample", form, { farm_id: form.farm_id, farm_name: form.farm_name });
        toast({
          title: t("Soil sample saved"),
          description: t("Crop recommendation and irrigation rules can use it now."),
        });
      }
      setDialogOpen(false);
      setEditing(null);
      await loadSamples(farmFilter);
    } catch (error) {
      toast({ variant: "destructive", title: t("That did not save"), description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("Soil samples")}
        description={t(
          "Your measured values — nitrogen, phosphorus, potassium, pH, moisture and temperature — with the unit each number is in."
        )}
        actions={
          <Button
            disabled={!farms.length}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> {t("Record sample")}
          </Button>
        }
      />

      <div className="mb-6 lg:max-w-xs">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="soil-filter-farm">
          {t("Farm")}
        </label>
        <FarmSelect id="soil-filter-farm" farms={farms} value={farmFilter} onChange={setFarmFilter} allowAll />
      </div>

      {!farms.length ? (
        <EmptyState
          icon={FlaskConical}
          title={t("Add a farm first")}
          description={t("A soil sample is recorded against a farm.")}
          action={
            <Button asChild>
              <Link to="/farms">{t("Go to farms")}</Link>
            </Button>
          }
        />
      ) : loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : samples.length ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Sampled")}</TableHead>
                <TableHead>{t("Farm")}</TableHead>
                <TableHead className="text-right">N</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">K</TableHead>
                <TableHead className="text-right">pH</TableHead>
                <TableHead className="text-right">{t("Moisture")}</TableHead>
                <TableHead>{t("Source")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((sample) => {
                const source = SOURCE_LABELS[sample.source] || SOURCE_LABELS.estimated;
                return (
                  <TableRow key={sample.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(sample.sampled_on)}</TableCell>
                    <TableCell className="text-sm">{sample.farm_name || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{value(sample.nitrogen_kg_ha)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{value(sample.phosphorus_kg_ha)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{value(sample.potassium_kg_ha)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{value(sample.ph)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {sample.moisture_percent === null || sample.moisture_percent === undefined
                        ? "—"
                        : `${sample.moisture_percent}%`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <ProvenanceBadge kind={sample.source === "estimated" ? "modelled" : "measured"} />
                        <span className="text-[11px] text-muted-foreground">{t(source.label)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(sample);
                          setDialogOpen(true);
                        }}
                      >
                        {t("Edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={FlaskConical}
          title={t("No soil samples stored")}
          description={t(
            "Record a lab report or a field kit reading — the crop recommendation and irrigation rules read these numbers."
          )}
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("Record sample")}
            </Button>
          }
        />
      )}

      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ProvenanceBadge kind="measured" />
        {t(
          "N, P, K in kg/ha · moisture in per cent of volume · temperature in °C · values you marked as estimated are labelled as estimates, not measurements."
        )}
      </p>

      <SoilSampleFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        sample={editing}
        farms={farms}
        defaultFarmId={farmFilter !== "all" ? farmFilter : undefined}
        onSubmit={handleSubmit}
        saving={saving}
      />
    </div>
  );
}