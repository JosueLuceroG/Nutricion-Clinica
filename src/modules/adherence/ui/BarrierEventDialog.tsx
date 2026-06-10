import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { BarrierTypeLabel, BarrierTypeSchema } from "../domain/AdherenceTypes";

const BarrierEventFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: BarrierTypeSchema,
  description: z.string().min(1, "Descripción requerida").max(1000),
  actionTaken: z.string().max(1000).default(""),
});
type BarrierEventFormInput = z.infer<typeof BarrierEventFormSchema>;

interface BarrierEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSubmit: (data: BarrierEventFormInput) => Promise<void>;
}

export function BarrierEventDialog({ open, onOpenChange, patientId: _patientId, onSubmit }: BarrierEventDialogProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<BarrierEventFormInput>({
    resolver: zodResolver(BarrierEventFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      type: "otra",
      description: "",
      actionTaken: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        date: new Date().toISOString().slice(0, 10),
        type: "otra",
        description: "",
        actionTaken: "",
      });
    }
  }, [open, form]);

  const handleSubmit = async (data: BarrierEventFormInput) => {
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("adherence.barrier_title")}</DialogTitle>
          <DialogDescription>
            {t("adherence.barrier_desc")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">{t("common.date")}</Label>
              <Input id="date" type="date" {...form.register("date")} />
            </div>
            <div className="grid gap-2">
              <Label>{t("common.type")}</Label>
              <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BarrierTypeLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{t(`adherence.barrier_type_${k}`, { defaultValue: v })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Textarea id="description" rows={3} {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="actionTaken">{t("adherence.barrier_action")}</Label>
            <Textarea id="actionTaken" rows={2} {...form.register("actionTaken")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : t("adherence.save_barrier")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
