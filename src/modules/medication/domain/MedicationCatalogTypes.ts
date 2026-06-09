import { z } from "zod";

export const MedicationRouteSchema = z.enum([
  "oral",
  "IV",
  "IM",
  "SC",
  "topica",
  "inhalada",
]);
export type MedicationRoute = z.infer<typeof MedicationRouteSchema>;
export const MedicationRouteLabel: Record<MedicationRoute, string> = {
  oral: "Oral",
  IV: "Intravenosa",
  IM: "Intramuscular",
  SC: "Subcutánea",
  topica: "Tópica",
  inhalada: "Inhalada",
};
export const MEDICATION_ROUTES: readonly MedicationRoute[] = MedicationRouteSchema.options;

export const InteractionTypeSchema = z.enum([
  "reduce_absorcion",
  "aumenta_absorcion",
  "potencia_efecto",
  "antagoniza_efecto",
  "toxicidad",
]);
export type InteractionType = z.infer<typeof InteractionTypeSchema>;
export const InteractionTypeLabel: Record<InteractionType, string> = {
  reduce_absorcion: "Reduce absorción",
  aumenta_absorcion: "Aumenta absorción",
  potencia_efecto: "Potencia efecto",
  antagoniza_efecto: "Antagoniza efecto",
  toxicidad: "Toxicidad",
};
export const INTERACTION_TYPES: readonly InteractionType[] = InteractionTypeSchema.options;

export const InteractionSeveritySchema = z.enum([
  "leve",
  "moderada",
  "severa",
]);
export type InteractionSeverity = z.infer<typeof InteractionSeveritySchema>;
export const InteractionSeverityLabel: Record<InteractionSeverity, string> = {
  leve: "Leve",
  moderada: "Moderada",
  severa: "Severa",
};
export const INTERACTION_SEVERITIES: readonly InteractionSeverity[] = InteractionSeveritySchema.options;
