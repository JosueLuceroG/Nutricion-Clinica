import * as React from "react";
import { useTranslation } from "react-i18next";
import { startOfWeek, addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Appointment } from "../domain/Appointment";

interface WeekViewProps {
  selectedDate: Date;
  appointments: Appointment[];
  patients: Array<{ id: string; name: string }>;
  onAppointmentClick: (appt: Appointment) => void;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 20; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
  }
  return slots;
}

export function WeekView({ selectedDate, appointments, patients, onAppointmentClick }: WeekViewProps) {
  const { t } = useTranslation();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const slots = generateTimeSlots();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const getAppointmentsForDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return appointments
      .filter((a) => a.date === dayStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const isToday = (day: Date) => format(day, "yyyy-MM-dd") === todayStr;

  const gridItems: React.ReactNode[] = [];

  gridItems.push(<div key="corner" className="sticky top-0 z-10 bg-card" />);

  for (const day of days) {
    gridItems.push(
      <div
        key={`header-${day.toISOString()}`}
        className={`sticky top-0 z-10 border-b p-1 text-center font-medium ${
          isToday(day) ? "bg-primary/10" : "bg-card"
        }`}
      >
        <div className="text-xs text-muted-foreground">
          {format(day, "EEE", { locale: es })}
        </div>
        <div className={`text-lg ${isToday(day) ? "text-primary" : ""}`}>
          {format(day, "d")}
        </div>
      </div>,
    );
  }

  for (const time of slots) {
    const hour = Number(time.slice(0, 2));
    const nextHour = `${String(hour + 1).padStart(2, "0")}:00`;

    gridItems.push(
      <div
        key={`time-${time}`}
        className="flex items-start justify-end border-r border-b pr-1 pt-0.5 text-xs text-muted-foreground h-12"
      >
        {time}
      </div>,
    );

    for (const day of days) {
      const dayAppts = getAppointmentsForDay(day).filter(
        (a) => a.startTime >= time && a.startTime < nextHour,
      );
      gridItems.push(
        <div
          key={`cell-${day.toISOString()}-${time}`}
          className={`border-b border-r p-0.5 ${isToday(day) ? "bg-primary/[0.02]" : ""}`}
        >
          {dayAppts.map((appt) => {
            const patient = patients.find((p) => p.id === appt.patientId);
            return (
              <button
                key={appt.id}
                type="button"
                onClick={() => onAppointmentClick(appt)}
                className="mb-0.5 w-full truncate rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-accent bg-primary/10"
              >
                <span className="font-medium">{appt.startTime}</span>{" "}
                <span>{patient?.name ?? t("common.patient")}</span>
              </button>
            );
          })}
        </div>,
      );
    }
  }

  return (
    <div className="overflow-auto">
      <div
        className="grid min-w-[700px]"
        style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}
      >
        {gridItems}
      </div>
    </div>
  );
}
