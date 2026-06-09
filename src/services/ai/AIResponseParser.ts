import { z } from "zod";
import type { CapabilityId } from "./AIPrompts";

export interface ParsedResponse<T = unknown> {
  success: boolean;
  data: T | null;
  raw: string;
  confidence: number;
  error?: string;
}

const SummarySchema = z.object({
  summary: z.string().min(1).max(2000),
});

const LabInterpretationSchema = z.object({
  findings: z.array(z.string()),
  correlations: z.array(z.string()),
  suggestions: z.array(z.string()),
});

const SubstitutionSchema = z.object({
  substitutions: z.array(
    z.object({
      foodName: z.string(),
      group: z.string(),
      portion: z.string(),
    }),
  ),
});

const EducationContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  recommendations: z.array(z.string()),
});

const ClinicalNotesSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});

const GoalSuggestionSchema = z.object({
  goals: z.array(
    z.object({
      goal: z.string(),
      indicator: z.string(),
      timeframe: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const PatientExplanationSchema = z.object({
  explanation: z.string(),
  keyPoints: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

const MealPlanInitialSchema = z.object({
  meals: z.array(
    z.object({
      slot: z.string(),
      exchanges: z.array(
        z.object({
          group: z.string(),
          quantity: z.number(),
          examples: z.array(z.string()),
        }),
      ),
    }),
  ),
  totalKcal: z.number(),
  notes: z.string().optional(),
});

function tryParseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractStructured(raw: string): Record<string, unknown> | null {
  const json = tryParseJson(raw);
  if (json) return json;

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return tryParseJson(jsonMatch[0]);
  }

  return null;
}

function computeConfidence(parsed: { success: boolean }, rawLength: number): number {
  if (!parsed.success) return 0;
  if (rawLength < 20) return 0.3;
  if (rawLength > 500) return 0.9;
  return 0.7;
}

const PARSERS: Record<CapabilityId, z.ZodSchema> = {
  summarizeConsultation: SummarySchema,
  interpretLabResults: LabInterpretationSchema,
  suggestSubstitutions: SubstitutionSchema,
  generateEducationContent: EducationContentSchema,
  draftClinicalNotes: ClinicalNotesSchema,
  generateGoalSuggestions: GoalSuggestionSchema,
  explainDiagnosisToPatient: PatientExplanationSchema,
  generateMealPlanInitial: MealPlanInitialSchema,
};

export function parseResponse<T>(capability: CapabilityId, raw: string): ParsedResponse<T> {
  const schema = PARSERS[capability];
  if (!schema) {
    return { success: false, data: null, raw, confidence: 0, error: `Unknown capability: ${capability}` };
  }

  const structured = extractStructured(raw);
  if (!structured) {
    return { success: false, data: null, raw, confidence: 0.1, error: "Could not parse structured data from response" };
  }

  const result = schema.safeParse(structured);
  if (!result.success) {
    return {
      success: false,
      data: null,
      raw,
      confidence: 0.2,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  return {
    success: true,
    data: result.data as T,
    raw,
    confidence: computeConfidence(result, raw.length),
  };
}
