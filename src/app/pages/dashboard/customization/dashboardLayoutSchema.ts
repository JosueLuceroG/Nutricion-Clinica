import { z } from "zod";
import { customKpiSupportsComparison, getCustomKpiField } from "./dashboardMetricEngine";
import { getDashboardWidgetDefinition } from "./dashboardWidgetRegistry";
import { DASHBOARD_SCHEMA_VERSION, type DashboardPreferences } from "./dashboardWidgetTypes";

const toneSchema = z.enum(["green", "blue", "purple", "orange", "cyan", "rose", "slate"]);

const customKpiSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(180),
  iconKey: z.string().min(1),
  tone: toneSchema,
  category: z.enum(["general", "patients", "consultations", "payments", "agenda", "plans", "alerts", "activity", "finance", "quickActions", "system", "custom"]),
  source: z.enum(["patients", "consultations", "payments", "plans", "agenda", "system"]),
  metric: z.enum(["count", "sum", "average", "percentage"]),
  valueField: z.string().min(1),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(["equals", "notEquals", "greaterThan", "lessThan"]),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })).max(0),
  comparison: z.enum(["none", "previousPeriod"]),
  visualization: z.enum(["largeNumber", "percentage", "progress", "simpleCard"]),
  format: z.enum(["number", "currency", "percentage"]),
  precision: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  notation: z.enum(["standard", "compact"]).optional(),
  prefix: z.string().max(12).optional(),
  suffix: z.string().max(12).optional(),
  trendDirection: z.enum(["increaseIsPositive", "decreaseIsPositive", "neutral"]).optional(),
  size: z.enum(["small", "wide"]),
  createdAt: z.string(),
  updatedAt: z.string(),
}).superRefine((config, context) => {
  const field = getCustomKpiField(config.source, config.valueField);
  if (!field) {
    context.addIssue({ code: "custom", path: ["valueField"], message: "El indicador no pertenece a la fuente seleccionada." });
    return;
  }
  if (!field.allowedMetrics.includes(config.metric)) {
    context.addIssue({ code: "custom", path: ["metric"], message: "El cálculo no es válido para este indicador." });
  }
  const expectedFormat = config.metric === "percentage" ? "percentage" : field.format;
  if (config.format !== expectedFormat) {
    context.addIssue({ code: "custom", path: ["format"], message: "El formato no corresponde al cálculo seleccionado." });
  }
  if ((config.visualization === "percentage" || config.visualization === "progress") && config.metric !== "percentage") {
    context.addIssue({ code: "custom", path: ["visualization"], message: "Esta visualización requiere un cálculo porcentual." });
  }
  if (config.comparison === "previousPeriod" && !customKpiSupportsComparison(field, config.metric)) {
    context.addIssue({ code: "custom", path: ["comparison"], message: "Este indicador no tiene un periodo anterior comparable." });
  }
});

