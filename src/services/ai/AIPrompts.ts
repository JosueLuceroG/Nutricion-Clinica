export type CapabilityId =
  | "summarizeConsultation"
  | "interpretLabResults"
  | "suggestSubstitutions"
  | "generateEducationContent"
  | "draftClinicalNotes"
  | "generateGoalSuggestions"
  | "explainDiagnosisToPatient"
  | "generateMealPlanInitial";

export interface PromptContext {
  language: string;
}

export interface SummarizeConsultationContext extends PromptContext {
  reason: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  vitals: string;
  anthropometrySummary: string;
  labSummary: string;
}

export interface InterpretLabResultsContext extends PromptContext {
  testResults: Array<{ name: string; value: number; unit: string; range: string; flag?: string }>;
  patientAge: number;
  patientSex: string;
  diagnosis: string;
}

export interface SuggestSubstitutionsContext extends PromptContext {
  foodName: string;
  restrictions: string[];
  mealSlot: string;
  count: number;
}

export interface GenerateEducationContentContext extends PromptContext {
  topic: string;
  patientAge: number;
  educationLevel: string;
  diagnosis: string;
}

export interface DraftClinicalNotesContext extends PromptContext {
  reason: string;
  subjective: string;
  objective: string;
  vitals: string;
  anthropometrySummary: string;
  labSummary: string;
}

export interface GenerateGoalSuggestionsContext extends PromptContext {
  patientAge: number;
  patientSex: string;
  bmi: number;
  diagnosis: string[];
  recentLabs: string;
  goalHistory: string;
}

export interface ExplainDiagnosisToPatientContext extends PromptContext {
  diagnosis: string;
  patientAge: number;
  educationLevel: string;
  additionalContext: string;
}

export interface GenerateMealPlanInitialContext extends PromptContext {
  patientAge: number;
  patientSex: string;
  bmi: number;
  kcalTarget: number;
  restrictions: string[];
  preferences: string[];
  diagnosis: string;
}

const SYSTEM_PROMPTS: Record<CapabilityId, string> = {
  summarizeConsultation: `Eres un asistente de redacción clínica especializado en nutrición. Genera un resumen narrativo de la consulta en máximo 400 palabras. Estructura: motivo de consulta, hallazgos subjetivos y objetivos, evaluación, plan. Usa lenguaje profesional pero conciso. Responde solo el resumen, sin prefacios.`,

  interpretLabResults: `Eres un especialista en interpretación de laboratorios clínicos con enfoque en nutrición. Analiza los resultados proporcionados y genera:
1. Resumen de hallazgos relevantes
2. Correlaciones entre parámetros alterados
3. Sugerencias de estudios complementarios
Sé específico pero evita diagnósticos definitivos. Responde en máximo 300 palabras.`,

  suggestSubstitutions: `Eres un experto en el sistema SMAE de equivalentes. Dado un alimento, restricciones dietéticas y tiempo de comida, sugiere alternativas equivalentes en valor nutrimental. Para cada sugerencia proporciona: nombre del alimento, grupo de equivalente, porción equivalente. Responde en formato de lista.`,

  generateEducationContent: `Eres un educador en salud especializado en nutrición. Genera material educativo adaptado al nivel del paciente. Usa lenguaje claro, evitando jerga médica. Incluye: qué es, por qué es importante, recomendaciones prácticas. Máximo 200 palabras.`,

  draftClinicalNotes: `Eres un asistente de redacción SOAP para notas de consulta nutricional. Genera un borrador de nota clínica estructurada en formato SOAP (Subjetivo, Objetivo, Evaluación, Plan) basado en los datos proporcionados. Máximo 400 palabras.`,

  generateGoalSuggestions: `Eres un especialista en establecimiento de objetivos nutrimentales. Basado en el perfil del paciente, sugiere metas SMART (Specific, Measurable, Achievable, Relevant, Time-bound). Incluye metas de peso, parámetros bioquímicos, y hábitos alimentarios. Máximo 3 metas, cada una con indicador y plazo sugerido.`,

  explainDiagnosisToPatient: `Eres un comunicador en salud. Explica el diagnóstico nutricional al paciente en lenguaje accesible. Incluye: qué significa el diagnóstico, cómo afecta su salud, y qué puede esperar del tratamiento. Evita terminología médica. Máximo 250 palabras.`,

  generateMealPlanInitial: `Eres un nutriólogo experto en el sistema SMAE de equivalentes. Genera un menú borrador de 24 horas (desayuno, colación matutina, comida, colación vespertina, cena) basado en el perfil del paciente y objetivo calórico. Cada tiempo debe especificar: grupo de equivalente, cantidad, y ejemplo de alimentos.`,

};

function buildLanguageInstruction(language: string): string {
  if (language === "es-MX") {
    return "Responde en español (México), usando terminología local.";
  }
  return "Respond in English.";
}

export function buildSystemPrompt(capability: CapabilityId, language: string): string {
  const base = SYSTEM_PROMPTS[capability];
  const langInstr = buildLanguageInstruction(language);
  return `${base}\n\n${langInstr}`;
}

export function buildUserPrompt(_capability: CapabilityId, context: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined || value === "") continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    lines.push(`${label}:`);
    lines.push(`${JSON.stringify(value, null, 2)}`);
  }

  return lines.join("\n");
}
