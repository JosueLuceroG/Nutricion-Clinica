import type { AIToolDefinition } from './toolDefinition.js';
import { ERP_TOOLS } from './erpToolExecutors.js';

export type CanonicalToolStatus = 'EXACT_EQUIVALENT' | 'IMPLEMENTED' | 'PARTIAL_EQUIVALENT' | 'BLOCKED';

export interface CanonicalToolEntry {
  canonicalId: string;
  name: string;
  status: CanonicalToolStatus;
  /** Herramienta registrada que implementa la capacidad canónica (vacía si BLOCKED). */
  implementationId: string | null;
  sourceOfTruth: string;
  notes: string;
}

export const CANONICAL_TOOL_CATALOG: readonly CanonicalToolEntry[] = [
  { canonicalId: 'search_patient', name: 'Búsqueda de paciente', status: 'IMPLEMENTED', implementationId: 'search_patient', sourceOfTruth: 'SQL: pacientes (sucursal_id) — búsqueda profesional por nombre/apellidos/teléfono', notes: 'Patient-scope false: no opera sobre un paciente específico; aislamiento por sucursal.' },
  { canonicalId: 'get_patient_profile', name: 'Perfil del paciente', status: 'EXACT_EQUIVALENT', implementationId: 'patient_profile', sourceOfTruth: 'SQL: pacientes', notes: 'Implementación original Build 04.' },
  { canonicalId: 'get_patient_history', name: 'Historia del paciente', status: 'IMPLEMENTED', implementationId: 'get_patient_history', sourceOfTruth: 'SQL: consultas + antropometrias + lab_panels + planes_alimenticios + adherence_records (ventana acotada)', notes: 'Composición acotada con ventana configurable.' },
  { canonicalId: 'get_consultations', name: 'Consultas recientes', status: 'EXACT_EQUIVALENT', implementationId: 'recent_consultations', sourceOfTruth: 'SQL: consultas', notes: 'Implementación original Build 04.' },
  { canonicalId: 'get_evolution', name: 'Evolución', status: 'PARTIAL_EQUIVALENT', implementationId: 'get_evolution', sourceOfTruth: 'SQL: antropometrias (serie peso/IMC)', notes: 'Cubre evolución física. La evolución conductual/objetivos no tiene fuente autoritativa en el ERP.' },
  { canonicalId: 'get_nutrition_plan', name: 'Plan nutricional', status: 'EXACT_EQUIVALENT', implementationId: 'meal_plan', sourceOfTruth: 'SQL: planes_alimenticios (activo)', notes: 'Implementación original Build 04.' },
  { canonicalId: 'get_diet', name: 'Detalle de dieta', status: 'IMPLEMENTED', implementationId: 'get_diet', sourceOfTruth: 'SQL: planes_alimenticios.meals_json + objetivos', notes: 'Alimentos/comidas del plan activo.' },
  { canonicalId: 'get_goals', name: 'Objetivos', status: 'BLOCKED', implementationId: null, sourceOfTruth: 'NO DISPONIBLE — los objetivos viven solo en el cliente (Dexie), sin tabla en el ERP', notes: 'BLOCKED — authoritative source unavailable. No se inventa una implementación.' },
  { canonicalId: 'get_anthropometry', name: 'Antropometría reciente', status: 'EXACT_EQUIVALENT', implementationId: 'anthropometry_tool', sourceOfTruth: 'SQL: antropometrias', notes: 'Implementación original Build 04.' },
  { canonicalId: 'get_body_composition', name: 'Composición corporal', status: 'IMPLEMENTED', implementationId: 'get_body_composition', sourceOfTruth: 'SQL: antropometrias (bmi, body_fat_pct, circunferencias, pliegues)', notes: 'Etiqueta MEASURED vs CALCULATED por campo.' },
  { canonicalId: 'get_vital_signs', name: 'Signos vitales', status: 'IMPLEMENTED', implementationId: 'get_vital_signs', sourceOfTruth: 'SQL: consultas.vitals_json (solo cuando registrados)', notes: 'Parcial por naturaleza: depende de registro estructurado en consulta.' },
  { canonicalId: 'get_lab_results', name: 'Resultados de laboratorio', status: 'EXACT_EQUIVALENT', implementationId: 'lab_results', sourceOfTruth: 'SQL: lab_panels', notes: 'Implementación original Build 04.' },
  { canonicalId: 'get_medications', name: 'Medicamentos', status: 'IMPLEMENTED', implementationId: 'get_medications', sourceOfTruth: 'SQL: medicamentos (activos)', notes: 'Habilita interacciones medicamento-nutriente.' },
  { canonicalId: 'get_allergies', name: 'Alergias', status: 'IMPLEMENTED', implementationId: 'get_allergies', sourceOfTruth: 'SQL: alergias', notes: 'Habilita bloqueos deterministas de alergenos.' },
  { canonicalId: 'get_diagnoses', name: 'Diagnósticos / condiciones', status: 'IMPLEMENTED', implementationId: 'get_diagnoses', sourceOfTruth: 'SQL: historia_personal', notes: 'Condiciones preexistentes con estado.' },
  { canonicalId: 'get_clinical_notes', name: 'Notas clínicas', status: 'IMPLEMENTED', implementationId: 'get_clinical_notes', sourceOfTruth: 'SQL: consultas (SOAP)', notes: 'Datos sensibles; uso profesional exclusivo.' },
  { canonicalId: 'get_documents', name: 'Documentos', status: 'IMPLEMENTED', implementationId: 'get_documents', sourceOfTruth: 'SQL: documentos (metadatos únicamente)', notes: 'No expone contenido ni url de almacenamiento.' },
  { canonicalId: 'get_appointments', name: 'Citas', status: 'IMPLEMENTED', implementationId: 'get_appointments', sourceOfTruth: 'SQL: consultas con status=scheduled (proxy)', notes: 'No existe tabla de citas independiente; proxy parcial documentado.' },
  { canonicalId: 'get_alerts', name: 'Alertas', status: 'BLOCKED', implementationId: null, sourceOfTruth: 'NO DISPONIBLE — las alertas de estancamiento viven solo en el cliente (Dexie), sin tabla en el ERP', notes: 'BLOCKED — authoritative source unavailable.' },
  { canonicalId: 'get_patient_metrics', name: 'Métricas del paciente', status: 'IMPLEMENTED', implementationId: 'get_patient_metrics', sourceOfTruth: 'SQL: OLTP (consultas, adherence_records, lab_panels, antropometrias, planes_alimenticios)', notes: 'Métricas operativas a nivel paciente desde OLTP.' },
];

const byId = new Map<string, AIToolDefinition>(ERP_TOOLS.map((tool) => [tool.id, tool]));

export function canonicalToolImplementation(canonicalId: string): AIToolDefinition | null {
  const entry = CANONICAL_TOOL_CATALOG.find((e) => e.canonicalId === canonicalId);
  if (!entry?.implementationId) return null;
  return byId.get(entry.implementationId) ?? null;
}

export function availableCanonicalTools(): CanonicalToolEntry[] {
  return CANONICAL_TOOL_CATALOG.filter((entry) => entry.status !== 'BLOCKED');
}

export function blockedCanonicalTools(): CanonicalToolEntry[] {
  return CANONICAL_TOOL_CATALOG.filter((entry) => entry.status === 'BLOCKED');
}