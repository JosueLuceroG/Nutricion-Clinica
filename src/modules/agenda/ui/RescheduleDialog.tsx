import * as React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import type { TimeSlot } from "../application";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  patientName: string;
  onSubmit: (id: string, date: string, startTime: string, endTime: string) => Promise<void>;
  loadAvailableSlots?: (date: string, slotDurationMin?: number) => Promise<TimeSlot[]>;
}

export function RescheduleDialog({
  open,
  onOpenChange,
  appointmentId,
  patientName,
  onSubmit,
  loadAvailableSlots,
}: RescheduleDialogProps) {
  const { t } = useTranslation();
  const [date, setDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("09:30");
  const [submitting, setSubmitting] = React.useState(false);
  const [slots, setSlots] = React.useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("09:30");
    }
  }, [open]);

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
    loadAvailableSlots(date, 30)
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
  }, [open, date, loadAvailableSlots]);

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(appointmentId, date, startTime, endTime);
      onOpenChange(false);
    } catch {
      // error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("agenda.reschedule_title")}</DialogTitle>
          <DialogDescription>
            {t("agenda.reschedule_desc", { patient: patientName })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="reschedule-date">{t("common.date")}</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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
                    const selected = startTime === slot.startTime && endTime === slot.endTime;
                    return (
                      <Button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className="justify-center"
                        disabled={!slot.available}
                        aria-label={
                          slot.available
                            ? t("agenda.select_slot", { start: slot.startTime, end: slot.endTime })
                            : t("agenda.slot_unavailable", { start: slot.startTime, end: slot.endTime })
                        }
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
              <Label htmlFor="reschedule-start">{t("agenda.start_time")}</Label>
              <Input
                id="reschedule-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reschedule-end">{t("agenda.end_time")}</Label>
              <Input
                id="reschedule-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common.saving") : t("agenda.reschedule")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
