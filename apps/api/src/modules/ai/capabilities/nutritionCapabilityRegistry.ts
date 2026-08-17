/**
 * Catálogo canónico de las 21 capacidades del Experto en Nutrición (Build 06).
 *
 * Cada entrada declara:
 *  - status: IMPLEMENTED / PARTIAL (cobertura limitada documentada) / BLOCKED
 *    (sin fuente autoritativa → no se implementa).
 *  - tools: herramientas ERP read-only que alimentan la capacidad.
 *  - deterministicOnly: sin etapa LLM (determinista puro).
 *  - llmStage: etapa opcional de interpretación/redacción por el modelo.
 *  - riskCapability: entrada del capabilityRiskRegistry (Build 05) que
 *    gobierna riesgo y revisión. No se inventan niveles de riesgo nuevos.
 *
 * Regla del build: NUNCA se fuerza 21/21. Si no hay fuente autoritativa,
 * la capacidad es BLOCKED y se reporta como tal.
 */

export type CapabilityStatus = 'IMPLEMENTED' | 'PARTIAL' | 'BLOCKED';

export interface NutritionCapabilityEntry {
  capabilityId: string;
  name: string;
  status: CapabilityStatus;
  tools: string[];
  deterministicOnly: boolean;
  llmStage: boolean;
  riskCapability: string;
  outputSchemaVersion: string;
  blockedReason?: string;
  notes?: string;
}

