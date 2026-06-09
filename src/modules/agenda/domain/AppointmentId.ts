import { z } from "zod";

export const AppointmentIdSchema = z.string().uuid();

export type AppointmentId = z.infer<typeof AppointmentIdSchema> & { __brand: "AppointmentId" };

export function createAppointmentId(): AppointmentId {
  return crypto.randomUUID() as AppointmentId;
}

export function appointmentIdFrom(value: string): AppointmentId {
  return AppointmentIdSchema.parse(value) as AppointmentId;
}

export function appointmentIdFromUnsafe(value: string): AppointmentId {
  return value as AppointmentId;
}
