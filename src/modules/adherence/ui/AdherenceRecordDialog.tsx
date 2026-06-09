import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { AdherenceFormSchema, type AdherenceFormInput } from "../application/adherenceFormSchema";
import { AdherenceSourceLabel } from "../domain/AdherenceTypes";
import { Badge } from "@components/ui/badge";

interface AdherenceRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSubmit: (data: AdherenceFormInput) => Promise<void>;
}

function ScoreSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant={value >= 80 ? "success" : value >= 60 ? "warning" : "destructive"} className="text-xs">
          {value}
        </Badge>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  );
}

export function AdherenceRecordDialog({ open, onOpenChange, patientId, onSubmit }: AdherenceRecordDialogProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<AdherenceFormInput>({
    resolver: zodResolver(AdherenceFormSchema),
    defaultValues: {
      patientId,
      date: new Date().toISOString().slice(0, 10),
      source: "consulta",
      adherenceMenu: 0,
      adherenceWater: 0,
      adherenceActivity: 0,
      adherenceSupplements: 0,
      adherenceSleep: 0,
      notes: "",
      barriers: "",
      facilitators: "",
      intercurrentEvents: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        patientId,
        date: new Date().toISOString().slice(0, 10),
        source: "consulta",
        adherenceMenu: 0,
        adherenceWater: 0,
        adherenceActivity: 0,
        adherenceSupplements: 0,
        adherenceSleep: 0,
        notes: "",
        barriers: "",
        facilitators: "",
        intercurrentEvents: "",
      });
    }
  }, [open, patientId, form]);

  const handleSubmit = async (data: AdherenceFormInput) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const scores = [
    { key: "adherenceMenu" as const, label: t("adherence.score_menu") },
    { key: "adherenceWater" as const, label: t("adherence.score_water") },
    { key: "adherenceActivity" as const, label: t("adherence.score_activity") },
    { key: "adherenceSupplements" as const, label: t("adherence.score_supplements") },
    { key: "adherenceSleep" as const, label: t("adherence.score_sleep") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{t("adherence.record_title")}</DialogTitle>
          <DialogDescription>
            {t("adherence.record_desc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">{t("common.date")}</Label>
              <Input id="date" type="date" {...form.register("date")} />
            </div>
            <div className="grid gap-2">
              <Label>{t("adherence.source")}</Label>
              <Select value={form.watch("source")} onValueChange={(v) => form.setValue("source", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AdherenceSourceLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{t(`adherence.source_${k}`, { defaultValue: v })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {scores.map((s) => (
            <ScoreSlider
              key={s.key}
              label={s.label}
              value={form.watch(s.key)}
              onChange={(v) => form.setValue(s.key, v, { shouldValidate: true })}
            />
          ))}

          <div className="grid gap-2">
            <Label htmlFor="barriers">{t("adherence.barriers")}</Label>
            <Textarea id="barriers" rows={2} {...form.register("barriers")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="facilitators">{t("adherence.facilitators")}</Label>
            <Textarea id="facilitators" rows={2} {...form.register("facilitators")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="intercurrentEvents">{t("adherence.intercurrent_events")}</Label>
            <Textarea id="intercurrentEvents" rows={2} {...form.register("intercurrentEvents")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">{t("common.notes")}</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : t("adherence.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
