import { z } from "zod";

export const GoalIdSchema = z.string().uuid();
export type GoalId = z.infer<typeof GoalIdSchema> & { __brand: "GoalId" };

export function createGoalId(): GoalId {
  return crypto.randomUUID() as GoalId;
}
export function goalIdFrom(value: string): GoalId {
  return GoalIdSchema.parse(value) as GoalId;
}
export function goalIdFromUnsafe(value: string): GoalId {
  return value as GoalId;
}
