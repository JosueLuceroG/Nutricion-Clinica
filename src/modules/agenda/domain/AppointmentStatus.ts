import { z } from "zod";

export const AppointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
]);

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;

export const AppointmentStatusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Programada",
  confirmed: "Confirmada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
  rescheduled: "Reagendada",
};

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] =
  AppointmentStatusSchema.options;
