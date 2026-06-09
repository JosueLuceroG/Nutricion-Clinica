import { z } from "zod";

export const MedicationCatalogIdSchema = z.string().uuid();
export type MedicationCatalogId = z.infer<typeof MedicationCatalogIdSchema> & { __brand: "MedicationCatalogId" };

export function createMedicationCatalogId(): MedicationCatalogId {
  return crypto.randomUUID() as MedicationCatalogId;
}
export function medicationCatalogIdFrom(value: string): MedicationCatalogId {
  return MedicationCatalogIdSchema.parse(value) as MedicationCatalogId;
}
export function medicationCatalogIdFromUnsafe(value: string): MedicationCatalogId {
  return value as MedicationCatalogId;
}
