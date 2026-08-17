import type { DataCategoryId } from './dataCategories.js';
import { emptyFor, filterByAllowlist } from './filterByAllowlist.js';

export type EgressPurpose =
  | 'nutrition_consultation_support'
  | 'patient_education'
  | 'clinical_summary'
  | 'clinical_notes_drafting'
  | 'lab_interpretation'
  | 'meal_planning'
  | 'goal_setting'
  | 'analytics'
  | 'model_evaluation'
  | 'administrative';

export type StructuredShapeId =
  | 'expert_context'
  | 'patient_profile'
  | 'anthropometry'
  | 'meal_plan'
  | 'lab_panel'
  | 'adherence_row'
  | 'consultation_row';

export interface CapabilityDataContract {
  capabilityId: string;
  purpose: EgressPurpose;
  allowedDataCategories: DataCategoryId[];
  allowedFields: readonly string[];
  requiredFields: readonly string[];
  optionalFields: readonly string[];
  patientScope: 'required' | 'optional' | 'not_required';
  consentScope: string | null;
  phiAllowed: boolean;
  requiresPurpose: boolean;
  requiredResidency: string | null;
  redactFreeText: boolean;
  pseudonymizePatientRef: boolean;
  structuredAllowlists: Partial<Record<StructuredShapeId, readonly string[]>>;
}

const REQUIRED_PATIENT_CONSENT = 'ai_opt_in';