export const NUTRITION_CAPABILITY_CATALOG: readonly NutritionCapabilityEntry[] = [
  {
    capabilityId: 'prepareNutritionConsultation',
    name: 'Preparar consulta nutricional',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'recent_consultations', 'lab_results', 'meal_plan', 'adherence_summary', 'get_medications', 'get_allergies', 'get_intolerances', 'get_diagnoses', 'get_patient_metrics'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.prepare_consultation.v1',
    notes: 'Bundle estructurado para la consulta: perfil, antropometría, laboratorios, plan, adherencia, medicamentos, alergias, condiciones y métricas; detecta brechas de datos.',
  },
  {
    capabilityId: 'summarizeNutritionHistory',
    name: 'Resumir historia nutricional',
    status: 'IMPLEMENTED',
    tools: ['get_patient_history'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'clinical_summary',
    outputSchemaVersion: 'cap.summarize_history.v1',
    notes: 'Resumen acotado por ventana: conteos, último peso, últimas fechas, tendencias.',
  },
  {
    capabilityId: 'detectNutritionDataGaps',
    name: 'Detectar brechas de datos nutricionales',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'lab_results', 'meal_plan', 'adherence_summary', 'get_allergies'],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'patient_overview',
    outputSchemaVersion: 'cap.detect_gaps.v1',
    notes: 'Determinista: campos requeridos vs presentes; severidad por campo.',
  },
  {
    capabilityId: 'generateNutritionQuestions',
    name: 'Generar preguntas nutricionales',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'lab_results', 'meal_plan', 'adherence_summary'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.generate_questions.v1',
    notes: 'Preguntas derivadas de brechas de datos (plantillas deterministas); el LLM solo reformula.',
  },
  {
    capabilityId: 'draftNutritionNote',
    name: 'Redactar nota nutricional (borrador)',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'recent_consultations', 'lab_results', 'meal_plan', 'adherence_summary', 'get_medications', 'get_allergies'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'clinical_notes_draft',
    outputSchemaVersion: 'cap.draft_note.v1',
    notes: 'BORRADOR SOAP: secciones objetivas deterministas + narrativa del modelo; nunca se persiste automáticamente.',
  },
  {
    capabilityId: 'analyzeAnthropometry',
    name: 'Analizar antropometría',
    status: 'IMPLEMENTED',
    tools: ['anthropometry_tool', 'get_evolution'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.analyze_anthropometry.v1',
    notes: 'Calculadoras deterministas (IMC, TMB, hidratación, proteína) + tendencia peso/IMC; el LLM interpreta.',
  },
  {
    capabilityId: 'analyzeAdherence',
    name: 'Analizar adherencia',
    status: 'IMPLEMENTED',
    tools: ['adherence_summary'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.analyze_adherence.v1',
    notes: 'Agregados deterministas (menú/agua/sueño) + tendencia entre mitades del periodo.',
  },
  {
    capabilityId: 'summarizeRelevantLabs',
    name: 'Resumir laboratorios relevantes',
    status: 'IMPLEMENTED',
    tools: ['lab_results'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'lab_interpretation',
    outputSchemaVersion: 'cap.summarize_labs.v1',
    notes: 'Hechos observados de resultados_json; la interpretación se etiqueta como AI_INTERPRETATION.',
  },
  {
    capabilityId: 'analyzeNutritionEvolution',
    name: 'Analizar evolución nutricional',
    status: 'IMPLEMENTED',
    tools: ['get_evolution'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.analyze_evolution.v1',
    notes: 'Alcance físico (peso/IMC desde antropometrías). La evolución conductual no tiene fuente autoritativa.',
  },
  {
    capabilityId: 'analyzeBodyComposition',
    name: 'Analizar composición corporal',
    status: 'IMPLEMENTED',
    tools: ['get_body_composition'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.analyze_body_composition.v1',
    notes: 'Etiquetado MEASURED vs CALCULATED; el LLM interpreta sin inventar fórmulas.',
  },
  {
    capabilityId: 'analyzeNutritionGoals',
    name: 'Analizar objetivos nutricionales',
    status: 'BLOCKED',
    tools: [],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.analyze_goals.v1',
    blockedReason: 'BLOCKED — authoritative source unavailable: los objetivos del paciente viven solo en el cliente (Dexie); no existe tabla de objetivos en el ERP.',
  },
  {
    capabilityId: 'reviewDrugNutrientInteractions',
    name: 'Revisar interacciones medicamento-nutriente',
    status: 'PARTIAL',
    tools: ['get_medications'],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'lab_interpretation',
    outputSchemaVersion: 'cap.review_interactions.v1',
    notes: 'PARTIAL: cubre únicamente las 9 reglas documentadas del producto (drug-nutrient.v1). No se afirma cobertura farmacológica completa; los medicamentos sin regla se reportan como NO_COVERED.',
  },
  {
    capabilityId: 'compareAgainstProtocol',
    name: 'Comparar contra protocolo',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'lab_results', 'get_diagnoses'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.compare_protocol.v1',
    notes: 'Recuperación RAG + verificación de citas; sin fuentes recuperadas → abstiene (KNOWLEDGE_UNAVAILABLE).',
  },
  {
    capabilityId: 'generatePatientEducation',
    name: 'Generar educación al paciente',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'meal_plan'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'patient_education',
    outputSchemaVersion: 'cap.patient_education.v1',
    notes: 'Material educativo RISK_1; no sustituye consejo profesional.',
  },
  {
    capabilityId: 'explainNutritionRecommendation',
    name: 'Explicar recomendación nutricional',
    status: 'IMPLEMENTED',
    tools: ['patient_profile', 'anthropometry_tool', 'meal_plan', 'lab_results'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.explain_recommendation.v1',
    notes: 'Explica con hechos deterministas (objetivos del plan, calculadoras, banderas); el LLM no inventa cifras.',
  },
  {
    capabilityId: 'reviewMealPlan',
    name: 'Revisar plan alimenticio',
    status: 'IMPLEMENTED',
    tools: ['get_diet', 'get_allergies', 'get_intolerances', 'patient_profile'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'meal_substitution',
    outputSchemaVersion: 'cap.review_meal_plan.v1',
    notes: 'Validación SMAE determinista + bloqueos por alergia/intolerancia + desviación de objetivos + narrativa.',
  },
  {
    capabilityId: 'validateMealPlan',
    name: 'Validar plan alimenticio',
    status: 'IMPLEMENTED',
    tools: ['get_diet', 'get_allergies', 'get_intolerances'],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'meal_substitution',
    outputSchemaVersion: 'cap.validate_meal_plan.v1',
    notes: 'Determinista puro (sin LLM): equivalentes SMAE, alergenos, intolerancias, objetivos y tolerancia.',
  },
  {
    capabilityId: 'suggestFoodSubstitutions',
    name: 'Sugerir sustituciones de alimentos',
    status: 'IMPLEMENTED',
    tools: ['get_allergies', 'get_intolerances'],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'meal_substitution',
    outputSchemaVersion: 'cap.suggest_substitutions.v1',
    notes: 'Candidatos dentro del MISMO grupo SMAE, filtrados por alergias/intolerancias. El LLM nunca propone candidatos fuera del catálogo.',
  },
  {
    capabilityId: 'analyzeNutrientIntake',
    name: 'Analizar ingesta de nutrientes',
    status: 'IMPLEMENTED',
    tools: ['get_diet'],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.analyze_intake.v1',
    notes: 'Determinista: equivalentes del plan vs catálogo SMAE; reporta cobertura del catálogo y ítems no catalogados.',
  },
  {
    capabilityId: 'draftMealPlan',
    name: 'Redactar plan alimenticio (borrador)',
    status: 'IMPLEMENTED',
    tools: ['get_allergies', 'get_intolerances', 'patient_profile', 'anthropometry_tool'],
    deterministicOnly: false,
    llmStage: true,
    riskCapability: 'meal_plan_authoring',
    outputSchemaVersion: 'cap.draft_meal_plan.v1',
    notes: 'Borrador que respeta bloqueos deterministas (alergenos/intolerancias) y validez SMAE; revalidación posterior obligatoria; RISK_4.',
  },
  {
    capabilityId: 'detectPotentialNutritionRisks',
    name: 'Detectar riesgos nutricionales potenciales',
    status: 'IMPLEMENTED',
    tools: ['get_allergies', 'anthropometry_tool', 'get_medications', 'get_diet', 'lab_results'],
    deterministicOnly: true,
    llmStage: false,
    riskCapability: 'nutrition_reasoning',
    outputSchemaVersion: 'cap.detect_risks.v1',
    notes: 'Señales deterministas: alergia severa/anafilaxia, IMC extremo, interacción severa, desviación de objetivos, laboratorios ausentes. Eleva a RISK_5 cuando aplica.',
  },
];

export function getNutritionCapability(capabilityId: string): NutritionCapabilityEntry | undefined {
  return NUTRITION_CAPABILITY_CATALOG.find((entry) => entry.capabilityId === capabilityId);
}