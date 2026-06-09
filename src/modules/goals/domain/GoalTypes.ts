import { z } from "zod";

export const GoalTypeSchema = z.enum([
  "antropometrico",
  "bioquimico",
  "clinico",
  "dietetico",
  "conductual",
  "personalizado",
]);
export type GoalType = z.infer<typeof GoalTypeSchema>;
export const GoalTypeLabel: Record<GoalType, string> = {
  antropometrico: "Antropométrico",
  bioquimico: "Bioquímico",
  clinico: "Clínico",
  dietetico: "Dietético",
  conductual: "Conductual",
  personalizado: "Personalizado",
};

export const GoalStatusSchema = z.enum([
  "activo",
  "en_pausa",
  "logrado",
  "no_logrado",
  "abandonado",
  "modificado",
]);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;
export const GoalStatusLabel: Record<GoalStatus, string> = {
  activo: "Activo",
  en_pausa: "En pausa",
  logrado: "Logrado",
  no_logrado: "No logrado",
  abandonado: "Abandonado",
  modificado: "Modificado",
};

export const GoalPrioritySchema = z.enum(["alta", "media", "baja"]);
export type GoalPriority = z.infer<typeof GoalPrioritySchema>;
export const GoalPriorityLabel: Record<GoalPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const GoalSourceSchema = z.enum(["clinica", "paciente", "ambos"]);
export type GoalSource = z.infer<typeof GoalSourceSchema>;
export const GoalSourceLabel: Record<GoalSource, string> = {
  clinica: "Clínica",
  paciente: "Paciente",
  ambos: "Ambos",
};

export const SuccessCriterionSchema = z.enum(["numerico", "rango", "cualitativo"]);
export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>;
export const SuccessCriterionLabel: Record<SuccessCriterion, string> = {
  numerico: "Numérico",
  rango: "Rango",
  cualitativo: "Cualitativo",
};

export const EvaluationStatusSchema = z.enum([
  "en_progreso",
  "en_ritmo",
  "retrasado",
  "estancado",
  "logrado",
  "superado",
  "en_retroceso",
]);
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>;
export const EvaluationStatusLabel: Record<EvaluationStatus, string> = {
  en_progreso: "En progreso",
  en_ritmo: "En ritmo",
  retrasado: "Retrasado",
  estancado: "Estancado",
  logrado: "Logrado",
  superado: "Superado",
  en_retroceso: "En retroceso",
};
