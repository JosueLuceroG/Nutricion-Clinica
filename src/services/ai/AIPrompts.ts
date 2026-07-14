export type CapabilityId =
  | "summarizeConsultation"
  | "interpretLabResults"
  | "suggestSubstitutions"
  | "generateEducationContent"
  | "draftClinicalNotes"
  | "generateGoalSuggestions"
  | "explainDiagnosisToPatient"
  | "generateMealPlanInitial"
  | "generateDashboardKpi";

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

export interface GenerateDashboardKpiContext extends PromptContext {
  request: string;
  availableFields: Array<{
    source: string;
    valueField: string;
    label: string;
    allowedMetrics: string[];
    format: string;
  }>;
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

  generateDashboardKpi: `Eres un asistente de configuración de dashboards para un consultorio de nutrición. Convierte la petición del usuario en UN KPI usando exclusivamente un valueField y una métrica incluidos en availableFields. No inventes fuentes, campos, filtros, cálculos, SQL ni datos clínicos. Responde únicamente un objeto JSON, sin Markdown ni texto adicional, con estas claves exactas: name, description, source, valueField, metric, comparison, visualization, tone, iconKey, category, size, precision, notation, prefix, suffix, trendDirection, reasoning.

Usa estrictamente estos valores:
- source: patients | consultations | payments | plans | agenda | system
- metric: count | sum | average | percentage, y debe estar incluido en allowedMetrics del valueField
- comparison: none | previousPeriod; ante cualquier duda usa none
- visualization: largeNumber | percentage | progress | simpleCard. Si el usuario pide barra usa progress, NUNCA uses bar. percentage y progress requieren metric percentage
- tone: green | blue | purple | orange | cyan | rose | slate
- iconKey: users | calendar | clipboard | money | mealPlan | sync | sparkles
- category: general | patients | consultations | payments | agenda | plans | finance | system | custom
- size: small | wide
- precision: número entero 0 | 1 | 2 que indica la cantidad de decimales. Para un decimal devuelve 1, NUNCA 0.1; para dos devuelve 2, NUNCA 0.01
- notation: standard | compact
- prefix y suffix: texto, pueden ser cadenas vacías
- trendDirection: increaseIsPositive | decreaseIsPositive | neutral

No traduzcas, anotes ni combines los valores enum. Por ejemplo, devuelve blue y no azul; progress y no bar, barra ni "simpleCard (barra)".

reasoning debe explicar brevemente qué se eligió para que el usuario pueda confirmarlo.`,

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
