import { z } from "zod";
import { AppointmentTypeSchema } from "../domain/AppointmentType";
import { DayOfWeekSchema } from "../domain/Schedule";

export const NewAppointmentFormSchema = z.object({
  patientId: z.string().uuid("Paciente requerido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)"),
  type: AppointmentTypeSchema,
  reason: z.string().max(500).default(""),
  notes: z.string().max(2000).default(""),
  cost: z.number().min(0).default(0),
}).refine((data) => data.startTime < data.endTime, {
  message: "La hora de inicio debe ser anterior a la hora de fin",
  path: ["endTime"],
});

export type NewAppointmentFormInput = z.infer<typeof NewAppointmentFormSchema>;

export const AppointmentFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  patientId: z.string().uuid().optional(),
  status: z.string().optional(),
});

export type AppointmentFilterInput = z.infer<typeof AppointmentFilterSchema>;

export const CancelAppointmentSchema = z.object({
  reason: z.string().min(1, "Motivo de cancelación requerido").max(500),
});

export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;

export const RescheduleAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
}).refine((data) => data.startTime < data.endTime, {
  message: "La hora de inicio debe ser anterior a la hora de fin",
  path: ["endTime"],
});

export type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentSchema>;

export const ScheduleFormSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)"),
  active: z.boolean().default(true),
}).refine((data) => !data.active || data.startTime < data.endTime, {
  message: "La hora de inicio debe ser anterior a la hora de fin",
  path: ["endTime"],
});

export type ScheduleFormInput = z.infer<typeof ScheduleFormSchema>;

export const BlockFormSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  allDay: z.boolean().default(true),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida").optional(),
  reason: z.string().max(500).default(""),
}).refine((data) => data.startDate <= data.endDate, {
  message: "La fecha inicial debe ser anterior o igual a la final",
  path: ["endDate"],
}).refine((data) => data.allDay || (data.startDate === data.endDate && !!data.startTime && !!data.endTime && data.startTime < data.endTime), {
  message: "Los bloqueos por hora requieren misma fecha y hora inicio/fin válidas",
  path: ["endTime"],
});

export type BlockFormInput = z.infer<typeof BlockFormSchema>;
