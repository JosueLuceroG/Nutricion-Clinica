import { useTranslation } from "react-i18next";
import type { AppointmentStatus } from "../domain/AppointmentStatus";
import { cn } from "@utils/cn";
import { Badge } from "@components/ui/badge";
import { User, FileText } from "lucide-react";

interface AppointmentCardProps {
  startTime: string;
  endTime: string;
  patientName: string;
  type: string;
  status: AppointmentStatus;
  reason?: string;
  onClick?: () => void;
}

const statusColor: Record<AppointmentStatus, string> = {
  scheduled: "border-l-blue-400",
  confirmed: "border-l-emerald-400",
  in_progress: "border-l-amber-400",
  completed: "border-l-green-600",
  cancelled: "border-l-red-400 opacity-60",
  no_show: "border-l-red-400 opacity-60",
  rescheduled: "border-l-purple-400",
};

const statusLabelKey: Record<AppointmentStatus, string> = {
  scheduled: "agenda.status_scheduled",
  confirmed: "agenda.status_confirmed",
  in_progress: "agenda.status_in_progress",
  completed: "agenda.status_completed",
  cancelled: "agenda.status_cancelled",
  no_show: "agenda.status_no_show",
  rescheduled: "agenda.status_scheduled",
};

const typeLabelKey: Record<string, string> = {
  consulta: "agenda.type_consultation",
  seguimiento: "agenda.type_followup",
  evaluacion_inicial: "agenda.type_evaluation",
};

export function AppointmentCard({ startTime, endTime, patientName, type, status, reason, onClick }: AppointmentCardProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border border-border bg-card p-2 text-left text-xs transition-colors hover:bg-accent",
        "border-l-4",
        statusColor[status],
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium text-foreground">{startTime} - {endTime}</span>
        <Badge variant="outline" className="h-4 px-1 text-[9px]">{t(typeLabelKey[type] ?? type)}</Badge>
      </div>
      <div className="mt-1 flex items-center gap-1 text-muted-foreground">
        <User className="h-3 w-3" />
        <span className="truncate font-medium text-foreground">{patientName}</span>
      </div>
      {reason && (
        <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate">{reason}</span>
        </div>
      )}
      <div className="mt-1">
        <Badge variant="secondary" className="h-4 px-1 text-[9px]">
          {t(statusLabelKey[status])}
        </Badge>
      </div>
    </button>
  );
}
