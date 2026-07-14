import { v4 as uuid } from "uuid";
import { DASHBOARD_SCHEMA_VERSION, type DashboardPreferences, type DashboardPresetId, type DashboardScope, type DashboardWidgetDefinitionId, type DashboardWidgetInstance, type DashboardWidgetPosition, type LegacyDashboardPreferences } from "./dashboardWidgetTypes";
import { getDashboardWidgetDefinition } from "./dashboardWidgetRegistry";

const DEFAULT_WIDGET_IDS: DashboardWidgetDefinitionId[] = [
  "activePatients",
  "consultationsToday",
  "incomeThisMonth",
  "pendingPayments",
  "upcomingConsultations",
  "weeklyActivity",
  "alerts",
  "financialSummary",
  "recentPayments",
  "quickActions",
];

const PRESET_WIDGET_IDS: Record<DashboardPresetId, DashboardWidgetDefinitionId[]> = {
  default: DEFAULT_WIDGET_IDS,
  clinical: [
    "activePatients",
    "newPatientsThisMonth",
    "consultationsToday",
    "activePlans",
    "upcomingConsultations",
    "weeklyActivity",
    "alerts",
    "quickActions",
  ],
  financial: [
    "incomeThisMonth",
    "pendingPayments",
    "consultationsThisMonth",
    "activePatients",
    "financialSummary",
    "recentPayments",
    "weeklyActivity",
  ],
  operational: [
    "consultationsToday",
    "consultationsThisMonth",
    "activePlans",
    "pendingSync",
    "upcomingConsultations",
    "alerts",
    "weeklyActivity",
    "quickActions",
  ],
  empty: [],
};

const defaultPositions: Record<string, DashboardWidgetPosition> = {
  activePatients: { i: "activePatients", x: 0, y: 0, w: 3, h: 3 },
  consultationsToday: { i: "consultationsToday", x: 3, y: 0, w: 3, h: 3 },
  incomeThisMonth: { i: "incomeThisMonth", x: 6, y: 0, w: 3, h: 3 },
  pendingPayments: { i: "pendingPayments", x: 9, y: 0, w: 3, h: 3 },
  upcomingConsultations: { i: "upcomingConsultations", x: 0, y: 3, w: 4, h: 8 },
  weeklyActivity: { i: "weeklyActivity", x: 4, y: 3, w: 5, h: 8 },
  alerts: { i: "alerts", x: 9, y: 3, w: 3, h: 8 },
  financialSummary: { i: "financialSummary", x: 0, y: 11, w: 5, h: 6 },
  recentPayments: { i: "recentPayments", x: 5, y: 11, w: 4, h: 6 },
  quickActions: { i: "quickActions", x: 9, y: 11, w: 3, h: 6 },
};

function createInstance(definitionId: DashboardWidgetDefinitionId, now: string): DashboardWidgetInstance {
  const definition = getDashboardWidgetDefinition(definitionId);
  return {
    instanceId: definition.singleton ? definition.id : uuid(),
    definitionId,
    definitionVersion: definition.version,
    hidden: false,
    config: {},
    createdAt: now,
    updatedAt: now,
  };
}

function packPositions(widgets: DashboardWidgetInstance[]): DashboardWidgetPosition[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return widgets.map((widget) => {
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    const size = definition.defaultSize;
    if (x + size.w > 12) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    const position = {
      i: widget.instanceId,
      x,
      y,
      w: size.w,
      h: size.h,
      minW: size.minW,
      minH: size.minH,
      maxW: size.maxW,
      maxH: size.maxH,
    };
    x += size.w;
    rowHeight = Math.max(rowHeight, size.h);
    return position;
  });
}

export function createDashboardPreset(
  presetId: DashboardPresetId,
  scope: DashboardScope,
): DashboardPreferences {
  const now = new Date().toISOString();
  const widgets = PRESET_WIDGET_IDS[presetId].map((id) => createInstance(id, now));
  const layout = presetId === "default"
    ? widgets.map((widget) => {
        const base = defaultPositions[widget.definitionId]!;
        const size = getDashboardWidgetDefinition(widget.definitionId).defaultSize;
        return {
          ...base,
          i: widget.instanceId,
          minW: size.minW,
          minH: size.minH,
          maxW: size.maxW,
          maxH: size.maxH,
        };
      })
    : packPositions(widgets);

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    userId: scope.userId,
    sucursalId: scope.sucursalId,
    activePresetId: presetId,
    widgets,
    customKpis: [],
    layout,
    smallScreenOrder: widgets.map((widget) => widget.instanceId),
    grid: {
      rowsMode: "auto",
      minRows: 17,
      maxRows: 30,
      compaction: "vertical",
    },
    updatedAt: now,
    revision: uuid(),
  };
}

