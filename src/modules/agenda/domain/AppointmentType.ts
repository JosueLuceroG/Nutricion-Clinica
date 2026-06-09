import { z } from "zod";

export const AppointmentTypeSchema = z.enum([
  "primera_vez",
  "seguimiento",
  "urgencia",
  "control",
  "cierre",
]);

export type AppointmentType = z.infer<typeof AppointmentTypeSchema>;

export const AppointmentTypeLabel: Record<AppointmentType, string> = {
  primera_vez: "Primera vez",
  seguimiento: "Seguimiento",
  urgencia: "Urgencia",
  control: "Control",
  cierre: "Cierre",
};

export const APPOINTMENT_TYPES: readonly AppointmentType[] =
  AppointmentTypeSchema.options;

export const DefaultDurationMin: Record<AppointmentType, number> = {
  primera_vez: 60,
  seguimiento: 30,
  urgencia: 20,
  control: 45,
  cierre: 30,
};
