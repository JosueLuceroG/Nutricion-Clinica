export type ClinicalReviewStoreKind = "memory" | "sql";

export interface ClinicalGateConfig {
  expertEnabled: boolean;
  shadowModeEnabled: boolean;
  shadowSampleRate: number;
  disagreementThreshold: number;
  windowDays: number;
  reviewStore: ClinicalReviewStoreKind;
}

function bool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === "true";
}

function number(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function readClinicalGateConfig(
  env: NodeJS.ProcessEnv = process.env,
): ClinicalGateConfig {
  const sampleRate = number(env.AI_SHADOW_SAMPLE_RATE, 0.0);
  return {
    expertEnabled: bool(env.AI_EXPERT_ENABLED, false),
    shadowModeEnabled: bool(env.AI_SHADOW_MODE_ENABLED, false),
    shadowSampleRate: Math.min(1, Math.max(0, sampleRate)),
    disagreementThreshold: Math.max(
      1,
      Math.round(number(env.AI_CLINICAL_DISAGREEMENT_THRESHOLD, 3)),
    ),
    windowDays: Math.max(1, Math.round(number(env.AI_CLINICAL_WINDOW_DAYS, 7))),
    reviewStore:
      env.AI_CLINICAL_REVIEW_STORE?.trim() === "sql" ? "sql" : "memory",
  };
}
