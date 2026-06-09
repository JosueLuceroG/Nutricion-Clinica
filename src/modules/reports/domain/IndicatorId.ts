import { z } from "zod";

export const IndicatorIdSchema = z.string().uuid();
export type IndicatorId = z.infer<typeof IndicatorIdSchema> & { __brand: "IndicatorId" };

export function createIndicatorId(): IndicatorId {
  return crypto.randomUUID() as IndicatorId;
}
export function indicatorIdFrom(value: string): IndicatorId {
  return IndicatorIdSchema.parse(value) as IndicatorId;
}
export function indicatorIdFromUnsafe(value: string): IndicatorId {
  return value as IndicatorId;
}
