import { z } from "zod";

export const WeeklyPlanIdSchema = z.string().uuid();
export type WeeklyPlanId = z.infer<typeof WeeklyPlanIdSchema> & { __brand: "WeeklyPlanId" };

export function createWeeklyPlanId(): WeeklyPlanId {
  return crypto.randomUUID() as WeeklyPlanId;
}
