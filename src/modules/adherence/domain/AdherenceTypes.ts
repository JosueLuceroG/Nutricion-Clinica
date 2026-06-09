import { z } from "zod";

export const AdherenceSourceSchema = z.enum(["consulta", "portal", "app", "llamada"]);
export type AdherenceSource = z.infer<typeof AdherenceSourceSchema>;
export const AdherenceSourceLabel: Record<AdherenceSource, string> = {
  consulta: "Consulta",
  portal: "Portal",
  app: "App",
  llamada: "Llamada",
};

export const AdherenceTendencySchema = z.enum(["mejorando", "estable", "empeorando"]);
export type AdherenceTendency = z.infer<typeof AdherenceTendencySchema>;
export const AdherenceTendencyLabel: Record<AdherenceTendency, string> = {
  mejorando: "Mejorando",
  estable: "Estable",
  empeorando: "Empeorando",
};

export const BarrierTypeSchema = z.enum([
  "economica", "tiempo", "social", "emocional", "salud", "conocimiento", "otra",
]);
export type BarrierType = z.infer<typeof BarrierTypeSchema>;
export const BarrierTypeLabel: Record<BarrierType, string> = {
  economica: "Económica",
  tiempo: "Tiempo",
  social: "Social",
  emocional: "Emocional",
  salud: "Salud",
  conocimiento: "Conocimiento",
  otra: "Otra",
};
