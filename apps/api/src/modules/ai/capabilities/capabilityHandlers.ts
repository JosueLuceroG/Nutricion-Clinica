import { evaluateDrugNutrientInteractions } from './drugNutrientRules.js';
import { runCalculatorsDetailed, type BmiResult, type CalculatorResult } from '../expert/calculators.js';
import { summarizeExchanges, validateMealPlan, suggestSubstitutions, type MealPlanValidation } from '../smae/smaeEngine.js';
import { SMAE_CATALOG_VERSION } from '../smae/smaeCatalog.js';
import { computeFreshness } from '../tools/toolDefinition.js';
import type { RetrievedChunk } from '../rag/retrieval.js';
import type { CapabilityRunRequest } from './nutritionCapabilityService.js';

/**
 * Handlers deterministas de capacidades. Cada handler recibe los datos ya
 * recolectados de las herramientas y produce hechos (facts), payload y
 * opcionalmente una abstención. NUNCA invocan al LLM.
 */

export interface CapabilityFact {
  claimType: 'OBSERVED_FACT' | 'CALCULATED_VALUE' | 'RULE_RESULT' | 'DOCUMENTED_GUIDANCE' | 'AI_INTERPRETATION' | 'AI_RECOMMENDATION';
  text: string;
  source: { type: 'erp' | 'calculator' | 'rule_engine' | 'knowledge' | 'model_inference'; ref: string; version?: string; retrievedAt?: string };
}

export interface CapabilityFlag {
  id: string;
  severity: 'info' | 'warning' | 'blocker';
  message: string;
  ruleId?: string;
}

export interface DeterministicResult {
  facts: CapabilityFact[];
  flags: CapabilityFlag[];
  payload: Record<string, unknown>;
  /** Secciones seguras para el prompt del modelo (sin PII cruda). */
  promptSections: string[];
  /** Números permitidos para la validación de salida del LLM. */
  allowedNumbers?: number[];
  /** Fuentes de conocimiento recuperadas (RAG) que respaldan la salida. */
  knowledge?: RetrievedChunk[];
  abstain?: { kind: string; reason: string };
}

export interface HandlerContext {
  request: CapabilityRunRequest;
  tools: Record<string, unknown>;
  toolFailures: string[];
  now: Date;
  retrieveKnowledge: (query: string) => Promise<RetrievedChunk[]>;
}

export type CapabilityHandler = (ctx: HandlerContext) => Promise<DeterministicResult>;

const tool = (ctx: HandlerContext, toolId: string): unknown => ctx.tools[toolId];

const asArray = (value: unknown): Array<Record<string, unknown>> => (Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []);

