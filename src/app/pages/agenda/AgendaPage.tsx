import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, XCircle, CalendarX, User, FileText, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { ScrollArea } from "@components/ui/scroll-area";
import { Separator } from "@components/ui/separator";
import { Badge } from "@components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { AppointmentDialog } from "@modules/agenda/ui/AppointmentDialog";
import { AppointmentCard } from "@modules/agenda/ui/AppointmentCard";
import { useAppointmentsByRange, useCreateAppointment, useCancelAppointment, useMarkNoShow } from "@modules/agenda/ui/useAgendaHooks";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@services/db";
import type { Appointment } from "@modules/agenda/domain/Appointment";
import type { AppointmentStatus } from "@modules/agenda/domain/AppointmentStatus";
import "react-day-picker/style.css";

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

const statusLabelKey: Record<string, string> = {
  scheduled: "agenda.status_scheduled",
  confirmed: "agenda.status_confirmed",
  in_progress: "agenda.status_in_progress",
  completed: "agenda.status_completed",
  cancelled: "agenda.status_cancelled",
  no_show: "agenda.status_no_show",
  rescheduled: "agenda.status_rescheduled",
};

export function AgendaPage() {
  const { t } = useTranslation();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(today);
  const [selectedDate, setSelectedDate] = React.useState(today);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detailTarget, setDetailTarget] = React.useState<Appointment | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);

  const monthStart = toDateStr(startOfMonth(currentMonth));
  const monthEnd = toDateStr(endOfMonth(currentMonth));
  const selectedDayStr = toDateStr(selectedDate);

  const { appointments, loading, refresh } = useAppointmentsByRange(monthStart, monthEnd);
  const { create } = useCreateAppointment();
  const { cancel } = useCancelAppointment();
  const { markNoShow } = useMarkNoShow();

  const patients = useLiveQuery(
    () => db.patients
      .filter((r) => r.deleted_at === null)
      .toArray()
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          name: `${r.first_name} ${r.last_name}`.trim(),
        })),
      ),
    [],
    [],
  );

  const dayAppointments = React.useMemo(
    () => appointments.filter((a) => a.date === selectedDayStr),
    [appointments, selectedDayStr],
  );

  const appointmentCountByDate = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      map.set(a.date, (map.get(a.date) ?? 0) + 1);
    }
    return map;
  }, [appointments]);

  const handleCreate = async (data: Parameters<typeof create>[0]) => {
    await create(data);
    refresh();
  };

  const handleAppointmentClick = (appt: Appointment) => {
    setDetailTarget(appt);
  };

  const handleCancelAppointment = async () => {
    if (!detailTarget) return;
    setDetailBusy(true);
    try {
      await cancel(detailTarget.id, "cancelado por el profesional");
      toast.success(t("agenda.cancelled_success"));
      setDetailTarget(null);
      refresh();
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDetailBusy(false);
    }
  };

  const handleMarkNoShow = async () => {
    if (!detailTarget) return;
    setDetailBusy(true);
    try {
      await markNoShow(detailTarget.id);
      toast.success(t("agenda.no_show_success"));
      setDetailTarget(null);
      refresh();
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDetailBusy(false);
    }
  };

  const modifiers = {
    hasAppointments: (date: Date) => {
      const str = toDateStr(date);
      return (appointmentCountByDate.get(str) ?? 0) > 0;
    },
  };

  const modifiersStyles = {
    hasAppointments: {
      fontWeight: "bold",
      color: "var(--primary)",
    },
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold">{t("agenda.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("common.previous_month")} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(today)}>
            {t("agenda.today")}
          </Button>
          <Button variant="outline" size="icon" aria-label={t("common.next_month")} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" size="icon" aria-label={t("common.refresh")} onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("agenda.new_appointment")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6 lg:flex-row">
        <Card className="w-full lg:w-[400px] lg:shrink-0">
          <CardContent className="p-3">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={es}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="!m-0"
            />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("agenda.loading")}</p>
            ) : dayAppointments.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("agenda.no_appointments")}</p>
                <Button variant="link" onClick={() => setDialogOpen(true)}>
                  {t("agenda.new_appointment")}
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-2">
                  {dayAppointments
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((appt) => {
                      const patient = patients.find((p) => p.id === appt.patientId);
                      return (
                        <AppointmentCard
                          key={appt.id}
                          startTime={appt.startTime}
                          endTime={appt.endTime}
                          patientName={patient?.name ?? t("common.patient")}
                          type={appt.type}
                          status={appt.status as AppointmentStatus}
                          reason={appt.reason}
                          onClick={() => handleAppointmentClick(appt)}
                        />
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedDayStr}
        patients={patients}
        onSubmit={handleCreate}
      />

      <Dialog open={!!detailTarget} onOpenChange={(o) => { if (!o) setDetailTarget(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("agenda.appointment_detail")}</DialogTitle>
            <DialogDescription>
              {detailTarget ? format(new Date(detailTarget.date + "T" + detailTarget.startTime), "PPPP", { locale: es }) : ""}
            </DialogDescription>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{patients.find((p) => p.id === detailTarget.patientId)?.name ?? t("common.patient")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{detailTarget.startTime} - {detailTarget.endTime}</span>
                </div>
                {detailTarget.reason && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{detailTarget.reason}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {t(statusLabelKey[detailTarget.status] ?? detailTarget.status)}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {detailTarget.status !== "cancelled" && detailTarget.status !== "completed" && detailTarget.status !== "no_show" && (
                  <>
                    <Button variant="destructive" size="sm" onClick={handleCancelAppointment} disabled={detailBusy}>
                      <XCircle className="mr-1 h-4 w-4" />
                      {t("agenda.cancel_appointment")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleMarkNoShow} disabled={detailBusy}>
                      <CalendarX className="mr-1 h-4 w-4" />
                      {t("agenda.mark_no_show")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
