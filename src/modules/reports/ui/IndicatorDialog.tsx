import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Loader2 } from "lucide-react";
import type { Indicator, IndicatorProps } from "../domain/Indicator";
import type { IndicatorCategory, IndicatorCalculationType, IndicatorRefreshFrequency } from "../domain/Indicator";
import type { ReportService } from "./useReportHooks";

interface IndicatorDialogProps {
  service: ReportService;
  indicator?: Indicator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function IndicatorDialog({ service, indicator, open, onOpenChange, onSaved }: IndicatorDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(indicator?.name ?? "");
  const [description, setDescription] = React.useState(indicator?.description ?? "");
  const [category, setCategory] = React.useState<IndicatorCategory>(indicator?.category ?? "consultas");
  const [unit, setUnit] = React.useState(indicator?.unit ?? "");
  const [calculationType, setCalculationType] = React.useState<IndicatorCalculationType>(indicator?.calculationType ?? "count");
  const [refreshFrequency, setRefreshFrequency] = React.useState<IndicatorRefreshFrequency>(indicator?.refreshFrequency ?? "monthly");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(indicator?.name ?? "");
      setDescription(indicator?.description ?? "");
      setCategory(indicator?.category ?? "consultas");
      setUnit(indicator?.unit ?? "");
      setCalculationType(indicator?.calculationType ?? "count");
      setRefreshFrequency(indicator?.refreshFrequency ?? "monthly");
    }
  }, [open, indicator]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const base = { name, description, category, unit, calculationType, refreshFrequency };
      if (indicator) {
        await service.updateIndicator(indicator.id, base as Partial<IndicatorProps>);
      } else {
        await service.createIndicator(base as Omit<IndicatorProps, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean });
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!indicator) return;
    setSaving(true);
    try {
      await service.deleteIndicator(indicator.id);
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {indicator ? t("reports.edit_indicator") : t("reports.new_indicator")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("reports.column_title")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("reports.column_title")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">{t("reports.description_label")}</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("reports.category_label")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IndicatorCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultas">Consultas</SelectItem>
                  <SelectItem value="adherencia">Adherencia</SelectItem>
                  <SelectItem value="patologias">Patologías</SelectItem>
                  <SelectItem value="financiero">Financiero</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("reports.unit_label")}</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ej. %, kg, veces" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("reports.calculation_type")}</Label>
              <Select value={calculationType} onValueChange={(v) => setCalculationType(v as IndicatorCalculationType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="avg">Avg</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="ratio">Ratio</SelectItem>
                  <SelectItem value="formula">Formula</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("reports.refresh_frequency")}</Label>
              <Select value={refreshFrequency} onValueChange={(v) => setRefreshFrequency(v as IndicatorRefreshFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {indicator ? (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("reports.delete")}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