const asNumber = (value: unknown): number | null => {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : undefined;
  return num !== undefined && !Number.isNaN(num) ? num : null;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

function fact(ctx: HandlerContext, claimType: CapabilityFact['claimType'], text: string, source: { type: 'erp' | 'calculator' | 'rule_engine'; ref: string; version?: string }): CapabilityFact {
  return { claimType, text, source: { ...source, retrievedAt: ctx.now.toISOString() } };
}

/** Coincidencia acento/uso-insensible para alergias e intolerancias. */
export function matchesRestriction(text: string, restrictions: string[]): boolean {
  const normalized = (value: string): string => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const target = normalized(text);
  return restrictions.some((restriction) => {
    const r = normalized(restriction);
    return r.length > 0 && target.includes(r);
  });
}

/** Bloqueo determinista: el término coincide con el alimento o con su grupo (p. ej. 'lactosa' → grupos de leche). */
export function restrictionMatchesItem(item: Record<string, unknown>, restrictions: string[]): boolean {
  const name = String(item.foodName ?? item.foodName ?? '');
  if (matchesRestriction(name, restrictions)) return true;
  const group = String(item.group ?? '');
  return restrictions.some((restriction) => {
    const r = restriction.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return group.includes('leche') && (r.includes('lact') || r.includes('leche') || r.includes('casein'));
  });
}

function restrictionFacts(_ctx: HandlerContext, payload: Record<string, unknown>): { allergens: string[]; intolerances: string[] } {
  const allergies = asArray(payload.allergies);
  const intolerances = asArray(payload.intolerances);
  return {
    allergens: allergies.map((a) => String(a.sustancia ?? '')).filter(Boolean),
    intolerances: intolerances.map((i) => String(i.alimento ?? '')).filter(Boolean),
  };
}

function allergyFlags(_ctx: HandlerContext, allergies: Array<Record<string, unknown>>): CapabilityFlag[] {
  return allergies
    .filter((a) => ['severa', 'anafilaxia'].includes(String(a.severidad ?? '')))
    .map((a) => ({
      id: `allergy-${String(a.id ?? '')}`,
      severity: 'blocker' as const,
      message: `Alergia severa documentada: ${String(a.sustancia ?? '')} (${String(a.severidad ?? '')})`,
      ruleId: 'rule.allergy.severe',
    }));
}

const planItemsFrom = (ctx: HandlerContext): Array<Record<string, unknown>> => {
  const requested = ctx.request.input?.planItems;
  if (Array.isArray(requested)) return requested as Array<Record<string, unknown>>;
  const diet = tool(ctx, 'get_diet');
  if (diet && typeof diet === 'object' && 'meals_json' in diet) {
    const meals = (diet as Record<string, unknown>).meals_json;
    if (Array.isArray(meals)) return meals as Array<Record<string, unknown>>;
    if (typeof meals === 'string') {
      try {
        const parsed = JSON.parse(meals);
        return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
      } catch {
        return [];
      }
    }
  }
  return [];
};

const planTargetsFrom = (ctx: HandlerContext): { kcal: number; proteinG: number; carbsG: number; fatG: number } | undefined => {
  const diet = tool(ctx, 'get_diet');
  if (!diet || typeof diet !== 'object') return undefined;
  const row = diet as Record<string, unknown>;
  const kcal = asNumber(row.kcal_target);
  const proteinG = asNumber(row.protein_target_g);
  const carbsG = asNumber(row.carbs_target_g);
  const fatG = asNumber(row.fat_target_g);
  if (kcal === null) return undefined;
  return { kcal, proteinG: proteinG ?? 0, carbsG: carbsG ?? 0, fatG: fatG ?? 0 };
};

export const capabilityHandlers: Record<string, CapabilityHandler> = {
  async prepareNutritionConsultation(ctx) {
    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [];
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const consultations = asArray(tool(ctx, 'recent_consultations'));
    const labs = asArray(tool(ctx, 'lab_results'));
    const plan = tool(ctx, 'meal_plan');
    const adherence = asArray(tool(ctx, 'adherence_summary'));
    const medications = asArray(tool(ctx, 'get_medications'));
    const allergies = asArray(tool(ctx, 'get_allergies'));
    const intolerances = asArray(tool(ctx, 'get_intolerances'));
    const diagnoses = asArray(tool(ctx, 'get_diagnoses'));
    const metrics = tool(ctx, 'get_patient_metrics');

    if (profile) facts.push(fact(ctx, 'OBSERVED_FACT', 'Perfil del paciente disponible', { type: 'erp', ref: 'patient_profile' }));
    if (anthropometry) {
      const row = anthropometry as Record<string, unknown>;
      facts.push(fact(ctx, 'OBSERVED_FACT', `Antropometría reciente: peso ${row.weightKg} kg, talla ${row.heightM} m (${row.measuredAt})`, { type: 'erp', ref: 'anthropometry_tool' }));
    }
    if (consultations.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${consultations.length} consultas recientes`, { type: 'erp', ref: 'recent_consultations' }));
    if (labs.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${labs.length} paneles de laboratorio recientes`, { type: 'erp', ref: 'lab_results' }));
    if (plan) {
      const row = plan as Record<string, unknown>;
      facts.push(fact(ctx, 'OBSERVED_FACT', `Plan activo: ${String(row.name ?? 'sin nombre')} (${row.kcal_target ?? '?'} kcal objetivo)`, { type: 'erp', ref: 'meal_plan' }));
    }
    if (adherence.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${adherence.length} registros de adherencia recientes`, { type: 'erp', ref: 'adherence_summary' }));
    if (medications.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${medications.length} medicamentos activos`, { type: 'erp', ref: 'get_medications' }));
    if (allergies.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${allergies.length} alergias registradas`, { type: 'erp', ref: 'get_allergies' }));
    if (intolerances.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${intolerances.length} intolerancias registradas`, { type: 'erp', ref: 'get_intolerances' }));
    if (diagnoses.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${diagnoses.length} condiciones registradas`, { type: 'erp', ref: 'get_diagnoses' }));
    flags.push(...allergyFlags(ctx, allergies));

    const gaps = buildDataGaps({ profile: Boolean(profile), anthropometry: Boolean(anthropometry), anthropometryRecent: anthropometryIsRecent(anthropometry, ctx.now), labs: labs.length > 0, plan: Boolean(plan), adherence: adherence.length > 0, allergies: allergies.length > 0, medications: medications.length > 0 });
    for (const gap of gaps) {
      facts.push(fact(ctx, 'RULE_RESULT', `Brecha de datos: ${gap.field}`, { type: 'rule_engine', ref: 'rule.data_gaps' }));
    }

    return {
      facts,
      flags,
      payload: {
        profilePresent: Boolean(profile),
        anthropometryPresent: Boolean(anthropometry),
        consultationsCount: consultations.length,
        labsCount: labs.length,
        planPresent: Boolean(plan),
        adherenceCount: adherence.length,
        medicationsCount: medications.length,
        allergiesCount: allergies.length,
        intolerancesCount: intolerances.length,
        diagnosesCount: diagnoses.length,
        metrics,
        gaps,
      },
      promptSections: [
        facts.map((f) => `- ${f.text}`).join('\n'),
        gaps.length > 0 ? `Brechas detectadas: ${gaps.map((g) => g.field).join(', ')}` : 'Sin brechas críticas de datos.',
      ],
      allowedNumbers: [
        consultations.length, labs.length, adherence.length, medications.length, allergies.length, intolerances.length, diagnoses.length,
        ...(plan && typeof plan === 'object' && typeof (plan as Record<string, unknown>).kcal_target === 'number' ? [(plan as Record<string, unknown>).kcal_target as number] : []),
      ],
    };
  },

  async summarizeNutritionHistory(ctx) {
    const history = tool(ctx, 'get_patient_history');
    const facts: CapabilityFact[] = [];
    if (!history || typeof history !== 'object') {
      return {
        facts,
        flags: [{ id: 'history-missing', severity: 'warning', message: 'Historia no disponible', ruleId: 'rule.history.missing' }],
        payload: { available: false },
        promptSections: ['La historia del paciente no está disponible.'],
      };
    }
    const row = history as Record<string, unknown>;
    const consultations = asArray(row.consultations);
    const anthropometry = asArray(row.anthropometry);
    const labs = asArray(row.labs);
    const plans = asArray(row.plans);
    const adherence = asArray(row.adherence);
    if (consultations.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${consultations.length} consultas en la ventana (${row.windowDays} días)`, { type: 'erp', ref: 'get_patient_history' }));
    if (anthropometry.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${anthropometry.length} mediciones antropométricas en la ventana`, { type: 'erp', ref: 'get_patient_history' }));
    if (labs.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${labs.length} paneles de laboratorio en la ventana`, { type: 'erp', ref: 'get_patient_history' }));
    if (plans.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${plans.length} planes alimenticios en la ventana`, { type: 'erp', ref: 'get_patient_history' }));
    if (adherence.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${adherence.length} registros de adherencia en la ventana`, { type: 'erp', ref: 'get_patient_history' }));
    const latest = anthropometry[0] as Record<string, unknown> | undefined;
    return {
      facts,
      flags: [],
      payload: { available: true, windowDays: row.windowDays, consultationsCount: consultations.length, anthropometryCount: anthropometry.length, labsCount: labs.length, plansCount: plans.length, adherenceCount: adherence.length, latestWeightKg: latest ? asNumber(latest.weight_kg) : null, latestMeasuredAt: latest ? String(latest.measured_at ?? '') : null },
      promptSections: [
        facts.length > 0 ? facts.map((f) => `- ${f.text}`).join('\n') : 'La ventana de historia no contiene registros.',
        latest ? `Última medición: peso ${latest.weight_kg} kg el ${String(latest.measured_at ?? '')}.` : '',
      ].filter(Boolean),
    };
  },

  async detectNutritionDataGaps(ctx) {
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const labs = asArray(tool(ctx, 'lab_results'));
    const plan = tool(ctx, 'meal_plan');
    const adherence = asArray(tool(ctx, 'adherence_summary'));
    const allergies = asArray(tool(ctx, 'get_allergies'));
    const gaps = buildDataGaps({ profile: Boolean(profile), anthropometry: Boolean(anthropometry), anthropometryRecent: anthropometryIsRecent(anthropometry, ctx.now), labs: labs.length > 0, plan: Boolean(plan), adherence: adherence.length > 0, allergies: allergies.length > 0, medications: true });
    const facts: CapabilityFact[] = gaps.map((gap) => fact(ctx, 'RULE_RESULT', `Brecha: ${gap.field} (${gap.severity})`, { type: 'rule_engine', ref: 'rule.data_gaps' }));
    if (gaps.length === 0) facts.push(fact(ctx, 'RULE_RESULT', 'No se detectaron brechas de datos requeridos', { type: 'rule_engine', ref: 'rule.data_gaps' }));
    return {
      facts,
      flags: gaps.filter((g) => g.severity !== 'info').map((g) => ({ id: `gap-${g.field}`, severity: g.severity as 'warning', message: `Falta ${g.field}`, ruleId: 'rule.data_gaps' })),
      payload: { gaps },
      promptSections: gaps.length > 0 ? [`Brechas detectadas: ${gaps.map((g) => `${g.field} (${g.severity})`).join(', ')}`] : ['Sin brechas críticas de datos.'],
    };
  },

  async generateNutritionQuestions(ctx) {
    const questions: string[] = [];
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const labs = asArray(tool(ctx, 'lab_results'));
    const plan = tool(ctx, 'meal_plan');
    const adherence = asArray(tool(ctx, 'adherence_summary'));
    if (!profile) questions.push('¿Cuándo fue su última consulta y cómo se encuentra actualmente?');
    if (!anthropometry) questions.push('¿Cuál es su peso y talla actuales? (para calcular IMC y requerimientos)');
    if (labs.length === 0) questions.push('¿Cuenta con laboratorios recientes (glucosa, lípidos, hemoglobina)?');
    if (!plan) questions.push('¿Sigue actualmente un plan de alimentación?');
    if (adherence.length === 0) questions.push('¿Cómo ha sido su adherencia al plan en las últimas semanas?');
    if (questions.length === 0) questions.push('¿Hay algún cambio reciente en su peso, apetito o medicamentos?');
    return {
      facts: [fact(ctx, 'RULE_RESULT', `${questions.length} preguntas generadas a partir de brechas`, { type: 'rule_engine', ref: 'rule.questions.from_gaps' })],
      flags: [],
      payload: { questions, source: 'deterministic_templates' },
      promptSections: [`Preguntas sugeridas:\n${questions.map((q) => `- ${q}`).join('\n')}`],
    };
  },

  async draftNutritionNote(ctx) {
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const labs = asArray(tool(ctx, 'lab_results'));
    const plan = tool(ctx, 'meal_plan');
    const adherence = asArray(tool(ctx, 'adherence_summary'));
    const medications = asArray(tool(ctx, 'get_medications'));
    const allergies = asArray(tool(ctx, 'get_allergies'));

    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [...allergyFlags(ctx, allergies)];
    const calculations = anthropometry && typeof anthropometry === 'object'
      ? runCalculatorsDetailed({ weightKg: asNumber((anthropometry as Record<string, unknown>).weightKg) ?? undefined, heightM: asNumber((anthropometry as Record<string, unknown>).heightM) ?? undefined, activity: 'moderado' })
      : { results: [] as CalculatorResult[], unavailable: [] };
    for (const calc of calculations.results) {
      facts.push(fact(ctx, 'CALCULATED_VALUE', `${calc.name}: ${calc.value} ${calc.unit} (${calc.calculatorVersion})`, { type: 'calculator', ref: calc.id, version: calc.calculatorVersion }));
    }
    const adherenceLines = adherence.slice(0, 5).map((a) => `- ${String(a.record_date ?? '')}: menú ${String(a.adherence_menu ?? '?')}, agua ${String(a.adherence_water ?? '?')}`);
    const draft = {
      subjective: adherenceLines.length > 0 ? `Adherencia reciente:\n${adherenceLines.join('\n')}` : 'Sin registros de adherencia recientes.',
      objective: `${anthropometry ? `Peso ${(anthropometry as Record<string, unknown>).weightKg} kg, talla ${(anthropometry as Record<string, unknown>).heightM} m (${(anthropometry as Record<string, unknown>).measuredAt}). ` : 'Sin antropometría reciente. '}${labs.length > 0 ? `${labs.length} paneles de laboratorio. ` : ''}${medications.length > 0 ? `${medications.length} medicamentos activos. ` : ''}${allergies.length > 0 ? `${allergies.length} alergias registradas.` : ''}`,
      assessment: facts.filter((f) => f.claimType === 'CALCULATED_VALUE').map((f) => f.text).join(' '),
      plan: plan && typeof plan === 'object' ? `Plan activo: ${String((plan as Record<string, unknown>).name ?? '')} (${(plan as Record<string, unknown>).kcal_target ?? '?'} kcal).` : 'Sin plan activo.',
      status: 'DRAFT',
    };
    return {
      facts,
      flags,
      payload: { draft, reviewRequired: true, profilePresent: Boolean(profile) },
      promptSections: [
        `Subjetivo:\n${draft.subjective}`,
        `Objetivo:\n${draft.objective}`,
        `Evaluación (hechos):\n${draft.assessment}`,
        `Plan:\n${draft.plan}`,
      ],
      allowedNumbers: calculations.results.map((c) => c.value),
    };
  },

  async analyzeAnthropometry(ctx) {
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const evolution = tool(ctx, 'get_evolution');
    const facts: CapabilityFact[] = [];
    if (!anthropometry || typeof anthropometry !== 'object') {
      return { facts, flags: [{ id: 'anthropometry-missing', severity: 'warning', message: 'Antropometría no disponible', ruleId: 'rule.anthropometry.missing' }], payload: { available: false }, promptSections: ['Antropometría no disponible: no se pueden calcular requerimientos.'] };
    }
    const row = anthropometry as Record<string, unknown>;
    const calculations = runCalculatorsDetailed({ weightKg: asNumber(row.weightKg) ?? undefined, heightM: asNumber(row.heightM) ?? undefined, activity: 'moderado' });
    for (const calc of calculations.results) {
      facts.push(fact(ctx, 'CALCULATED_VALUE', `${calc.name}: ${calc.value} ${calc.unit} (${calc.calculatorVersion})`, { type: 'calculator', ref: calc.id, version: calc.calculatorVersion }));
    }
    for (const unavailable of calculations.unavailable) {
      facts.push(fact(ctx, 'RULE_RESULT', `Calculadora ${unavailable.id} no disponible: INSUFFICIENT_DATA (${unavailable.missingFields.join(', ')})`, { type: 'rule_engine', ref: 'rule.insufficient_data' }));
    }
    let deltas: Record<string, unknown> | null = null;
    if (evolution && typeof evolution === 'object') {
      const ev = evolution as Record<string, unknown>;
      deltas = (ev.deltas as Record<string, unknown> | null) ?? null;
      if (deltas) facts.push(fact(ctx, 'CALCULATED_VALUE', `Cambio de peso en el periodo: ${String(deltas.weightKgDelta)} kg`, { type: 'calculator', ref: 'calc.weight_delta' }));
    }
    return {
      facts,
      flags: [],
      payload: { available: true, anthropometry: row, calculations: calculations.results, unavailableCalculators: calculations.unavailable, weightDeltas: deltas },
      promptSections: [facts.map((f) => `- ${f.text}`).join('\n')],
      allowedNumbers: calculations.results.map((c) => c.value),
    };
  },

  async analyzeAdherence(ctx) {
    const adherence = asArray(tool(ctx, 'adherence_summary'));
    const facts: CapabilityFact[] = [];
    if (adherence.length === 0) {
      return { facts, flags: [{ id: 'adherence-missing', severity: 'info', message: 'Sin registros de adherencia', ruleId: 'rule.adherence.missing' }], payload: { available: false }, promptSections: ['Sin registros de adherencia en el periodo.'] };
    }
    const avg = (key: string): number | null => {
      const values = adherence.map((a) => asNumber(a[key])).filter((v): v is number => v !== null);
      return values.length > 0 ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
    };
    const half = Math.ceil(adherence.length / 2);
    const firstHalf = adherence.slice(0, half);
    const secondHalf = adherence.slice(half);
    const avgWindow = (rows: Array<Record<string, unknown>>, key: string): number | null => {
      const values = rows.map((a) => asNumber(a[key])).filter((v): v is number => v !== null);
      return values.length > 0 ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
    };
    const menuAvg = avg('adherence_menu');
    const waterAvg = avg('adherence_water');
    const firstMenu = avgWindow(firstHalf, 'adherence_menu');
    const secondMenu = avgWindow(secondHalf, 'adherence_menu');
    if (menuAvg !== null) facts.push(fact(ctx, 'CALCULATED_VALUE', `Adherencia promedio a menú: ${menuAvg} (${adherence.length} registros)`, { type: 'calculator', ref: 'calc.adherence_menu_avg' }));
    if (waterAvg !== null) facts.push(fact(ctx, 'CALCULATED_VALUE', `Adherencia promedio a hidratación: ${waterAvg}`, { type: 'calculator', ref: 'calc.adherence_water_avg' }));
    const trend = firstMenu !== null && secondMenu !== null ? round1(secondMenu - firstMenu) : null;
    if (trend !== null) facts.push(fact(ctx, 'CALCULATED_VALUE', `Tendencia de adherencia a menú (última vs primera mitad): ${trend}`, { type: 'calculator', ref: 'calc.adherence_trend' }));
    return {
      facts,
      flags: [],
      payload: { available: true, records: adherence.length, menuAvg, waterAvg, menuTrend: trend, periodStart: String(adherence[adherence.length - 1]?.record_date ?? ''), periodEnd: String(adherence[0]?.record_date ?? '') },
      promptSections: [facts.map((f) => `- ${f.text}`).join('\n')],
      allowedNumbers: [menuAvg, waterAvg, trend].filter((v): v is number => v !== null),
    };
  },

  async summarizeRelevantLabs(ctx) {
    const labs = asArray(tool(ctx, 'lab_results'));
    const facts: CapabilityFact[] = [];
    if (labs.length === 0) {
      return { facts, flags: [{ id: 'labs-missing', severity: 'warning', message: 'Sin laboratorios recientes', ruleId: 'rule.labs.missing' }], payload: { available: false }, promptSections: ['Sin paneles de laboratorio recientes.'] };
    }
    const summarized = labs.slice(0, 10).map((lab) => ({ id: String(lab.id ?? ''), takenAt: String(lab.taken_at ?? ''), labName: String(lab.lab_name ?? 'sin nombre'), results: lab.results_json ?? null }));
    for (const lab of summarized.slice(0, 5)) {
      facts.push(fact(ctx, 'OBSERVED_FACT', `Laboratorio ${lab.labName} (${lab.takenAt}) con ${JSON.stringify(lab.results)?.length ?? 0} caracteres de resultados`, { type: 'erp', ref: 'lab_results' }));
    }
    return {
      facts,
      flags: [],
      payload: { available: true, labs: summarized },
      promptSections: [summarized.slice(0, 5).map((lab) => `- ${lab.labName} (${lab.takenAt}): ${JSON.stringify(lab.results)}`).join('\n')],
    };
  },

  async analyzeNutritionEvolution(ctx) {
    const evolution = tool(ctx, 'get_evolution');
    const facts: CapabilityFact[] = [];
    if (!evolution || typeof evolution !== 'object') {
      return { facts, flags: [{ id: 'evolution-missing', severity: 'warning', message: 'Sin series de evolución física', ruleId: 'rule.evolution.missing' }], payload: { available: false }, promptSections: ['Sin series de peso/IMC registradas.'] };
    }
    const row = evolution as Record<string, unknown>;
    const series = asArray(row.series);
    const deltas = row.deltas as Record<string, unknown> | null;
    if (series.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${series.length} mediciones en la serie de evolución`, { type: 'erp', ref: 'get_evolution' }));
    if (deltas) facts.push(fact(ctx, 'CALCULATED_VALUE', `Delta de peso ${String(deltas.weightKgDelta)} kg entre ${String(deltas.periodStart)} y ${String(deltas.periodEnd)}`, { type: 'calculator', ref: 'calc.weight_delta' }));
    return {
      facts,
      flags: [],
      payload: { available: series.length > 0, scope: 'physical_progress_only', series, deltas },
      promptSections: [facts.map((f) => `- ${f.text}`).join('\n'), 'La evolución física proviene de antropometrías registradas; no existe fuente para evolución conductual.'],
      allowedNumbers: deltas ? [asNumber(deltas.weightKgDelta)].filter((v): v is number => v !== null) : [],
    };
  },

  async analyzeBodyComposition(ctx) {
    const composition = tool(ctx, 'get_body_composition');
    const facts: CapabilityFact[] = [];
    if (!composition || typeof composition !== 'object') {
      return { facts, flags: [{ id: 'composition-missing', severity: 'warning', message: 'Composición corporal no disponible', ruleId: 'rule.composition.missing' }], payload: { available: false }, promptSections: ['Composición corporal no registrada.'] };
    }
    const row = composition as Record<string, unknown>;
    const bmi = (row.bmi as Record<string, unknown> | null) ?? null;
    const bmiValue = bmi ? asNumber((bmi as Record<string, unknown>).value) : null;
    facts.push(fact(ctx, 'OBSERVED_FACT', `Composición corporal registrada el ${String(row.measuredAt ?? '')}`, { type: 'erp', ref: 'get_body_composition' }));
    if (bmi) facts.push(fact(ctx, 'OBSERVED_FACT', `IMC ${bmiValue} (${String((bmi as Record<string, unknown>).label)}): ${String((bmi as Record<string, unknown>).basis ?? '')}`, { type: 'erp', ref: 'get_body_composition' }));
    const bodyFat = row.bodyFatPct as Record<string, unknown> | null;
    if (bodyFat) facts.push(fact(ctx, 'OBSERVED_FACT', `Grasa corporal ${String((bodyFat as Record<string, unknown>).value)}% (${String((bodyFat as Record<string, unknown>).label)})`, { type: 'erp', ref: 'get_body_composition' }));
    const circumferences = (row.circumferences as Record<string, unknown>) ?? {};
    const circumferenceCount = Object.keys(circumferences).length;
    if (circumferenceCount > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${circumferenceCount} circunferencias registradas`, { type: 'erp', ref: 'get_body_composition' }));
    return {
      facts,
      flags: [],
      payload: { available: true, composition: row },
      promptSections: [facts.map((f) => `- ${f.text}`).join('\n'), 'Los valores se presentan como registrados (MEASURED) o derivados (CALCULATED); el LLM no debe introducir fórmulas nuevas.'],
      allowedNumbers: [bmiValue].filter((v): v is number => v !== null),
    };
  },

  async reviewDrugNutrientInteractions(ctx) {
    const medications = asArray(tool(ctx, 'get_medications'));
    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [];
    if (medications.length === 0) {
      return { facts: [fact(ctx, 'OBSERVED_FACT', 'Sin medicamentos activos: no hay interacciones que evaluar', { type: 'erp', ref: 'get_medications' })], flags, payload: { available: false, alerts: [], rulesEvaluated: 0, coverage: 'no_medications' }, promptSections: ['Sin medicamentos activos registrados.'] };
    }
    const evaluation = evaluateDrugNutrientInteractions(medications.map((m) => ({ id: String(m.id ?? ''), nombre: String(m.nombre ?? ''), principio_activo: String(m.principio_activo ?? '') })));
    const coveredIds = new Set<string>();
    for (const alert of evaluation.alerts) {
      if (alert.medicamentoId) coveredIds.add(alert.medicamentoId);
      facts.push(fact(ctx, 'RULE_RESULT', `Interacción ${alert.principioActivo} + ${alert.nutriente}: ${alert.severidad} (${alert.tipo})`, { type: 'rule_engine', ref: `rule.${alert.ruleId}`, version: evaluation.version }));
      if (alert.severidad === 'severa') {
        flags.push({ id: `interaction-${alert.ruleId}`, severity: 'blocker', message: `Interacción severa: ${alert.principioActivo} + ${alert.nutriente}`, ruleId: alert.ruleId });
      }
    }
    const uncovered = medications.filter((m) => !coveredIds.has(String(m.id ?? ''))).map((m) => String(m.nombre ?? ''));
    return {
      facts,
      flags,
      payload: { available: true, alerts: evaluation.alerts, rulesEvaluated: evaluation.rulesEvaluated, ruleVersion: evaluation.version, uncoveredMedications: uncovered, coverage: 'documented_rules_only' },
      promptSections: [
        facts.length > 0 ? facts.map((f) => `- ${f.text}`).join('\n') : 'Sin interacciones detectadas por las reglas documentadas.',
        uncovered.length > 0 ? `Medicamentos sin regla documentada (NO_COVERED): ${uncovered.join(', ')}` : 'Todos los medicamentos activos cubiertos por reglas documentadas.',
      ],
    };
  },

  async compareAgainstProtocol(ctx) {
    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [];
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const labs = asArray(tool(ctx, 'lab_results'));
    const diagnoses = asArray(tool(ctx, 'get_diagnoses'));
    if (profile) facts.push(fact(ctx, 'OBSERVED_FACT', 'Perfil disponible para construir la consulta al protocolo', { type: 'erp', ref: 'patient_profile' }));
    if (anthropometry) facts.push(fact(ctx, 'OBSERVED_FACT', `Antropometría disponible (${(anthropometry as Record<string, unknown>).measuredAt})`, { type: 'erp', ref: 'anthropometry_tool' }));
    if (labs.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${labs.length} paneles de laboratorio para comparar`, { type: 'erp', ref: 'lab_results' }));
    if (diagnoses.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${diagnoses.length} condiciones para contextualizar`, { type: 'erp', ref: 'get_diagnoses' }));
    const contextLines = [
      anthropometry && typeof anthropometry === 'object' ? `peso ${(anthropometry as Record<string, unknown>).weightKg} kg` : '',
      diagnoses.length > 0 ? `condiciones: ${diagnoses.map((d) => String(d.condicion ?? '')).join(', ')}` : '',
    ].filter(Boolean);
    if (facts.length === 0) {
      return { facts, flags, payload: { contextLines, diagnoses }, promptSections: ['Sin datos suficientes.'], abstain: { kind: 'insufficient_evidence', reason: 'Sin datos del paciente para construir la consulta al protocolo' } };
    }
    const knowledge: RetrievedChunk[] = await ctx.retrieveKnowledge(`protocolo manejo nutricional ${contextLines.join(' ')} ${diagnoses.map((d) => String(d.condicion ?? '')).join(' ')}`.trim()).catch(() => [] as RetrievedChunk[]);
    if (knowledge.length === 0) {
      return { facts, flags, payload: { contextLines, diagnoses, knowledgeCount: 0 }, promptSections: ['Sin fuentes de conocimiento recuperadas.'], abstain: { kind: 'knowledge_unavailable', reason: 'No se recuperaron fuentes de protocolo autorizadas' } };
    }
    for (const chunk of knowledge.slice(0, 10)) {
      facts.push(fact(ctx, 'DOCUMENTED_GUIDANCE', `Fuente [${chunk.docId}] ${chunk.title} (${chunk.tier})`, { type: 'erp', ref: chunk.docId }));
    }
    return {
      facts,
      flags,
      payload: { contextLines, diagnoses, knowledgeCount: knowledge.length },
      promptSections: [
        `Contexto para comparar contra protocolo:\n${contextLines.map((l) => `- ${l}`).join('\n')}`,
        `Fuentes recuperadas (cita con [docId] solo si la usas):\n${knowledge.map((k) => `- [${k.docId}] ${k.title} (${k.tier}): ${k.snippet}`).join('\n')}`,
      ],
      knowledge,
    };
  },

  async generatePatientEducation(ctx) {
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const plan = tool(ctx, 'meal_plan');
    const facts: CapabilityFact[] = [];
    const calculations = anthropometry && typeof anthropometry === 'object'
      ? runCalculatorsDetailed({ weightKg: asNumber((anthropometry as Record<string, unknown>).weightKg) ?? undefined, heightM: asNumber((anthropometry as Record<string, unknown>).heightM) ?? undefined, activity: 'moderado' })
      : { results: [] as CalculatorResult[], unavailable: [] };
    for (const calc of calculations.results) {
      facts.push(fact(ctx, 'CALCULATED_VALUE', `${calc.name}: ${calc.value} ${calc.unit}`, { type: 'calculator', ref: calc.id, version: calc.calculatorVersion }));
    }
    if (plan && typeof plan === 'object') {
      facts.push(fact(ctx, 'OBSERVED_FACT', `Plan activo: ${String((plan as Record<string, unknown>).name ?? '')}`, { type: 'erp', ref: 'meal_plan' }));
    }
    return {
      facts,
      flags: [],
      payload: { profilePresent: Boolean(profile), anthropometryPresent: Boolean(anthropometry), planPresent: Boolean(plan), calculations: calculations.results },
      promptSections: [
        'Genera material EDUCATIVO de nutrición general (no un consejo clínico personalizado).',
        facts.map((f) => `- ${f.text}`).join('\n'),
      ],
      allowedNumbers: calculations.results.map((c) => c.value),
    };
  },

  async explainNutritionRecommendation(ctx) {
    const profile = tool(ctx, 'patient_profile');
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const plan = tool(ctx, 'meal_plan');
    const labs = asArray(tool(ctx, 'lab_results'));
    const facts: CapabilityFact[] = [];
    const calculations = anthropometry && typeof anthropometry === 'object'
      ? runCalculatorsDetailed({ weightKg: asNumber((anthropometry as Record<string, unknown>).weightKg) ?? undefined, heightM: asNumber((anthropometry as Record<string, unknown>).heightM) ?? undefined, activity: 'moderado' })
      : { results: [] as CalculatorResult[], unavailable: [] };
    for (const calc of calculations.results) {
      facts.push(fact(ctx, 'CALCULATED_VALUE', `${calc.name}: ${calc.value} ${calc.unit}`, { type: 'calculator', ref: calc.id, version: calc.calculatorVersion }));
    }
    if (plan && typeof plan === 'object') {
      const row = plan as Record<string, unknown>;
      facts.push(fact(ctx, 'OBSERVED_FACT', `Objetivos del plan: ${row.kcal_target ?? '?'} kcal, ${row.protein_target_g ?? '?'} g proteína, ${row.carbs_target_g ?? '?'} g CHO, ${row.fat_target_g ?? '?'} g grasa`, { type: 'erp', ref: 'meal_plan' }));
    }
    if (labs.length > 0) facts.push(fact(ctx, 'OBSERVED_FACT', `${labs.length} paneles de laboratorio disponibles como respaldo`, { type: 'erp', ref: 'lab_results' }));
    return {
      facts,
      flags: [],
      payload: { profilePresent: Boolean(profile), anthropometryPresent: Boolean(anthropometry), planPresent: Boolean(plan), calculations: calculations.results },
      promptSections: [
        'Explica la recomendación con base EXCLUSIVAMENTE en estos hechos; no introduzcas cifras nuevas.',
        facts.map((f) => `- ${f.text}`).join('\n'),
      ],
      allowedNumbers: calculations.results.map((c) => c.value),
    };
  },

  async reviewMealPlan(ctx) {
    return mealPlanReview(ctx, true);
  },

  async validateMealPlan(ctx) {
    return mealPlanReview(ctx, false);
  },

  async suggestFoodSubstitutions(ctx) {
    const foodId = typeof ctx.request.input?.foodId === 'string' ? ctx.request.input.foodId : '';
    const facts: CapabilityFact[] = [];
    if (!foodId) {
      return { facts, flags: [{ id: 'substitution-no-food', severity: 'warning', message: 'Se requiere foodId del catálogo SMAE', ruleId: 'rule.substitution.food_required' }], payload: { candidates: [], unmatched: true }, promptSections: ['Indica el alimento a sustituir (foodId del catálogo SMAE).'] };
    }
    const { allergens, intolerances } = restrictionFacts(ctx, { allergies: tool(ctx, 'get_allergies'), intolerances: tool(ctx, 'get_intolerances') });
    const result = suggestSubstitutions(foodId, { allergenTexts: allergens, intoleranceTexts: intolerances });
    if (result.unmatched) {
      return { facts, flags: [{ id: 'substitution-unmatched', severity: 'warning', message: `Alimento '${foodId}' no está en el catálogo SMAE`, ruleId: 'rule.substitution.unmatched' }], payload: { candidates: [], unmatched: true, catalogVersion: SMAE_CATALOG_VERSION }, promptSections: [`El alimento '${foodId}' no existe en el catálogo SMAE.`] };
    }
    facts.push(fact(ctx, 'OBSERVED_FACT', `${result.candidates.length} sustituciones válidas dentro del mismo grupo, filtrando alergias/intolerancias`, { type: 'rule_engine', ref: 'rule.smae.substitutions', version: SMAE_CATALOG_VERSION }));
    return {
      facts,
      flags: [],
      payload: { candidates: result.candidates.map((c) => ({ id: c.id, name: c.name, group: c.group, serving: c.serving, servingGrams: c.servingGrams })), unmatched: false, catalogVersion: SMAE_CATALOG_VERSION },
      promptSections: [`Sustituciones válidas para '${foodId}' (mismo grupo SMAE, sin alergenos ni intolerancias):\n${result.candidates.map((c) => `- ${c.name} (${c.serving})`).join('\n')}`],
    };
  },

  async analyzeNutrientIntake(ctx) {
    const items = planItemsFrom(ctx);
    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [];
    if (items.length === 0) {
      return { facts, flags: [{ id: 'intake-no-plan', severity: 'warning', message: 'Sin ítems de plan para analizar', ruleId: 'rule.intake.plan_required' }], payload: { available: false }, promptSections: ['El plan no contiene comidas/ítems analizables.'] };
    }
    const summary = summarizeExchanges(items);
    facts.push(fact(ctx, 'CALCULATED_VALUE', `Totales del plan (SMAE): ${summary.totals.kcal} kcal, ${summary.totals.proteinG} g proteína, ${summary.totals.carbsG} g CHO, ${summary.totals.fatG} g grasa`, { type: 'calculator', ref: 'calc.smae_totals', version: SMAE_CATALOG_VERSION }));
    const uncatalogued = summary.entries.filter((e) => e.foodId === null).length;
    facts.push(fact(ctx, 'RULE_RESULT', `${summary.entries.length} equivalentes sumarizados; ${uncatalogued} ítem(s) sin correspondencia en el catálogo`, { type: 'rule_engine', ref: 'rule.smae.coverage', version: SMAE_CATALOG_VERSION }));
    return {
      facts,
      flags,
      payload: { available: true, summary, catalogVersion: SMAE_CATALOG_VERSION },
      promptSections: [facts.map((f) => `- ${f.text}`).join('\n')],
      allowedNumbers: [summary.totals.kcal, summary.totals.proteinG, summary.totals.carbsG, summary.totals.fatG],
    };
  },

  async draftMealPlan(ctx) {
    const items = planItemsFrom(ctx);
    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [];
    if (items.length === 0) {
      return { facts, flags: [{ id: 'draft-plan-no-items', severity: 'warning', message: 'Se requieren planItems en el input para redactar el borrador', ruleId: 'rule.draft.plan_required' }], payload: { available: false }, promptSections: ['Proporciona los ítems del plan (grupo + porciones) para redactar el borrador.'] };
    }
    const restrictions = restrictionFacts(ctx, { allergies: tool(ctx, 'get_allergies'), intolerances: tool(ctx, 'get_intolerances') });
    const blockedItems = items.filter((item) => matchesRestriction(String(item.foodName ?? item.group ?? ''), [...restrictions.allergens, ...restrictions.intolerances]));
    for (const item of blockedItems) {
      flags.push({ id: `blocked-${String(item.foodId ?? item.foodName ?? '')}`, severity: 'blocker', message: `Ítem bloqueado por alergia/intolerancia: ${String(item.foodName ?? item.group)}`, ruleId: 'rule.allergy.block' });
    }
    const validItems = items.filter((item) => !blockedItems.includes(item));
    const summary = summarizeExchanges(validItems);
    facts.push(fact(ctx, 'CALCULATED_VALUE', `Borrador de plan: ${summary.totals.kcal} kcal totales (${validItems.length} ítems válidos, ${blockedItems.length} bloqueados)`, { type: 'calculator', ref: 'calc.smae_totals', version: SMAE_CATALOG_VERSION }));
    return {
      facts,
      flags,
      payload: { available: true, blockedItems: blockedItems.map((b) => ({ foodName: b.foodName, group: b.group })), validItems: validItems.map((v) => ({ foodName: v.foodName, group: v.group, portions: v.portions })), summary, catalogVersion: SMAE_CATALOG_VERSION, status: 'DRAFT' },
      promptSections: [
        'Redacta un BORRADOR de plan de alimentación. Respeta estrictamente:',
        `- Bloques por alergia/intolerancia: ${blockedItems.length > 0 ? blockedItems.map((b) => String(b.foodName ?? '')).join(', ') : 'ninguno'}`,
        `- Equivalentes SMAE válidos (${SMAE_CATALOG_VERSION})`,
        facts.map((f) => `- ${f.text}`).join('\n'),
      ],
      allowedNumbers: [summary.totals.kcal, summary.totals.proteinG, summary.totals.carbsG, summary.totals.fatG],
    };
  },

  async detectPotentialNutritionRisks(ctx) {
    const allergies = asArray(tool(ctx, 'get_allergies'));
    const anthropometry = tool(ctx, 'anthropometry_tool');
    const medications = asArray(tool(ctx, 'get_medications'));
    const labs = asArray(tool(ctx, 'lab_results'));
    const diet = tool(ctx, 'get_diet');
    const facts: CapabilityFact[] = [];
    const flags: CapabilityFlag[] = [];

    for (const allergy of allergies.filter((a) => ['severa', 'anafilaxia'].includes(String(a.severidad ?? '')))) {
      flags.push({ id: `risk-allergy-${String(allergy.id ?? '')}`, severity: 'blocker', message: `Alergia ${String(allergy.severidad)}: ${String(allergy.sustancia ?? '')}`, ruleId: 'rule.allergy.severe' });
    }
    const bmiResult = anthropometry && typeof anthropometry === 'object'
      ? runCalculatorsDetailed({ weightKg: asNumber((anthropometry as Record<string, unknown>).weightKg) ?? undefined, heightM: asNumber((anthropometry as Record<string, unknown>).heightM) ?? undefined, activity: 'moderado' })
      : { results: [] as CalculatorResult[], unavailable: [] };
    const bmi = bmiResult.results.find((r) => r.id === 'calc_bmi') as BmiResult | undefined;
    if (bmi) {
      if (bmi.category === 'obesidad') flags.push({ id: 'risk-bmi-high', severity: 'warning', message: `IMC ${bmi.value} (obesidad)`, ruleId: 'rule.bmi.obesity' });
      if (bmi.category === 'bajo_peso') flags.push({ id: 'risk-bmi-low', severity: 'warning', message: `IMC ${bmi.value} (bajo peso)`, ruleId: 'rule.bmi.underweight' });
    }
    const interactions = evaluateDrugNutrientInteractions(medications.map((m) => ({ id: String(m.id ?? ''), nombre: String(m.nombre ?? ''), principio_activo: String(m.principio_activo ?? '') })));
    for (const alert of interactions.alerts.filter((a) => a.severidad === 'severa')) {
      flags.push({ id: `risk-interaction-${alert.ruleId}`, severity: 'blocker', message: `Interacción severa: ${alert.principioActivo} + ${alert.nutriente}`, ruleId: alert.ruleId });
    }
    if (labs.length === 0) flags.push({ id: 'risk-no-labs', severity: 'info', message: 'Sin laboratorios recientes para descartar alteraciones', ruleId: 'rule.labs.missing' });

    const items = planItemsFrom(ctx);
    if (items.length > 0) {
      const restrictions = restrictionFacts(ctx, { allergies: tool(ctx, 'get_allergies'), intolerances: tool(ctx, 'get_intolerances') });
      const blocked = items.filter((item) => matchesRestriction(String(item.foodName ?? item.group ?? ''), [...restrictions.allergens, ...restrictions.intolerances]));
      if (blocked.length > 0) {
        flags.push({ id: 'risk-plan-blocked', severity: 'blocker', message: `El plan contiene ${blocked.length} ítem(s) con alergenos/intolerancias`, ruleId: 'rule.allergy.block' });
      }
    }

    const severaCount = flags.filter((f) => f.severity === 'blocker').length;
    facts.push(fact(ctx, 'RULE_RESULT', `${flags.length} señales de riesgo detectadas (${severaCount} bloqueantes)`, { type: 'rule_engine', ref: 'rule.risk_signals' }));
    return {
      facts,
      flags,
      payload: { signals: flags, blockers: severaCount, allergiesCount: allergies.length, medicationsCount: medications.length, labsPresent: labs.length > 0, planPresent: Boolean(diet) },
      promptSections: [facts.map((f) => `- ${f.text}`).join('\n'), flags.map((f) => `- [${f.severity}] ${f.message}`).join('\n')],
      allowedNumbers: bmi ? [bmi.value] : [],
    };
  },
};

