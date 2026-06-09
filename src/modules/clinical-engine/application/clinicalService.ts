import { ClinicalSuggestionEngine, type SuggestionInputs } from "./ClinicalSuggestionEngine";
import type { DiagnosticSuggestion, PlanTargetSuggestion } from "../domain/Suggestion";
import type { ActivityLevelKey } from "@utils/calculations/tdee";

const engine = new ClinicalSuggestionEngine();

export const clinicalService = {
  suggestDiagnoses(inputs: SuggestionInputs): DiagnosticSuggestion[] {
    return engine.suggestDiagnoses(inputs);
  },

  suggestMealPlanTargets(
    inputs: SuggestionInputs,
    activityLevel?: ActivityLevelKey,
  ): PlanTargetSuggestion | null {
    return engine.suggestMealPlanTargets(inputs, activityLevel);
  },
};
