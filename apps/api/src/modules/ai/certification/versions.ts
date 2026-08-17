import type { AIModelCapability } from '../evaluation/capabilities.js';

/**
 * Versiones reproducibles de los componentes que integran la clave de certificación.
 * Un cambio en cualquiera de ellos invalida la certificación (requalification).
 */
export interface PromptVersions {
  chat_general: string;
  structured_json: string;
  nutrition_reasoning: string;
  patient_support: string;
}

export interface OutputSchemaVersions {
  chat_general: string;
  structured_json: string;
  nutrition_reasoning: string;
  patient_support: string;
  default: string;
}

export interface CurrentVersions {
  promptVersion: PromptVersions;
  toolsetVersion: string;
  policyVersion: string;
  outputSchemaVersion: OutputSchemaVersions;
  evaluationDatasetVersion: string;
  knowledgePolicyVersion: string;
}

export const GOLDEN_DATASET_VERSION = 'nutrition-golden-v1';

/** Herramientas activas que componen el toolset (id + riskLevel + claves del schema). */
export const ACTIVE_TOOLSET: ReadonlyArray<{ id: string; riskLevel: string; schemaKeys: string[] }> = [
  { id: 'patient_profile', riskLevel: 'high', schemaKeys: ['pacienteId', 'genero', 'edad'] },
  { id: 'anthropometry_tool', riskLevel: 'high', schemaKeys: ['weightKg', 'heightM', 'measuredAt'] },
  { id: 'recent_consultations', riskLevel: 'high', schemaKeys: ['fecha', 'notas'] },
  { id: 'lab_results', riskLevel: 'high', schemaKeys: ['fecha', 'valores'] },
  { id: 'meal_plan', riskLevel: 'medium', schemaKeys: ['kcalTarget', 'macros'] },
  { id: 'adherence_summary', riskLevel: 'medium', schemaKeys: ['fecha', 'cumplimiento'] },
  { id: 'billing_history', riskLevel: 'high', schemaKeys: ['fecha', 'monto'] },
  { id: 'search_patient', riskLevel: 'high', schemaKeys: ['id', 'nombres', 'apellido_paterno', 'telefono'] },
  { id: 'get_patient_history', riskLevel: 'high', schemaKeys: ['windowDays', 'consultations', 'anthropometry', 'labs', 'plans', 'adherence'] },
  { id: 'get_diet', riskLevel: 'medium', schemaKeys: ['meals_json', 'kcal_target', 'protein_target_g', 'carbs_target_g', 'fat_target_g'] },
  { id: 'get_body_composition', riskLevel: 'high', schemaKeys: ['bmi', 'bodyFatPct', 'circumferences', 'skinfolds'] },
  { id: 'get_vital_signs', riskLevel: 'high', schemaKeys: ['vitals_json', 'consultation_date'] },
  { id: 'get_medications', riskLevel: 'high', schemaKeys: ['nombre', 'dosis', 'activo'] },
  { id: 'get_allergies', riskLevel: 'high', schemaKeys: ['sustancia', 'severidad', 'reaccion'] },
  { id: 'get_intolerances', riskLevel: 'high', schemaKeys: ['alimento', 'severidad'] },
  { id: 'get_diagnoses', riskLevel: 'high', schemaKeys: ['condicion', 'estado', 'fecha_diagnostico'] },
  { id: 'get_clinical_notes', riskLevel: 'high', schemaKeys: ['subjective', 'objective', 'assessment', 'plan'] },
  { id: 'get_documents', riskLevel: 'high', schemaKeys: ['tipo', 'nombre_archivo', 'hash_sha256'] },
  { id: 'get_appointments', riskLevel: 'medium', schemaKeys: ['consultation_date', 'status', 'reason'] },
  { id: 'get_patient_metrics', riskLevel: 'medium', schemaKeys: ['consultationsTotal', 'adherenceMenuAvgLast30Days', 'labPanelsTotal', 'latestWeightKg'] },
  { id: 'get_evolution', riskLevel: 'high', schemaKeys: ['series', 'deltas', 'scope'] },
];

/** Fingerprint determinista FNV-1a del toolset: cambiar tool/schema → fingerprint distinto → certificación stale. */
export function computeToolsetVersion(tools: ReadonlyArray<{ id: string; riskLevel: string; schemaKeys: string[] }>): string {
  const canonical = tools
    .map((tool) => `${tool.id}:${tool.riskLevel}:${tool.schemaKeys.slice().sort().join(',')}`)
    .sort()
    .join('\n');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `toolset.${hash.toString(16).padStart(8, '0')}`;
}

export const CURRENT_VERSIONS: CurrentVersions = {
  promptVersion: {
    chat_general: 'prompt.chat_general.v1',
    structured_json: 'prompt.structured_json.v1',
    nutrition_reasoning: 'prompt.nutrition_reasoning.v2',
    patient_support: 'prompt.patient_support.v1',
  },
  toolsetVersion: computeToolsetVersion(ACTIVE_TOOLSET),
  policyVersion: 'policy-bundle.v1',
  outputSchemaVersion: {
    chat_general: 'output.chat_general.v1',
    structured_json: 'output.structured_json.v1',
    nutrition_reasoning: 'output.nutrition_reasoning.v2',
    patient_support: 'output.patient_support.v1',
    default: 'output.default.v1',
  },
  evaluationDatasetVersion: GOLDEN_DATASET_VERSION,
  knowledgePolicyVersion: 'knowledge-policy.v1',
};

export function promptVersionFor(capability: AIModelCapability, versions: CurrentVersions = CURRENT_VERSIONS): string {
  return versions.promptVersion[capability];
}

export function outputSchemaVersionFor(capability: AIModelCapability, versions: CurrentVersions = CURRENT_VERSIONS): string {
  return versions.outputSchemaVersion[capability];
}