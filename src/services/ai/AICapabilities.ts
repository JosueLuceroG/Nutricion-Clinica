import type { CapabilityId } from "./AIPrompts";

export interface AICapabilityDef {
  id: CapabilityId;
  nameKey: string;
  descriptionKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  cacheable: boolean;
  cacheTtlMinutes: number;
}

export const AI_CAPABILITIES: AICapabilityDef[] = [
  {
    id: "summarizeConsultation",
    nameKey: "ai.capability.summarize_consultation",
    descriptionKey: "ai.capability.summarize_consultation_desc",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 600,
    cacheable: true,
    cacheTtlMinutes: 60,
  },
  {
    id: "interpretLabResults",
    nameKey: "ai.capability.interpret_labs",
    descriptionKey: "ai.capability.interpret_labs_desc",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 600,
    cacheable: true,
    cacheTtlMinutes: 1440,
  },
  {
    id: "suggestSubstitutions",
    nameKey: "ai.capability.suggest_substitutions",
    descriptionKey: "ai.capability.suggest_substitutions_desc",
    model: "gpt-4o-mini",
    temperature: 0.4,
    maxTokens: 500,
    cacheable: true,
    cacheTtlMinutes: 30,
  },
  {
    id: "generateEducationContent",
    nameKey: "ai.capability.generate_education",
    descriptionKey: "ai.capability.generate_education_desc",
    model: "gpt-4o-mini",
    temperature: 0.5,
    maxTokens: 500,
    cacheable: true,
    cacheTtlMinutes: 1440,
  },
  {
    id: "draftClinicalNotes",
    nameKey: "ai.capability.draft_notes",
    descriptionKey: "ai.capability.draft_notes_desc",
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 600,
    cacheable: false,
    cacheTtlMinutes: 0,
  },
  {
    id: "generateGoalSuggestions",
    nameKey: "ai.capability.generate_goals",
    descriptionKey: "ai.capability.generate_goals_desc",
    model: "gpt-4o-mini",
    temperature: 0.4,
    maxTokens: 500,
    cacheable: true,
    cacheTtlMinutes: 60,
  },
  {
    id: "explainDiagnosisToPatient",
    nameKey: "ai.capability.explain_diagnosis",
    descriptionKey: "ai.capability.explain_diagnosis_desc",
    model: "gpt-4o-mini",
    temperature: 0.5,
    maxTokens: 400,
    cacheable: true,
    cacheTtlMinutes: 1440,
  },
  {
    id: "generateMealPlanInitial",
    nameKey: "ai.capability.generate_meal_plan",
    descriptionKey: "ai.capability.generate_meal_plan_desc",
    model: "gpt-4o-mini",
    temperature: 0.4,
    maxTokens: 800,
    cacheable: false,
    cacheTtlMinutes: 0,
  },
  {
    id: "generateDashboardKpi",
    nameKey: "ai.capability.generate_dashboard_kpi",
    descriptionKey: "ai.capability.generate_dashboard_kpi_desc",
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 450,
    cacheable: false,
    cacheTtlMinutes: 0,
  },
];

export function getCapabilityDef(id: CapabilityId): AICapabilityDef | undefined {
  return AI_CAPABILITIES.find((c) => c.id === id);
}
