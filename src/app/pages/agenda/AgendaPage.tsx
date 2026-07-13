import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, XCircle, CalendarX,
  User, FileText, Clock, Settings, CheckCircle2, RotateCcw, Stethoscope,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { AvailabilityDialog } from "@modules/agenda/ui/AvailabilityDialog";
import { WeekView } from "@modules/agenda/ui/WeekView";
import { ListView } from "@modules/agenda/ui/ListView";
import { RescheduleDialog } from "@modules/agenda/ui/RescheduleDialog";
import {
  useAppointmentsByRange, useCreateAppointment, useAvailableSlots,
  useCancelAppointment, useMarkNoShow, useConfirmAppointment,
  useCompleteAppointment, useRescheduleAppointment,
} from "@modules/agenda/ui/useAgendaHooks";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@services/db";
import type { Appointment } from "@modules/agenda/domain/Appointment";
import type { AppointmentStatus } from "@modules/agenda/domain/AppointmentStatus";
import { appointmentIdFromUnsafe } from "@modules/agenda/domain/AppointmentId";
import "react-day-picker/style.css";

type AgendaView = "day" | "week" | "list";

function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseDateStr(value: string | null): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return toDateStr(date) === value ? date : null;
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date();
  const requestedDate = parseDateStr(searchParams.get("date"));
  const initialDate = requestedDate ?? today;
  const [currentMonth, setCurrentMonth] = React.useState(initialDate);
  const [selectedDate, setSelectedDate] = React.useState(initialDate);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [availabilityOpen, setAvailabilityOpen] = React.useState(false);
  const [detailTarget, setDetailTarget] = React.useState<Appointment | null>(null);
  const [detailBusy, setDetailBusy] = React.useState(false);
  const [view, setView] = React.useState<AgendaView>("day");
  const [statusFilter, setStatusFilter] = React.useState<AppointmentStatus | "">("");
  const [rescheduleTarget, setRescheduleTarget] = React.useState<Appointment | null>(null);

  const monthStart = toDateStr(startOfMonth(currentMonth));
  const monthEnd = toDateStr(endOfMonth(currentMonth));
  const selectedDayStr = toDateStr(selectedDate);

  const { appointments, loading, refresh } = useAppointmentsByRange(monthStart, monthEnd);
  const { create } = useCreateAppointment();
  const { load: loadAvailableSlots } = useAvailableSlots();
  const { cancel } = useCancelAppointment();
  const { markNoShow } = useMarkNoShow();
  const { confirm } = useConfirmAppointment();
  const { complete } = useCompleteAppointment();
  const { reschedule } = useRescheduleAppointment();

  React.useEffect(() => {
    const date = parseDateStr(searchParams.get("date"));
    if (!date) return;
    setSelectedDate(date);
    setCurrentMonth(date);
    setView("day");
  }, [searchParams]);

  React.useEffect(() => {
    const appointmentId = searchParams.get("appointmentId");
    if (!appointmentId || loading) return;
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    setDetailTarget(appointment);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("appointmentId");
    setSearchParams(nextParams, { replace: true });
  }, [appointments, loading, searchParams, setSearchParams]);

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
    try {
      await create(data);
      toast.success(t("agenda.created_success"));
      await refresh();
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };

  const handleAppointmentClick = (appt: Appointment) => {
    setDetailTarget(appt);
  };

  const handleConfirm = async () => {
    if (!detailTarget) return;
    setDetailBusy(true);
    try {
      await confirm(detailTarget.id);
      toast.success(t("agenda.confirm_success"));
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

  const handleComplete = async () => {
    if (!detailTarget) return;
    setDetailBusy(true);
    try {
      await complete(detailTarget.id);
      toast.success(t("agenda.complete_success"));
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

  const handleStartConsultation = () => {
    if (!detailTarget) return;
    const params = new URLSearchParams({
      appointmentId: detailTarget.id,
      reason: detailTarget.reason,
      appointmentDate: detailTarget.date,
    });
    navigate(`/pacientes/${detailTarget.patientId}/consultas/nueva?${params.toString()}`);
  };

  const handleReschedule = async (id: string, date: string, startTime: string, endTime: string) => {
    await reschedule(appointmentIdFromUnsafe(id), { date, startTime, endTime });
    toast.success(t("agenda.reschedule_success"));
    setDetailTarget(null);
    setRescheduleTarget(null);
    refresh();
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

  const canModify = (status: string) =>
    status !== "cancelled" && status !== "completed" && status !== "no_show";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-xl font-semibold">{t("agenda.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentMonth, "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex items-center rounded-md border p-0.5">
            {(["day", "week", "list"] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setView(v)}
              >
                {t(v === "list" ? "agenda.view_list" : `agenda.${v}`)}
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <Button variant="outline" size="icon" aria-label={t("common.previous_month")} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(today)}>
            {t("agenda.today")}
          </Button>
          <Button variant="outline" size="icon" aria-label={t("common.next_month")} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <Button variant="outline" size="icon" aria-label={t("common.refresh")} onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAvailabilityOpen(true)}>
            <Settings className="mr-1 h-4 w-4" />
            {t("agenda.availability")}
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("agenda.new_appointment")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6 lg:flex-row lg:overflow-hidden">
        <Card className="w-full lg:w-[400px] lg:shrink-0">
          <CardContent className="overflow-x-auto p-3">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={es}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="!m-0 min-w-max sm:min-w-0"
            />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {view === "week" && (
                <span>
                  {format(startOfMonth(currentMonth), "MMMM yyyy", { locale: es })}
                </span>
              )}
              {view === "list" && t("agenda.view_list")}
              {view === "day" && format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("agenda.loading")}</p>
            ) : view === "week" ? (
              <WeekView
                selectedDate={selectedDate}
                appointments={appointments}
                patients={patients}
                onAppointmentClick={handleAppointmentClick}
              />
            ) : view === "list" ? (
              <ListView
                appointments={appointments}
                patients={patients}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onAppointmentClick={handleAppointmentClick}
              />
            ) : dayAppointments.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("agenda.no_appointments")}</p>
                <Button variant="link" onClick={() => setDialogOpen(true)}>
                  {t("agenda.new_appointment")}
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[min(60dvh,500px)] pr-4">
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
        loadAvailableSlots={loadAvailableSlots}
        onSubmit={handleCreate}
      />

      <AvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        blockStartDate={monthStart}
        blockEndDate={monthEnd}
        initialBlockDate={selectedDayStr}
        onChanged={refresh}
      />

      <Dialog open={!!detailTarget} onOpenChange={(o) => { if (!o) { setDetailTarget(null); } }}>
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

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="default" size="sm" onClick={handleStartConsultation}>
                  <Stethoscope className="mr-1 h-4 w-4" />
                  {t("agenda.start_consultation")}
                </Button>
                {canModify(detailTarget.status) && (
                  <>
                    {detailTarget.status === "scheduled" && (
                      <Button variant="default" size="sm" onClick={handleConfirm} disabled={detailBusy}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        {t("agenda.confirm_appointment")}
                      </Button>
                    )}
                    {(detailTarget.status === "scheduled" || detailTarget.status === "confirmed" || detailTarget.status === "in_progress") && (
                      <Button variant="default" size="sm" onClick={handleComplete} disabled={detailBusy}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        {t("agenda.complete_appointment")}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setRescheduleTarget(detailTarget)} disabled={detailBusy}>
                      <RotateCcw className="mr-1 h-4 w-4" />
                      {t("agenda.reschedule")}
                    </Button>
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

      <RescheduleDialog
        open={!!rescheduleTarget}
        onOpenChange={(o) => { if (!o) setRescheduleTarget(null); }}
        appointmentId={rescheduleTarget?.id ?? ""}
        patientName={
          rescheduleTarget
            ? patients.find((p) => p.id === rescheduleTarget.patientId)?.name ?? t("common.patient")
            : ""
        }
        onSubmit={handleReschedule}
        loadAvailableSlots={loadAvailableSlots}
      />
    </div>
  );
}
