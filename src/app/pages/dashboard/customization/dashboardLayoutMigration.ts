import { z } from "zod";
import { customKpiSupportsComparison, getCustomKpiField } from "./dashboardMetricEngine";
import { getDashboardWidgetDefinition } from "./dashboardWidgetRegistry";
import { parseDashboardPreferences } from "./dashboardLayoutSchema";
import {
  DASHBOARD_SCHEMA_VERSION,
  type DashboardPreferences,
  type DashboardWidgetPosition,
} from "./dashboardWidgetTypes";

const toneSchema = z.enum(["green", "blue", "purple", "orange", "cyan", "rose", "slate"]);

const legacyCustomKpiSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(180),
  iconKey: z.string().min(1),
  tone: toneSchema,
  category: z.enum(["general", "patients", "consultations", "payments", "agenda", "plans", "alerts", "activity", "finance", "quickActions", "system", "custom"]),
  source: z.enum(["patients", "consultations", "payments", "plans", "agenda", "system"]),
  metric: z.enum(["count", "sum", "average", "percentage"]),
  valueField: z.string().optional(),
  filters: z.array(z.unknown()).default([]),
  comparison: z.enum(["none", "previousPeriod"]),
  visualization: z.enum(["largeNumber", "percentage", "progress", "simpleCard"]),
  format: z.enum(["number", "currency", "percentage"]),
  precision: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  notation: z.enum(["standard", "compact"]).optional(),
  prefix: z.string().max(12).optional(),
  suffix: z.string().max(12).optional(),
  trendDirection: z.enum(["increaseIsPositive", "decreaseIsPositive", "neutral"]).optional(),
  size: z.enum(["small", "wide", "medium", "large", "fullWidth", "doubleHeight", "custom"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const legacyWidgetSchema = z.object({
  instanceId: z.string().min(1),
  definitionId: z.enum(["activePatients", "newPatientsThisMonth", "consultationsToday", "consultationsThisMonth", "incomeThisMonth", "pendingPayments", "activePlans", "pendingSync", "upcomingConsultations", "weeklyActivity", "alerts", "financialSummary", "recentPayments", "quickActions", "customKpi"]),
  definitionVersion: z.number().int().positive(),
  hidden: z.boolean(),
  config: z.object({
    title: z.string().max(80).optional(),
    description: z.string().max(180).optional(),
    tone: toneSchema.optional(),
    period: z.enum(["today", "week", "month", "quarter", "year"]).optional(),
    limit: z.number().int().positive().optional(),
    customKpiId: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const legacyPositionSchema = z.object({
  i: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  minW: z.number().int().positive().optional(),
  minH: z.number().int().positive().optional(),
  maxW: z.number().int().positive().optional(),
  maxH: z.number().int().positive().optional(),
});

const legacyPreferencesSchema = z.object({
  schemaVersion: z.number().int().positive(),
  userId: z.string().min(1),
  sucursalId: z.string().nullable(),
  activePresetId: z.enum(["default", "clinical", "financial", "operational", "empty"]).nullable(),
  widgets: z.array(legacyWidgetSchema),
  customKpis: z.array(legacyCustomKpiSchema),
  layout: z.array(legacyPositionSchema),
  smallScreenOrder: z.array(z.string()),
  grid: z.object({
    rowsMode: z.enum(["auto", "manual"]),
    minRows: z.number().int().positive(),
    maxRows: z.number().int().positive(),
    compaction: z.literal("vertical"),
  }),
  updatedAt: z.string(),
  revision: z.string().min(1),
});

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function overlaps(first: DashboardWidgetPosition, second: DashboardWidgetPosition): boolean {
  return first.x < second.x + second.w &&
    first.x + first.w > second.x &&
    first.y < second.y + second.h &&
    first.y + first.h > second.y;
}

function placePosition(
  desired: DashboardWidgetPosition,
  placed: DashboardWidgetPosition[],
  maxRows: number,
): DashboardWidgetPosition | null {
  const candidate = {
    ...desired,
    x: clamp(desired.x, 0, 12 - desired.w),
    y: clamp(desired.y, 0, maxRows - desired.h),
  };
  if (!placed.some((position) => overlaps(candidate, position))) return candidate;

  for (let y = 0; y <= maxRows - desired.h; y += 1) {
    for (let x = 0; x <= 12 - desired.w; x += 1) {
      const next = { ...desired, x, y };
      if (!placed.some((position) => overlaps(next, position))) return next;
    }
  }
  return null;
}

export function migrateDashboardPreferences(value: unknown): DashboardPreferences | null {
  const result = legacyPreferencesSchema.safeParse(value);
  if (!result.success || result.data.schemaVersion !== DASHBOARD_SCHEMA_VERSION) return null;
  const legacy = result.data;
  const outdatedWidgetIds = new Set(
    legacy.widgets
      .filter((widget) => widget.definitionVersion !== getDashboardWidgetDefinition(widget.definitionId).version)
      .map((widget) => widget.instanceId),
  );

  const customKpis = legacy.customKpis.flatMap((config) => {
    const field = getCustomKpiField(config.source, config.valueField);
    if (!field) return [];
    const metric = field.allowedMetrics.includes(config.metric) ? config.metric : field.defaultMetric;
    const percentageVisualization = config.visualization === "percentage" || config.visualization === "progress";
    return [{
      ...config,
      metric,
      valueField: field.value,
      filters: [],
      comparison: config.comparison === "previousPeriod" && customKpiSupportsComparison(field, metric)
        ? "previousPeriod" as const
        : "none" as const,
      visualization: percentageVisualization && metric !== "percentage"
        ? "largeNumber" as const
        : config.visualization,
      format: metric === "percentage" ? "percentage" as const : field.format,
      size: config.size === "wide" ? "wide" as const : "small" as const,
    }];
  }).filter((config, index, items) => items.findIndex((item) => item.id === config.id) === index).slice(0, 25);
  const customIds = new Set(customKpis.map((config) => config.id));
  const instanceIds = new Set<string>();
  const singletonDefinitions = new Set<string>();
  const widgets = legacy.widgets.flatMap((widget) => {
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    if (instanceIds.has(widget.instanceId)) return [];
    if (definition.singleton && singletonDefinitions.has(widget.definitionId)) return [];
    if (widget.definitionId === "customKpi" && (!widget.config.customKpiId || !customIds.has(widget.config.customKpiId))) return [];
    instanceIds.add(widget.instanceId);
    if (definition.singleton) singletonDefinitions.add(widget.definitionId);
    return [{
      ...widget,
      definitionVersion: definition.version,
      config: {
        ...widget.config,
        limit: widget.config.limit ? clamp(widget.config.limit, 1, 20) : undefined,
      },
    }];
  }).slice(0, 40);

  const widgetIds = new Set(widgets.map((widget) => widget.instanceId));
  const smallScreenOrder = [
    ...legacy.smallScreenOrder.filter((id, index) => widgetIds.has(id) && legacy.smallScreenOrder.indexOf(id) === index),
    ...widgets.map((widget) => widget.instanceId).filter((id) => !legacy.smallScreenOrder.includes(id)),
  ];
  const legacyPositions = new Map(
    legacy.layout
      .filter((position, index) => widgetIds.has(position.i) && legacy.layout.findIndex((item) => item.i === position.i) === index)
      .map((position) => [position.i, position]),
  );
  const orderIndex = new Map(smallScreenOrder.map((id, index) => [id, index]));
  const orderedWidgets = [...widgets].sort((first, second) => {
    const firstPosition = legacyPositions.get(first.instanceId);
    const secondPosition = legacyPositions.get(second.instanceId);
    if (firstPosition && secondPosition) return firstPosition.y - secondPosition.y || firstPosition.x - secondPosition.x;
    if (firstPosition) return -1;
    if (secondPosition) return 1;
    return (orderIndex.get(first.instanceId) ?? 0) - (orderIndex.get(second.instanceId) ?? 0);
  });
  const layout: DashboardWidgetPosition[] = [];
  const maxRows = 30;

  for (const widget of orderedWidgets) {
    if (widget.hidden) continue;
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    const previous = legacyPositions.get(widget.instanceId);
    const requiredMinWidth = clamp(definition.defaultSize.minW, 1, 12);
    const requiredMinHeight = clamp(definition.defaultSize.minH, 1, maxRows);
    const useCurrentDefinitionLimits = outdatedWidgetIds.has(widget.instanceId);
    const width = clamp(Math.max(previous?.w ?? definition.defaultSize.w, requiredMinWidth), requiredMinWidth, 12);
    const height = clamp(Math.max(previous?.h ?? definition.defaultSize.h, requiredMinHeight), requiredMinHeight, maxRows);
    const desired: DashboardWidgetPosition = {
      i: widget.instanceId,
      x: previous?.x ?? 0,
      y: previous?.y ?? 0,
      w: width,
      h: height,
      minW: clamp(useCurrentDefinitionLimits ? requiredMinWidth : previous?.minW ?? requiredMinWidth, 1, width),
      minH: clamp(useCurrentDefinitionLimits ? requiredMinHeight : previous?.minH ?? requiredMinHeight, 1, height),
      maxW: clamp(previous?.maxW ?? definition.defaultSize.maxW ?? 12, width, 12),
      maxH: clamp(previous?.maxH ?? definition.defaultSize.maxH ?? maxRows, height, maxRows),
    };
    const position = placePosition(desired, layout, maxRows);
    if (position) layout.push(position);
    else widget.hidden = true;
  }

  return parseDashboardPreferences({
    ...legacy,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    widgets,
    customKpis,
    layout,
    smallScreenOrder,
    grid: {
      rowsMode: legacy.grid.rowsMode,
      minRows: clamp(legacy.grid.minRows, 1, maxRows),
      maxRows,
      compaction: "vertical",
    },
  });
}
