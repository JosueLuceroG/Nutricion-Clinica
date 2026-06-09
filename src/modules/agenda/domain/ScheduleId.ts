import { z } from "zod";

export const ScheduleIdSchema = z.string().uuid();

export type ScheduleId = z.infer<typeof ScheduleIdSchema> & { __brand: "ScheduleId" };

export function createScheduleId(): ScheduleId {
  return crypto.randomUUID() as ScheduleId;
}

export function scheduleIdFrom(value: string): ScheduleId {
  return ScheduleIdSchema.parse(value) as ScheduleId;
}

export function scheduleIdFromUnsafe(value: string): ScheduleId {
  return value as ScheduleId;
}
