import { z } from "zod";

export const AdherenceIdSchema = z.string().uuid();
export type AdherenceId = z.infer<typeof AdherenceIdSchema> & { __brand: "AdherenceId" };

export function createAdherenceId(): AdherenceId {
  return crypto.randomUUID() as AdherenceId;
}
export function adherenceIdFrom(value: string): AdherenceId {
  return AdherenceIdSchema.parse(value) as AdherenceId;
}
export function adherenceIdFromUnsafe(value: string): AdherenceId {
  return value as AdherenceId;
}
