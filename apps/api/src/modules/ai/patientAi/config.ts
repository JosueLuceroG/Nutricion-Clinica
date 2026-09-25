export interface PatientAiConfig {
  enabled: boolean;
  maxQueryChars: number;
}

export function readPatientAiConfig(env: NodeJS.ProcessEnv = process.env): PatientAiConfig {
  const parsedMax = Number(env.AI_PATIENT_MAX_QUERY_CHARS ?? 500);
  return {
    enabled: (env.AI_PATIENT_ENABLED ?? 'false') === 'true',
    maxQueryChars: Number.isFinite(parsedMax) && parsedMax > 0 ? Math.round(parsedMax) : 500,
  };
}