export { aiClient, isAIEnvironmentEnabled } from "./AIClient";
export { aiService } from "./AIService";
export type { AIExecuteOptions } from "./AIService";
export { AI_CAPABILITIES, getCapabilityDef } from "./AICapabilities";
export type { AICapabilityDef } from "./AICapabilities";
export type {
  CapabilityId,
  SummarizeConsultationContext,
  InterpretLabResultsContext,
  SuggestSubstitutionsContext,
  GenerateEducationContentContext,
  DraftClinicalNotesContext,
  GenerateGoalSuggestionsContext,
  ExplainDiagnosisToPatientContext,
  GenerateMealPlanInitialContext,
} from "./AIPrompts";
export type { ParsedResponse } from "./AIResponseParser";
