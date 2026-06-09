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
import { GoalFormSchema, type GoalFormInput } from "../application/goalFormSchema";
import { GoalTypeLabel, GoalPriorityLabel, GoalSourceLabel, SuccessCriterionLabel } from "../domain/GoalTypes";
import type { Goal } from "../domain/Goal";

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalFormInput) => Promise<void>;
  editingGoal?: Goal | null;
}

export function GoalDialog({ open, onOpenChange, onSubmit, editingGoal }: GoalDialogProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<GoalFormInput>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: {
      patientId: "",
      type: "antropometrico",
      variable: "",
      initialValue: 0,
      initialValueDate: new Date().toISOString().slice(0, 10),
      targetValue: 0,
      unit: "",
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: "",
      criterion: "numerico",
      criterionDetail: "",
      priority: "media",
      source: "clinica",
      reason: "",
      actionPlan: "",
      trackingMetrics: [],
      notes: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      if (editingGoal) {
        const p = editingGoal.toProps();
        form.reset({
          patientId: p.patientId,
          type: p.type,
          variable: p.variable,
          initialValue: p.initialValue,
          initialValueDate: p.initialValueDate,
          targetValue: p.targetValue,
          unit: p.unit,
          startDate: p.startDate,
          targetDate: p.targetDate,
          criterion: p.criterion,
          criterionDetail: p.criterionDetail,
          priority: p.priority,
          source: p.source,
          reason: p.reason,
          actionPlan: p.actionPlan,
          trackingMetrics: p.trackingMetrics,
          notes: p.notes,
        });
      } else {
        form.reset({
          patientId: "",
          type: "antropometrico",
          variable: "",
          initialValue: 0,
          initialValueDate: new Date().toISOString().slice(0, 10),
          targetValue: 0,
          unit: "",
          startDate: new Date().toISOString().slice(0, 10),
          targetDate: "",
          criterion: "numerico",
          criterionDetail: "",
          priority: "media",
          source: "clinica",
          reason: "",
          actionPlan: "",
          trackingMetrics: [],
          notes: "",
        });
      }
    }
  }, [open, editingGoal, form]);

  const handleSubmit = async (data: GoalFormInput) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editingGoal ? t("goals.edit_objective") : t("goals.new_clinical_objective")}</DialogTitle>
          <DialogDescription>
            {t("goals.dialog_description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("common.type")}</Label>
              <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GoalTypeLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{t(`goals.type_${k}`, { defaultValue: v })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variable">{t("goals.variable")}</Label>
              <Input id="variable" {...form.register("variable")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="initialValue">{t("goals.initial_value")}</Label>
              <Input id="initialValue" type="number" step="0.01" {...form.register("initialValue", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetValue">{t("goals.target_value")}</Label>
              <Input id="targetValue" type="number" step="0.01" {...form.register("targetValue", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">{t("goals.unit")}</Label>
              <Input id="unit" {...form.register("unit")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">{t("goals.start_date")}</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetDate">{t("goals.target_date")}</Label>
              <Input id="targetDate" type="date" {...form.register("targetDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("goals.priority")}</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GoalPriorityLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{t(`goals.priority_${k}`, { defaultValue: v })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("goals.criterion")}</Label>
              <Select value={form.watch("criterion")} onValueChange={(v) => form.setValue("criterion", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SuccessCriterionLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{t(`goals.criterion_${k}`, { defaultValue: v })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("goals.origin")}</Label>
              <Select value={form.watch("source")} onValueChange={(v) => form.setValue("source", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GoalSourceLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{t(`goals.source_${k}`, { defaultValue: v })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="criterionDetail">{t("goals.criterion_detail")}</Label>
              <Input id="criterionDetail" {...form.register("criterionDetail")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">{t("goals.reason")}</Label>
            <Textarea id="reason" rows={2} {...form.register("reason")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="actionPlan">{t("goals.action_plan")}</Label>
            <Textarea id="actionPlan" rows={2} {...form.register("actionPlan")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">{t("common.notes")}</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : editingGoal ? t("goals.update") : t("goals.create_goal")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
