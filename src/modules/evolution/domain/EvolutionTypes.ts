import { z } from "zod";

export const EvolutionVariableSchema = z.enum([
  "peso", "imc", "grasa_porcentaje", "mlg_kg", "masa_muscular_kg",
  "agua_porcentaje", "circunferencia_cintura", "hba1c", "ldl",
  "hdl", "colesterol_total", "trigliceridos", "ta_sistolica",
  "ta_diastolica", "glucosa_ayuno", "vitamina_d", "hierro_serico",
  "ferritina", "vitamina_b12", "cumplimiento_menu",
  "variabilidad_dieta", "actividad_fisica_min_sem", "sueño_hrs",
  "estres_autopercepcion",
]);
export type EvolutionVariable = z.infer<typeof EvolutionVariableSchema>;

export const EvolutionVariableLabel: Record<EvolutionVariable, string> = {
  peso: "Peso",
  imc: "IMC",
  grasa_porcentaje: "% Grasa",
  mlg_kg: "Masa Libre de Grasa",
  masa_muscular_kg: "Masa Muscular",
  agua_porcentaje: "% Agua Corporal",
  circunferencia_cintura: "Circunferencia de Cintura",
  hba1c: "HbA1c",
  ldl: "LDL",
  hdl: "HDL",
  colesterol_total: "Colesterol Total",
  trigliceridos: "Triglicéridos",
  ta_sistolica: "Tensión Arterial Sistólica",
  ta_diastolica: "Tensión Arterial Diastólica",
  glucosa_ayuno: "Glucosa en Ayuno",
  vitamina_d: "Vitamina D",
  hierro_serico: "Hierro Sérico",
  ferritina: "Ferritina",
  vitamina_b12: "Vitamina B12",
  cumplimiento_menu: "Cumplimiento del Menú",
  variabilidad_dieta: "Variabilidad de la Dieta",
  actividad_fisica_min_sem: "Actividad Física (min/sem)",
  sueño_hrs: "Sueño (hrs)",
  estres_autopercepcion: "Estrés (autopercepción)",
};

export const IndicatorStatusSchema = z.enum([
  "en_progreso", "logrado", "superado", "estancado", "en_retroceso",
]);
export type IndicatorStatus = z.infer<typeof IndicatorStatusSchema>;

export const IndicatorStatusLabel: Record<IndicatorStatus, string> = {
  en_progreso: "En Progreso",
  logrado: "Logrado",
  superado: "Superado",
  estancado: "Estancado",
  en_retroceso: "En Retroceso",
};

export const StagnationSeveritySchema = z.enum(["baja", "media", "alta", "critica"]);
export type StagnationSeverity = z.infer<typeof StagnationSeveritySchema>;

export const StagnationSeverityLabel: Record<StagnationSeverity, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};