async function mealPlanReview(ctx: HandlerContext, withNarrative: boolean): Promise<DeterministicResult> {
  const items = planItemsFrom(ctx);
  const facts: CapabilityFact[] = [];
  const flags: CapabilityFlag[] = [];
  if (items.length === 0) {
    return { facts, flags: [{ id: 'plan-no-items', severity: 'warning', message: 'El plan no contiene ítems analizables', ruleId: 'rule.plan.items_required' }], payload: { available: false, validation: null }, promptSections: ['El plan no contiene ítems (comidas/porciones) para validar.'] };
  }
  const targets = planTargetsFrom(ctx);
  const validation: MealPlanValidation = validateMealPlan(items, targets, 10);
  facts.push(fact(ctx, 'RULE_RESULT', `Validación SMAE (${validation.catalogVersion}): ${validation.issues.length} hallazgos`, { type: 'rule_engine', ref: 'rule.smae.validate', version: validation.catalogVersion }));
  if (validation.summary) {
    facts.push(fact(ctx, 'CALCULATED_VALUE', `Totales del plan: ${validation.summary.totals.kcal} kcal, ${validation.summary.totals.proteinG} g proteína, ${validation.summary.totals.carbsG} g CHO, ${validation.summary.totals.fatG} g grasa`, { type: 'calculator', ref: 'calc.smae_totals', version: validation.catalogVersion }));
  }
  if (validation.deviations) {
    facts.push(fact(ctx, 'RULE_RESULT', `Desviaciones vs objetivos: kcal ${validation.deviations.kcalPct}%, proteína ${validation.deviations.proteinPct}%, CHO ${validation.deviations.carbsPct}%, grasa ${validation.deviations.fatPct}%`, { type: 'rule_engine', ref: 'rule.plan.target_deviation' }));
  }
  const { allergens, intolerances } = restrictionFacts(ctx, { allergies: tool(ctx, 'get_allergies'), intolerances: tool(ctx, 'get_intolerances') });
  const restrictions = [...allergens, ...intolerances];
  const blocked = restrictions.length > 0 ? items.filter((item) => restrictionMatchesItem(item, restrictions)) : [];
  if (blocked.length > 0) {
    flags.push({ id: 'plan-allergen-blocked', severity: 'blocker', message: `${blocked.length} ítem(s) bloqueados por alergia/intolerancia`, ruleId: 'rule.allergy.block' });
    facts.push(fact(ctx, 'RULE_RESULT', `${blocked.length} ítem(s) del plan contienen alergenos/intolerancias registrados`, { type: 'rule_engine', ref: 'rule.allergy.block' }));
  }
  for (const issue of validation.issues.filter((i) => i.severity === 'error')) {
    flags.push({ id: `plan-${issue.code}`, severity: 'blocker', message: issue.message, ruleId: `rule.${issue.code.toLowerCase()}` });
  }
  for (const issue of validation.issues.filter((i) => i.severity === 'warning')) {
    flags.push({ id: `plan-${issue.code}`, severity: 'warning', message: issue.message, ruleId: `rule.${issue.code.toLowerCase()}` });
  }
  return {
    facts,
    flags,
    payload: {
      available: true,
      validation,
      allergenBlockedItems: blocked.map((b) => String(b.foodName ?? b.group ?? '')),
      withNarrative,
      catalogVersion: validation.catalogVersion,
    },
    promptSections: [
      `Hallazgos de validación:\n${validation.issues.map((i) => `- [${i.severity}] ${i.message}`).join('\n')}`,
      validation.summary ? `Totales: ${validation.summary.totals.kcal} kcal, ${validation.summary.totals.proteinG} g P, ${validation.summary.totals.carbsG} g CHO, ${validation.summary.totals.fatG} g G.` : '',
      blocked.length > 0 ? `Ítems bloqueados por alergia/intolerancia: ${blocked.map((b) => String(b.foodName ?? '')).join(', ')}` : '',
    ].filter(Boolean),
    allowedNumbers: validation.summary ? [validation.summary.totals.kcal, validation.summary.totals.proteinG, validation.summary.totals.carbsG, validation.summary.totals.fatG] : [],
  };
}