const widgetSchema = z.object({
  instanceId: z.string().min(1),
  definitionId: z.enum(["activePatients", "newPatientsThisMonth", "consultationsToday", "consultationsThisMonth", "incomeThisMonth", "pendingPayments", "activePlans", "pendingSync", "upcomingConsultations", "weeklyActivity", "alerts", "financialSummary", "recentPayments", "quickActions", "customKpi"]),
  definitionVersion: z.number().int().positive(),
  hidden: z.boolean(),
  config: z.object({
    title: z.string().max(80).optional(),
    description: z.string().max(180).optional(),
    tone: toneSchema.optional(),
    period: z.enum(["today", "week", "month", "quarter", "year"]).optional(),
    limit: z.number().int().min(1).max(20).optional(),
    customKpiId: z.string().min(1).optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const positionSchema = z.object({
  i: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(30),
  minW: z.number().int().min(1).max(12).optional(),
  minH: z.number().int().min(1).max(30).optional(),
  maxW: z.number().int().min(1).max(12).optional(),
  maxH: z.number().int().min(1).max(30).optional(),
});

export const dashboardPreferencesSchema = z.object({
  schemaVersion: z.literal(DASHBOARD_SCHEMA_VERSION),
  userId: z.string().min(1),
  sucursalId: z.string().nullable(),
  activePresetId: z.enum(["default", "clinical", "financial", "operational", "empty"]).nullable(),
  widgets: z.array(widgetSchema).max(40),
  customKpis: z.array(customKpiSchema).max(25),
  layout: z.array(positionSchema).max(40),
  smallScreenOrder: z.array(z.string().min(1)).max(40),
  grid: z.object({
    rowsMode: z.enum(["auto", "manual"]),
    minRows: z.number().int().min(1).max(30),
    maxRows: z.number().int().min(1).max(30),
    compaction: z.literal("vertical"),
  }),
  updatedAt: z.string(),
  revision: z.string().min(1),
}).superRefine((preferences, context) => {
  if (preferences.grid.minRows > preferences.grid.maxRows) {
    context.addIssue({ code: "custom", path: ["grid", "minRows"], message: "El mínimo de filas supera el máximo." });
  }

  const widgetIds = preferences.widgets.map((widget) => widget.instanceId);
  const customIds = preferences.customKpis.map((config) => config.id);
  const layoutIds = preferences.layout.map((position) => position.i);
  const orderIds = preferences.smallScreenOrder;

  const ensureUnique = (values: string[], path: Array<string | number>, label: string) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", path, message: `${label} contiene identificadores duplicados.` });
    }
  };
  ensureUnique(widgetIds, ["widgets"], "La lista de widgets");
  ensureUnique(customIds, ["customKpis"], "La lista de KPIs personalizados");
  ensureUnique(layoutIds, ["layout"], "La cuadrícula");
  ensureUnique(orderIds, ["smallScreenOrder"], "El orden móvil");

  const widgetIdSet = new Set(widgetIds);
  const customIdSet = new Set(customIds);
  const layoutIdSet = new Set(layoutIds);
  const orderIdSet = new Set(orderIds);
  const singletonDefinitions = new Set<string>();

  preferences.widgets.forEach((widget, index) => {
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    if (widget.definitionVersion !== definition.version) {
      context.addIssue({ code: "custom", path: ["widgets", index, "definitionVersion"], message: "La versión del widget no es compatible." });
    }
    if (definition.singleton && singletonDefinitions.has(widget.definitionId)) {
      context.addIssue({ code: "custom", path: ["widgets", index, "definitionId"], message: "Un widget único está repetido." });
    }
    if (definition.singleton) singletonDefinitions.add(widget.definitionId);
    if (widget.definitionId === "customKpi" && (!widget.config.customKpiId || !customIdSet.has(widget.config.customKpiId))) {
      context.addIssue({ code: "custom", path: ["widgets", index, "config", "customKpiId"], message: "El KPI personalizado asociado no existe." });
    }
    if (!widget.hidden && !layoutIdSet.has(widget.instanceId)) {
      context.addIssue({ code: "custom", path: ["widgets", index], message: "El widget visible no tiene una posición." });
    }
    if (widget.hidden && layoutIdSet.has(widget.instanceId)) {
      context.addIssue({ code: "custom", path: ["widgets", index], message: "Un widget oculto no debe ocupar espacio en la cuadrícula." });
    }
  });

  if (orderIdSet.size !== widgetIdSet.size || [...widgetIdSet].some((id) => !orderIdSet.has(id))) {
    context.addIssue({ code: "custom", path: ["smallScreenOrder"], message: "El orden móvil debe contener todos los widgets una sola vez." });
  }

  preferences.layout.forEach((position, index) => {
    if (!widgetIdSet.has(position.i)) {
      context.addIssue({ code: "custom", path: ["layout", index, "i"], message: "La posición no corresponde a un widget." });
    }
    if (position.x + position.w > 12 || position.y + position.h > preferences.grid.maxRows) {
      context.addIssue({ code: "custom", path: ["layout", index], message: "La posición excede los límites de la cuadrícula." });
    }
    if ((position.minW && position.w < position.minW) || (position.maxW && position.w > position.maxW)) {
      context.addIssue({ code: "custom", path: ["layout", index, "w"], message: "El ancho no respeta sus límites." });
    }
    if ((position.minH && position.h < position.minH) || (position.maxH && position.h > position.maxH)) {
      context.addIssue({ code: "custom", path: ["layout", index, "h"], message: "El alto no respeta sus límites." });
    }
    if (position.minW && position.maxW && position.minW > position.maxW) {
      context.addIssue({ code: "custom", path: ["layout", index], message: "Los límites de ancho son incompatibles." });
    }
    if (position.minH && position.maxH && position.minH > position.maxH) {
      context.addIssue({ code: "custom", path: ["layout", index], message: "Los límites de alto son incompatibles." });
    }
  });

  for (let index = 0; index < preferences.layout.length; index += 1) {
    const first = preferences.layout[index]!;
    for (let otherIndex = index + 1; otherIndex < preferences.layout.length; otherIndex += 1) {
      const second = preferences.layout[otherIndex]!;
      const overlaps = first.x < second.x + second.w && first.x + first.w > second.x && first.y < second.y + second.h && first.y + first.h > second.y;
      if (overlaps) {
        context.addIssue({ code: "custom", path: ["layout", otherIndex], message: "Dos widgets se superponen." });
      }
    }
  }
});

export function parseDashboardPreferences(value: unknown): DashboardPreferences | null {
  const result = dashboardPreferencesSchema.safeParse(value);
  return result.success ? result.data : null;
}