export function createDefaultDashboardPreferences(
  scope: DashboardScope,
  legacy?: LegacyDashboardPreferences,
): DashboardPreferences {
  const preferences = createDashboardPreset("default", scope);
  if (!legacy) return preferences;

  const premiumIds = ["activePatients", "consultationsToday", "incomeThisMonth", "pendingPayments"];
  const normalizedOrder = legacy.kpiOrder.filter((id) => premiumIds.includes(id));
  const completeOrder = [...normalizedOrder, ...premiumIds.filter((id) => !normalizedOrder.includes(id))];
  const otherIds = preferences.smallScreenOrder.filter((id) => !premiumIds.includes(id));
  preferences.smallScreenOrder = [
    ...completeOrder,
    ...otherIds,
  ];
  const visibleKpiOrder = completeOrder.filter((id) => !legacy.hiddenKpiIds.includes(id));
  preferences.layout = preferences.layout
    .filter((position) => !legacy.hiddenKpiIds.includes(position.i))
    .map((position) => {
      const kpiIndex = visibleKpiOrder.indexOf(position.i);
      return kpiIndex >= 0 ? { ...position, x: kpiIndex * 3, y: 0 } : position;
    });
  preferences.widgets = preferences.widgets.map((widget) => ({
    ...widget,
    hidden: legacy.hiddenKpiIds.includes(widget.definitionId),
  }));
  return preferences;
}

export const DASHBOARD_PRESET_META: Array<{
  id: DashboardPresetId;
  name: string;
  description: string;
}> = [
  { id: "default", name: "Predeterminado", description: "El dashboard premium original de NutriClínica." },
  { id: "clinical", name: "Clínico", description: "Pacientes, consultas, planes y alertas." },
  { id: "financial", name: "Financiero", description: "Ingresos, saldos y pagos recientes." },
  { id: "operational", name: "Operativo", description: "Agenda, actividad, pendientes y accesos rápidos." },
  { id: "empty", name: "Vacío", description: "Comienza desde una cuadrícula vacía." },
];

export function getNextDashboardPosition(
  layout: DashboardWidgetPosition[],
  definitionId: DashboardWidgetDefinitionId,
  instanceId: string,
  maxRows = 30,
): DashboardWidgetPosition | null {
  const size = getDashboardWidgetDefinition(definitionId).defaultSize;
  const collides = (x: number, y: number) => layout.some((item) =>
    x < item.x + item.w &&
    x + size.w > item.x &&
    y < item.y + item.h &&
    y + size.h > item.y,
  );
  for (let y = 0; y <= maxRows - size.h; y += 1) {
    for (let x = 0; x <= 12 - size.w; x += 1) {
      if (!collides(x, y)) {
        return {
          i: instanceId,
          x,
          y,
          w: size.w,
          h: size.h,
          minW: size.minW,
          minH: size.minH,
          maxW: size.maxW,
          maxH: size.maxH,
        };
      }
    }
  }
  return null;
}

export function packDashboardLayout(
  layout: DashboardWidgetPosition[],
  order: string[],
  maxRows = 30,
): DashboardWidgetPosition[] | null {
  const byId = new Map(layout.map((position) => [position.i, position]));
  const orderedIds = [
    ...order.filter((id, index) => byId.has(id) && order.indexOf(id) === index),
    ...layout.map((position) => position.i).filter((id) => !order.includes(id)),
  ];
  const packed: DashboardWidgetPosition[] = [];

  for (const id of orderedIds) {
    const source = byId.get(id);
    if (!source) continue;
    let placed: DashboardWidgetPosition | null = null;
    for (let y = 0; y <= maxRows - source.h && !placed; y += 1) {
      for (let x = 0; x <= 12 - source.w; x += 1) {
        const overlaps = packed.some((item) =>
          x < item.x + item.w &&
          x + source.w > item.x &&
          y < item.y + item.h &&
          y + source.h > item.y,
        );
        if (!overlaps) {
          placed = { ...source, x, y };
          break;
        }
      }
    }
    if (!placed) return null;
    packed.push(placed);
  }

  return packed;
}