export const CAPABILITY_CONTRACTS: Readonly<Record<string, CapabilityDataContract>> = {
  nutrition_reasoning: {
    capabilityId: 'nutrition_reasoning',
    purpose: 'nutrition_consultation_support',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'CLINICAL_NOTES', 'ANTHROPOMETRY', 'LAB_RESULTS', 'DIAGNOSES', 'MEAL_PLAN', 'ADHERENCE', 'DOCUMENT_EXCERPTS'],
    allowedFields: [
      'expert_context.profileMissing',
      'expert_context.genero',
      'expert_context.ageYears',
      'expert_context.conditions',
      'expert_context.anthropometry.weightKg',
      'expert_context.anthropometry.heightM',
      'expert_context.anthropometry.measuredAt',
      'expert_context.activePlan.name',
      'expert_context.activePlan.kcalTarget',
      'expert_context.activePlan.startDate',
      'expert_context.activePlan.endDate',
      'expert_context.recentLabs[].lab_name',
      'expert_context.recentLabs[].taken_at',
      'expert_context.recentLabs[].results_json',
      'expert_context.recentConsultationsCount',
      'patient_profile.genero',
      'patient_profile.fecha_nacimiento',
      'patient_profile.estado_expediente',
      'anthropometry.weightKg',
      'anthropometry.heightM',
      'anthropometry.measuredAt',
      'meal_plan.name',
      'meal_plan.start_date',
      'meal_plan.end_date',
      'meal_plan.kcal_target',
      'meal_plan.status',
      'lab_panel.lab_name',
      'lab_panel.taken_at',
      'lab_panel.results_json',
      'adherence_row.record_date',
      'adherence_row.adherence_menu',
      'adherence_row.adherence_water',
      'adherence_row.adherence_activity',
      'adherence_row.adherence_supplements',
      'adherence_row.adherence_sleep',
      'consultation_row.consultation_number',
      'consultation_row.consultation_date',
      'consultation_row.status',
      'consultation_row.reason',
      'consultation_row.assessment',
    ],
    requiredFields: ['expert_context.genero', 'expert_context.ageYears'],
    optionalFields: ['expert_context.conditions', 'expert_context.anthropometry.weightKg', 'expert_context.recentLabs[].results_json'],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {
      expert_context: [
        'profileMissing',
        'genero',
        'ageYears',
        'conditions',
        'anthropometry.weightKg',
        'anthropometry.heightM',
        'anthropometry.measuredAt',
        'activePlan.name',
        'activePlan.kcalTarget',
        'activePlan.startDate',
        'activePlan.endDate',
        'recentLabs[].lab_name',
        'recentLabs[].taken_at',
        'recentLabs[].results_json',
        'recentConsultationsCount',
      ],
      patient_profile: ['genero', 'fecha_nacimiento', 'estado_expediente'],
      anthropometry: ['weightKg', 'heightM', 'measuredAt'],
      meal_plan: ['name', 'start_date', 'end_date', 'kcal_target', 'status'],
      lab_panel: ['lab_name', 'taken_at', 'results_json'],
      adherence_row: ['record_date', 'adherence_menu', 'adherence_water', 'adherence_activity', 'adherence_supplements', 'adherence_sleep'],
      consultation_row: ['consultation_number', 'consultation_date', 'status', 'reason', 'assessment'],
    },
  },

  patient_overview: {
    capabilityId: 'patient_overview',
    purpose: 'clinical_summary',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'CLINICAL_NOTES', 'LAB_RESULTS'],
    allowedFields: [
      'patient_profile.genero',
      'patient_profile.fecha_nacimiento',
      'patient_profile.estado_expediente',
      'consultation_row.consultation_number',
      'consultation_row.consultation_date',
      'consultation_row.status',
      'consultation_row.reason',
      'consultation_row.assessment',
      'lab_panel.lab_name',
      'lab_panel.taken_at',
      'lab_panel.results_json',
    ],
    requiredFields: [],
    optionalFields: ['consultation_row.reason', 'consultation_row.assessment', 'lab_panel.results_json'],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {
      patient_profile: ['genero', 'fecha_nacimiento', 'estado_expediente'],
      consultation_row: ['consultation_number', 'consultation_date', 'status', 'reason', 'assessment'],
      lab_panel: ['lab_name', 'taken_at', 'results_json'],
    },
  },

  patient_support: {
    capabilityId: 'patient_support',
    purpose: 'patient_education',
    allowedDataCategories: ['DOCUMENT_EXCERPTS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'not_required',
    consentScope: null,
    phiAllowed: false,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: false,
    structuredAllowlists: {},
  },

  clinical_notes_draft: {
    capabilityId: 'clinical_notes_draft',
    purpose: 'clinical_notes_drafting',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'CLINICAL_NOTES', 'VITALS', 'ANTHROPOMETRY', 'LAB_RESULTS', 'DIAGNOSES'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  clinical_summary: {
    capabilityId: 'clinical_summary',
    purpose: 'clinical_summary',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'CLINICAL_NOTES', 'VITALS', 'ANTHROPOMETRY', 'LAB_RESULTS', 'DIAGNOSES', 'MEAL_PLAN', 'ADHERENCE', 'GOALS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  lab_interpretation: {
    capabilityId: 'lab_interpretation',
    purpose: 'lab_interpretation',
    allowedDataCategories: ['LAB_RESULTS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: false,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  meal_substitution: {
    capabilityId: 'meal_substitution',
    purpose: 'meal_planning',
    allowedDataCategories: ['MEAL_PLAN', 'ALLERGIES', 'INTOLERANCES', 'DIAGNOSES'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  patient_education: {
    capabilityId: 'patient_education',
    purpose: 'patient_education',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'DIAGNOSES', 'MEAL_PLAN', 'GOALS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  goal_suggestion: {
    capabilityId: 'goal_suggestion',
    purpose: 'goal_setting',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'DIAGNOSES', 'GOALS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  meal_plan_generation: {
    capabilityId: 'meal_plan_generation',
    purpose: 'meal_planning',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'DIAGNOSES', 'MEAL_PLAN', 'GOALS', 'RESTRICTIONS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'required',
    consentScope: REQUIRED_PATIENT_CONSENT,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: true,
    structuredAllowlists: {},
  },

  meal_plan_authoring: {
    capabilityId: 'meal_plan_authoring',
    purpose: 'meal_planning',
    allowedDataCategories: ['GOALS', 'RESTRICTIONS'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'not_required',
    consentScope: null,
    phiAllowed: false,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: false,
    structuredAllowlists: {},
  },

  dashboard_analytics: {
    capabilityId: 'dashboard_analytics',
    purpose: 'analytics',
    allowedDataCategories: [],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'not_required',
    consentScope: null,
    phiAllowed: false,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: false,
    pseudonymizePatientRef: false,
    structuredAllowlists: {},
  },

  model_evaluation: {
    capabilityId: 'model_evaluation',
    purpose: 'model_evaluation',
    allowedDataCategories: ['DEMOGRAPHICS_MINIMAL', 'CLINICAL_NOTES', 'ANTHROPOMETRY', 'LAB_RESULTS', 'MEAL_PLAN'],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'not_required',
    consentScope: null,
    phiAllowed: true,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: false,
    structuredAllowlists: {},
  },

  generic_assistant: {
    capabilityId: 'generic_assistant',
    purpose: 'administrative',
    allowedDataCategories: [],
    allowedFields: [],
    requiredFields: [],
    optionalFields: [],
    patientScope: 'not_required',
    consentScope: null,
    phiAllowed: false,
    requiresPurpose: true,
    requiredResidency: 'any',
    redactFreeText: true,
    pseudonymizePatientRef: false,
    structuredAllowlists: {},
  },
};

export const DEFAULT_EGRESS_CAPABILITY = 'generic_assistant';

export function getCapabilityContract(capabilityId: string): CapabilityDataContract | undefined {
  return CAPABILITY_CONTRACTS[capabilityId];
}

const AGENT_EGRESS_CAPABILITIES: Readonly<Record<string, string>> = {
  nutrition_support_agent: 'nutrition_reasoning',
  patient_overview_agent: 'patient_overview',
};

export function egressCapabilityForAgent(agentId: string): string {
  return AGENT_EGRESS_CAPABILITIES[agentId] ?? 'generic_assistant';
}

const TOOL_TO_SHAPE: Readonly<Record<string, StructuredShapeId>> = {
  patient_profile: 'patient_profile',
  anthropometry_tool: 'anthropometry',
  meal_plan: 'meal_plan',
  lab_results: 'lab_panel',
  adherence_summary: 'adherence_row',
  recent_consultations: 'consultation_row',
};

export function filterToolResultByCapability(toolId: string, value: unknown, capabilityId: string): { filtered: unknown; removed: string[] } {
  const contract = getCapabilityContract(capabilityId);
  if (!contract) return { filtered: emptyFor(value), removed: [`${toolId}.*`] };
  const shape = TOOL_TO_SHAPE[toolId];
  if (!shape) return { filtered: emptyFor(value), removed: [`${toolId}.*`] };
  const allowlist = contract.structuredAllowlists[shape];
  if (!allowlist || allowlist.length === 0) return { filtered: emptyFor(value), removed: [`${toolId}.*`] };
  const { filtered, removed } = filterByAllowlist(value, allowlist);
  return { filtered, removed: removed.map((path) => `${toolId}.${path}`) };
}

export function filterStructuredShape(shape: string, value: unknown, capabilityId: string): { filtered: unknown; removed: string[] } {
  const contract = getCapabilityContract(capabilityId);
  if (!contract) return { filtered: emptyFor(value), removed: [`${shape}.*`] };
  const allowlist = contract.structuredAllowlists[shape as StructuredShapeId];
  if (!allowlist || allowlist.length === 0) return { filtered: emptyFor(value), removed: [`${shape}.*`] };
  const { filtered, removed } = filterByAllowlist(value, allowlist);
  return { filtered, removed: removed.map((path) => `${shape}.${path}`) };
}
