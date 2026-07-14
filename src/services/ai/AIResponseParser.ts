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

const dashboardKpiFieldRules = {
  "patients.active": { source: "patients", metrics: ["count", "percentage"] },
  "patients.newThisMonth": { source: "patients", metrics: ["count", "percentage"] },
  "patients.total": { source: "patients", metrics: ["count"] },
  "consultations.today": { source: "consultations", metrics: ["count", "percentage"] },
  "consultations.thisMonth": { source: "consultations", metrics: ["count", "average"] },
  "payments.incomeThisMonth": { source: "payments", metrics: ["sum", "average", "percentage"] },
  "payments.pendingAmount": { source: "payments", metrics: ["sum"] },
  "payments.pendingCount": { source: "payments", metrics: ["count"] },
  "plans.active": { source: "plans", metrics: ["count"] },
  "plans.expiring": { source: "plans", metrics: ["count", "percentage"] },
  "agenda.today": { source: "agenda", metrics: ["count"] },
  "agenda.unconfirmed": { source: "agenda", metrics: ["count", "percentage"] },
  "system.pendingSync": { source: "system", metrics: ["count"] },
} as const;

function normalizeAiEnum(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value !== "string") return value;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-MX");
  return aliases[normalized] ?? value.trim();
}

const dashboardKpiSourceSchema = z.preprocess((value) => normalizeAiEnum(value, {
  pacientes: "patients",
  consultas: "consultations",
  pagos: "payments",
  planes: "plans",
  sistema: "system",
}), z.enum(["patients", "consultations", "payments", "plans", "agenda", "system"]));

const dashboardKpiMetricSchema = z.preprocess((value) => normalizeAiEnum(value, {
  contar: "count",
  conteo: "count",
  suma: "sum",
  sumar: "sum",
  promedio: "average",
  porcentaje: "percentage",
}), z.enum(["count", "sum", "average", "percentage"]));

const dashboardKpiComparisonSchema = z.preprocess((value) => normalizeAiEnum(value, {
  ninguno: "none",
  "sin comparacion": "none",
  "periodo anterior": "previousPeriod",
}), z.enum(["none", "previousPeriod"]));

const dashboardKpiVisualizationSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
    if (normalized.includes("barra") || normalized.trim() === "bar") return "progress";
  }
  return normalizeAiEnum(value, {
    "numero destacado": "largeNumber",
    numero: "largeNumber",
    porcentaje: "percentage",
    progreso: "progress",
    "tarjeta simple": "simpleCard",
  });
}, z.enum(["largeNumber", "percentage", "progress", "simpleCard"]));

const dashboardKpiToneSchema = z.preprocess((value) => normalizeAiEnum(value, {
  verde: "green",
  azul: "blue",
  morado: "purple",
  purpura: "purple",
  naranja: "orange",
  turquesa: "cyan",
  rosa: "rose",
  gris: "slate",
}), z.enum(["green", "blue", "purple", "orange", "cyan", "rose", "slate"]));

const dashboardKpiIconSchema = z.preprocess((value) => normalizeAiEnum(value, {
  usuarios: "users",
  pacientes: "users",
  calendario: "calendar",
  consulta: "clipboard",
  portapapeles: "clipboard",
  dinero: "money",
  finanzas: "money",
  plan: "mealPlan",
  sincronizacion: "sync",
  destacado: "sparkles",
}), z.enum(["users", "calendar", "clipboard", "money", "mealPlan", "sync", "sparkles"]));

const dashboardKpiCategorySchema = z.preprocess((value) => normalizeAiEnum(value, {
  general: "general",
  pacientes: "patients",
  consultas: "consultations",
  pagos: "payments",
  planes: "plans",
  finanzas: "finance",
  sistema: "system",
  personalizado: "custom",
}), z.enum(["general", "patients", "consultations", "payments", "agenda", "plans", "finance", "system", "custom"]));

const dashboardKpiSizeSchema = z.preprocess((value) => normalizeAiEnum(value, {
  pequeno: "small",
  compact: "small",
  compacto: "small",
  ancho: "wide",
}), z.enum(["small", "wide"]));

const dashboardKpiNotationSchema = z.preprocess((value) => normalizeAiEnum(value, {
  completa: "standard",
  normal: "standard",
  compacta: "compact",
}), z.enum(["standard", "compact"]));

const dashboardKpiTrendSchema = z.preprocess((value) => normalizeAiEnum(value, {
  positivo: "increaseIsPositive",
  "subir es positivo": "increaseIsPositive",
  "bajar es positivo": "decreaseIsPositive",
  neutro: "neutral",
}), z.enum(["increaseIsPositive", "decreaseIsPositive", "neutral"]));

const dashboardKpiPrecisionSchema = z.preprocess((value) => {
  if (value === 0.1 || value === "0.1" || value === "1") return 1;
  if (value === 0.01 || value === "0.01" || value === "2") return 2;
  if (value === "0") return 0;
  return value;
}, z.union([z.literal(0), z.literal(1), z.literal(2)]));

const DashboardKpiSuggestionSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(180),
  source: dashboardKpiSourceSchema,
  valueField: z.enum([
    "patients.active",
    "patients.newThisMonth",
    "patients.total",
    "consultations.today",
    "consultations.thisMonth",
    "payments.incomeThisMonth",
    "payments.pendingAmount",
    "payments.pendingCount",
    "plans.active",
    "plans.expiring",
    "agenda.today",
    "agenda.unconfirmed",
    "system.pendingSync",
  ]),
  metric: dashboardKpiMetricSchema,
  comparison: dashboardKpiComparisonSchema,
  visualization: dashboardKpiVisualizationSchema,
  tone: dashboardKpiToneSchema,
  iconKey: dashboardKpiIconSchema,
  category: dashboardKpiCategorySchema,
  size: dashboardKpiSizeSchema,
  precision: dashboardKpiPrecisionSchema.default(1),
  notation: dashboardKpiNotationSchema.default("standard"),
  prefix: z.string().max(12).default(""),
  suffix: z.string().max(12).default(""),
  trendDirection: dashboardKpiTrendSchema.default("neutral"),
  reasoning: z.string().min(1).max(400).default("Propuesta generada con los indicadores permitidos; revisa los campos antes de confirmarla."),
}).strict().superRefine((proposal, context) => {
  const rule = dashboardKpiFieldRules[proposal.valueField];
  if (proposal.source !== rule.source) {
    context.addIssue({ code: "custom", path: ["source"], message: "La fuente no corresponde al indicador." });
  }
  if (!(rule.metrics as readonly string[]).includes(proposal.metric)) {
    context.addIssue({ code: "custom", path: ["metric"], message: "El cálculo no está permitido para el indicador." });
  }
  if ((proposal.visualization === "percentage" || proposal.visualization === "progress") && proposal.metric !== "percentage") {
    context.addIssue({ code: "custom", path: ["visualization"], message: "La visualización requiere metric percentage." });
  }
  const comparable = proposal.valueField === "patients.newThisMonth" || proposal.valueField === "payments.incomeThisMonth";
  if (proposal.comparison === "previousPeriod" && !comparable) {
    context.addIssue({ code: "custom", path: ["comparison"], message: "El indicador no admite comparación temporal." });
  }
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
  generateDashboardKpi: DashboardKpiSuggestionSchema,
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
