import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Appointment } from "../domain/Appointment";
import type { AppointmentStatus } from "../domain/AppointmentStatus";
import { Badge } from "@components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";

interface ListViewProps {
  appointments: Appointment[];
  patients: Array<{ id: string; name: string }>;
  statusFilter: AppointmentStatus | "";
  onStatusFilterChange: (status: AppointmentStatus | "") => void;
  onAppointmentClick: (appt: Appointment) => void;
}

const statusLabelKey: Record<AppointmentStatus, string> = {
  scheduled: "agenda.status_scheduled",
  confirmed: "agenda.status_confirmed",
  in_progress: "agenda.status_in_progress",
  completed: "agenda.status_completed",
  cancelled: "agenda.status_cancelled",
  no_show: "agenda.status_no_show",
  rescheduled: "agenda.status_rescheduled",
};

const typeLabelKey: Record<string, string> = {
  consulta: "agenda.type_consultation",
  seguimiento: "agenda.type_followup",
  evaluacion_inicial: "agenda.type_evaluation",
};

export function ListView({
  appointments,
  patients,
  statusFilter,
  onStatusFilterChange,
  onAppointmentClick,
}: ListViewProps) {
  const { t } = useTranslation();

  const filtered = statusFilter
    ? appointments.filter((a) => a.status === statusFilter)
    : appointments;

  const sorted = [...filtered].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-sm text-muted-foreground">
          {t("agenda.filter_status")}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as AppointmentStatus | "")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("agenda.filter_all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("agenda.filter_all")}</SelectItem>
            {(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(statusLabelKey[s])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusFilter && (
          <Button variant="ghost" size="sm" onClick={() => onStatusFilterChange("")}>
            {t("agenda.filter_clear")}
          </Button>
        )}
      </div>

      <ScrollArea className="h-[min(55dvh,450px)]">
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">{t("common.date")}</th>
                <th className="px-3 py-2 font-medium">{t("agenda.time")}</th>
                <th className="px-3 py-2 font-medium">{t("common.patient")}</th>
                <th className="px-3 py-2 font-medium">{t("common.type")}</th>
                <th className="px-3 py-2 font-medium">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    {t("agenda.no_appointments")}
                  </td>
                </tr>
              ) : (
                sorted.map((appt) => {
                  const patient = patients.find((p) => p.id === appt.patientId);
                  return (
                    <tr
                      key={appt.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-accent/50 transition-colors"
                      onClick={() => onAppointmentClick(appt)}
                    >
                      <td className="px-3 py-2">
                        {format(new Date(appt.date + "T00:00:00"), "d MMM", { locale: es })}
                      </td>
                      <td className="px-3 py-2 text-nowrap">
                        {appt.startTime} - {appt.endTime}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {patient?.name ?? t("common.patient")}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">
                          {t(typeLabelKey[appt.type] ?? appt.type)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">
                          {t(statusLabelKey[appt.status])}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}
