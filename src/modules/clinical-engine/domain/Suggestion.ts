/**
 * Tipos y catálogos para sugerencias diagn\u00f3sticas y de plan.
 *
 * - `DiagnosticCode`: c\u00f3digos can\u00f3nicos (no SNOMED completo, sino un subconjunto
 *   pr\u00e1ctico para consulta nutricional adulta, alineado con el cat\u00e1logo de
 *   `PersonalHistory.condition` y `LabTestCode`).
 * - `EvidenceRef`: cada hallazgo cl\u00ednico (antropometr\u00eda, laboratorio, historia)
 *   que respalda una sugerencia.
 * - `DiagnosticSuggestion` / `PlanTargetSuggestion`: VO inmutables retornados por
 *   el motor de reglas.
 */
import type { ActivityLevelKey } from "@utils/calculations/tdee";

export type DiagnosticCode =
  | "sobrepeso"
  | "obesidad_grado_1"
  | "obesidad_grado_2"
  | "obesidad_grado_3"
  | "bajo_peso"
  | "resistencia_insulinica"
  | "diabetes_tipo_2"
  | "prediabetes"
  | "hipertension_arterial"
  | "dislipidemia_mixta"
  | "hipercolesterolemia"
  | "hipertrigliceridemia"
  | "sindrome_metabolico"
  | "enfermedad_renal_cronica"
  | "anemia"
  | "higado_graso_no_alcoholico"
  | "tiroideo";

export const DiagnosticCodeLabel: Record<DiagnosticCode, string> = {
  sobrepeso: "Sobrepeso",
  obesidad_grado_1: "Obesidad grado I",
  obesidad_grado_2: "Obesidad grado II",
  obesidad_grado_3: "Obesidad grado III",
  bajo_peso: "Bajo peso",
  resistencia_insulinica: "Resistencia a la insulina",
  diabetes_tipo_2: "Diabetes mellitus tipo 2",
  prediabetes: "Prediabetes",
  hipertension_arterial: "Hipertensión arterial",
  dislipidemia_mixta: "Dislipidemia mixta",
  hipercolesterolemia: "Hipercolesterolemia",
  hipertrigliceridemia: "Hipertrigliceridemia",
  sindrome_metabolico: "Síndrome metabólico",
  enfermedad_renal_cronica: "Enfermedad renal crónica",
  anemia: "Anemia",
  higado_graso_no_alcoholico: "Hígado graso no alcohólico",
  tiroideo: "Disfunción tiroidea (sospecha por TSH alterada)",
};

export type Confidence = "low" | "medium" | "high";

export const ConfidenceLabel: Record<Confidence, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export type EvidenceKind = "anthropometry" | "lab" | "vitals" | "history" | "personal-history" | "family-history";

export interface EvidenceRef {
  kind: EvidenceKind;
  description: string;
  value?: string | number | null;
}

export interface DiagnosticSuggestion {
  code: DiagnosticCode;
  label: string;
  confidence: Confidence;
  rationale: string;
  evidence: EvidenceRef[];
}

export interface PlanTargetSuggestion {
  bmrKcal: number;
  bmrFormula: "mifflin-st-jeor" | "harris-benedict";
  activityLevel: ActivityLevelKey;
  tdeeKcal: number;
  goal: "loss" | "maintenance" | "gain";
  kcalTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  distribution: { carbsPct: number; proteinPct: number; fatPct: number };
  rationale: string;
}
