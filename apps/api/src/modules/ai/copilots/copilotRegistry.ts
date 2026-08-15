import { roleSatisfies } from '../tools/toolAuthorization.js';
import type { Role } from '@nutriclinica/shared';

export type CopilotStatus = 'active' | 'planned';

export interface CopilotDefinition {
  id: string;
  name: string;
  description: string;
  status: CopilotStatus;
  requiredRole: Role | null;
  capabilities: string[];
  consentTypes: string[];
  tools: string[];
  sources: string[];
  gate: 'expert_clinical' | 'pending' | null;
  plannedNote?: string;
}

export const COPILOTS: readonly CopilotDefinition[] = [
  {
    id: 'nutrition',
    name: 'Nutrition Expert',
    description: 'Consejo educativo nutricional con calculadoras deterministas, reglas de oro, RAG gobernado y revision profesional.',
    status: 'active',
    requiredRole: 'nutriologa',
    capabilities: ['nutrition_reasoning'],
    consentTypes: ['ai_opt_in', 'ai_memory'],
    tools: ['anthropometry_tool', 'patient_profile', 'active_plan', 'lab_results', 'adherence_summary', 'recent_consultations'],
    sources: ['patient_profile', 'anthropometry_tool', 'meal_plan', 'lab_results', 'adherence_summary', 'recent_consultations'],
    gate: 'expert_clinical',
  },
  {
    id: 'clinical',
    name: 'Clinical Expert',
    description: 'Apoyo clinico general para profesionales de la salud.',
    status: 'planned',
    requiredRole: null,
    capabilities: [],
    consentTypes: [],
    tools: [],
    sources: [],
    gate: 'pending',
    plannedNote: 'Requiere el rol clinico, fuentes clinicas, tools, datasets y gates clinicos correspondientes.',
  },
  {
    id: 'medical',
    name: 'Medical Expert',
    description: 'Apoyo para profesionales medicos.',
    status: 'planned',
    requiredRole: null,
    capabilities: [],
    consentTypes: [],
    tools: [],
    sources: [],
    gate: 'pending',
    plannedNote: 'Requiere el rol medico, fuentes medicas, tools, datasets y gates clinicos correspondientes.',
  },
  {
    id: 'nursing',
    name: 'Nursing Expert',
    description: 'Apoyo para personal de enfermeria.',
    status: 'planned',
    requiredRole: null,
    capabilities: [],
    consentTypes: [],
    tools: [],
    sources: [],
    gate: 'pending',
    plannedNote: 'Requiere el rol de enfermeria, fuentes, tools, datasets y gates clinicos correspondientes.',
  },
];

export function listCopilots(): CopilotDefinition[] {
  return [...COPILOTS];
}

export function getCopilot(copilotId: string): CopilotDefinition | undefined {
  return COPILOTS.find((copilot) => copilot.id === copilotId);
}

export interface CopilotAvailability {
  available: boolean;
  reason?: string;
  requiredRole: Role | null;
}

export function copilotAvailability(copilot: CopilotDefinition, actorRole: Role): CopilotAvailability {
  if (copilot.status === 'planned') {
    return {
      available: false,
      reason: copilot.plannedNote ?? 'Aun no disponible: requiere roles, fuentes y gate clinico que no existen.',
      requiredRole: copilot.requiredRole,
    };
  }
  if (copilot.requiredRole === null) {
    return { available: false, reason: 'El rol requerido no existe', requiredRole: null };
  }
  if (!roleSatisfies(actorRole, copilot.requiredRole)) {
    return { available: false, reason: 'Rol sin permiso para este copiloto', requiredRole: copilot.requiredRole };
  }
  return { available: true, requiredRole: copilot.requiredRole };
}