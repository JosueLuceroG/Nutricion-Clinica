import { z } from "zod";
import { MedicationRouteSchema } from "../domain/MedicationCatalogTypes";

export const MedicationCatalogFormSchema = z.object({
  nombre_comercial: z.string().min(1, "Nombre comercial requerido"),
  principio_activo: z.string().min(1, "Principio activo requerido"),
  presentacion: z.string().min(1, "Presentación requerida"),
  concentracion: z.string().min(1, "Concentración requerida"),
  via_administracion: MedicationRouteSchema,
  categoria_farmacologica: z.string().default(""),
  efectos_secundarios: z.string().default(""),
  contraindicaciones: z.string().default(""),
  notas: z.string().default(""),
});
export type MedicationCatalogFormInput = z.infer<typeof MedicationCatalogFormSchema>;

export const NutrientInteractionFormSchema = z.object({
  medicamento_id: z.string().uuid(),
  nutriente: z.string().min(1, "Nutriente requerido"),
  tipo: z.enum(["reduce_absorcion", "aumenta_absorcion", "potencia_efecto", "antagoniza_efecto", "toxicidad"]),
  severidad: z.enum(["leve", "moderada", "severa"]),
  recomendacion: z.string().min(1, "Recomendación requerida"),
  fuente: z.string().default(""),
  fecha_vigencia: z.string().nullable().default(null),
});
export type NutrientInteractionFormInput = z.infer<typeof NutrientInteractionFormSchema>;

export function parseListInput(input: string): string[] {
  return input.split("\n").map((s) => s.trim()).filter(Boolean);
}