const ANTHROPOMETRY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function anthropometryIsRecent(anthropometry: unknown, now: Date): boolean {
  if (!anthropometry || typeof anthropometry !== 'object') return false;
  const measuredAt = (anthropometry as Record<string, unknown>).measuredAt;
  if (typeof measuredAt !== 'string') return false;
  return computeFreshness({ measuredAt, now, maxAgeMs: ANTHROPOMETRY_MAX_AGE_MS }).isFresh;
}

function buildDataGaps(input: { profile: boolean; anthropometry: boolean; anthropometryRecent: boolean; labs: boolean; plan: boolean; adherence: boolean; allergies: boolean; medications: boolean }): Array<{ field: string; severity: 'info' | 'warning' }> {
  const gaps: Array<{ field: string; severity: 'info' | 'warning' }> = [];
  if (!input.profile) gaps.push({ field: 'perfil del paciente', severity: 'warning' });
  if (!input.anthropometry) gaps.push({ field: 'antropometría reciente', severity: 'warning' });
  else if (!input.anthropometryRecent) gaps.push({ field: 'antropometría desactualizada (>180 días)', severity: 'warning' });
  if (!input.labs) gaps.push({ field: 'laboratorios recientes', severity: 'info' });
  if (!input.plan) gaps.push({ field: 'plan alimenticio activo', severity: 'info' });
  if (!input.adherence) gaps.push({ field: 'registros de adherencia', severity: 'info' });
  if (!input.allergies) gaps.push({ field: 'registro de alergias', severity: 'warning' });
  if (!input.medications) gaps.push({ field: 'registro de medicamentos', severity: 'info' });
  return gaps;
}