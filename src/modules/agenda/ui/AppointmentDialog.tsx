import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { APPOINTMENT_TYPES, AppointmentTypeLabel, type AppointmentType } from "../domain/AppointmentType";
import { NewAppointmentFormSchema, type NewAppointmentFormInput } from "../application/agendaFormSchema";
import type { TimeSlot } from "../application";

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  initialPatientId?: string;
  patients: Array<{ id: string; name: string }>;
  onSubmit: (data: NewAppointmentFormInput) => Promise<void>;
  loadAvailableSlots?: (date: string, slotDurationMin?: number) => Promise<TimeSlot[]>;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  selectedDate,
  initialPatientId,
  patients,
  onSubmit,
  loadAvailableSlots,
}: AppointmentDialogProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState(false);
  const [slots, setSlots] = React.useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);
  const form = useForm<NewAppointmentFormInput>({
    resolver: zodResolver(NewAppointmentFormSchema),
    defaultValues: {
      patientId: initialPatientId ?? "",
      date: selectedDate,
      startTime: "09:00",
      endTime: "09:30",
      type: "seguimiento",
      reason: "",
      notes: "",
      cost: 0,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        patientId: initialPatientId ?? "",
        date: selectedDate,
        startTime: "09:00",
        endTime: "09:30",
        type: "seguimiento",
        reason: "",
        notes: "",
        cost: 0,
      });
    }
  }, [open, selectedDate, initialPatientId, form]);

  const appointmentDate = form.watch("date");

  React.useEffect(() => {
    if (!open || !loadAvailableSlots) {
      setSlots([]);
      setSlotsError(null);
      setSlotsLoading(false);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    loadAvailableSlots(appointmentDate, 30)
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setSlots([]);
          setSlotsError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, appointmentDate, loadAvailableSlots]);

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    form.setValue("startTime", slot.startTime, { shouldDirty: true, shouldValidate: true });
    form.setValue("endTime", slot.endTime, { shouldDirty: true, shouldValidate: true });
  };

  const handleSubmit = async (data: NewAppointmentFormInput) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch {
      // error handled by parent; keep the dialog open so the user can adjust the form.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("agenda.new_title")}</DialogTitle>
          <DialogDescription>
            {t("agenda.schedule_desc", { date: appointmentDate })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="patientId">{t("common.patient")}</Label>
            <Select
              value={form.watch("patientId")}
              onValueChange={(v) => form.setValue("patientId", v, { shouldValidate: true })}
            >
              <SelectTrigger id="patientId">
                <SelectValue placeholder={t("agenda.select_patient")} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.patientId && (
              <p className="text-xs text-destructive">{form.formState.errors.patientId.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="appointment-date">{t("common.date")}</Label>
            <Input id="appointment-date" type="date" {...form.register("date")} />
            {form.formState.errors.date && (
              <p className="text-xs text-destructive">{form.formState.errors.date.message}</p>
            )}
          </div>

          {loadAvailableSlots && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t("agenda.available_slots")}</Label>
                <span className="text-xs text-muted-foreground">{t("agenda.slot_duration", { minutes: 30 })}</span>
              </div>
              {slotsLoading ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("agenda.loading_slots")}</p>
              ) : slotsError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{slotsError}</p>
              ) : slots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slots.map((slot) => {
                    const selected = form.watch("startTime") === slot.startTime && form.watch("endTime") === slot.endTime;
                    return (
                      <Button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className="justify-center"
                        disabled={!slot.available}
                        aria-label={slot.available ? t("agenda.select_slot", { start: slot.startTime, end: slot.endTime }) : t("agenda.slot_unavailable", { start: slot.startTime, end: slot.endTime })}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        {slot.startTime} - {slot.endTime}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{t("agenda.no_slots_configured")}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime">{t("agenda.start_time")}</Label>
              <Input id="startTime" type="time" {...form.register("startTime")} />
              {form.formState.errors.startTime && (
                <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime">{t("agenda.end_time")}</Label>
              <Input id="endTime" type="time" {...form.register("endTime")} />
              {form.formState.errors.endTime && (
                <p className="text-xs text-destructive">{form.formState.errors.endTime.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">{t("common.type")}</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v as AppointmentType, { shouldValidate: true })}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder={t("agenda.consultation_type_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{AppointmentTypeLabel[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">{t("agenda.reason")}</Label>
            <Input id="reason" placeholder={t("agenda.reason_placeholder")} {...form.register("reason")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">{t("common.notes")}</Label>
            <Input id="notes" placeholder={t("agenda.notes_placeholder")} {...form.register("notes")} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cost">{t("agenda.cost")}</Label>
            <Input id="cost" type="number" min={0} step={0.01} {...form.register("cost", { valueAsNumber: true })} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : t("agenda.schedule_appointment")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
