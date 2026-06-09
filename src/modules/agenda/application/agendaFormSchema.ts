import { z } from "zod";
import { AppointmentTypeSchema } from "../domain/AppointmentType";

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
