export const DASHBOARD_SCHEMA_VERSION = 1;

export type DashboardWidgetCategory =
  | "general"
  | "patients"
  | "consultations"
  | "payments"
  | "agenda"
  | "plans"
  | "alerts"
  | "activity"
  | "finance"
  | "quickActions"
  | "system"
  | "custom";

export type DashboardWidgetKind =
  | "kpi"
  | "upcomingConsultations"
  | "weeklyActivity"
  | "alerts"
  | "financialSummary"
  | "recentPayments"
  | "quickActions"
  | "customKpi";

export type DashboardWidgetDefinitionId =
  | "activePatients"
  | "newPatientsThisMonth"
  | "consultationsToday"
  | "consultationsThisMonth"
  | "incomeThisMonth"
  | "pendingPayments"
  | "activePlans"
  | "pendingSync"
  | "upcomingConsultations"
  | "weeklyActivity"
  | "alerts"
  | "financialSummary"
  | "recentPayments"
  | "quickActions"
  | "customKpi";

export type DashboardWidgetSizePreset =
  | "small"
  | "wide"
  | "medium"
  | "large"
  | "fullWidth"
  | "doubleHeight"
  | "custom";

export interface DashboardWidgetSize {
  preset: DashboardWidgetSizePreset;
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardWidgetDefinition {
  id: DashboardWidgetDefinitionId;
  version: number;
  name: string;
  description: string;
  category: DashboardWidgetCategory;
  kind: DashboardWidgetKind;
  iconKey: string;
  tone: DashboardWidgetTone;
  defaultSize: DashboardWidgetSize;
  allowedSizes: DashboardWidgetSizePreset[];
  singleton: boolean;
  configurable: boolean;
  requiredModule?: string;
}

export type DashboardWidgetTone =
  | "green"
  | "blue"
  | "purple"
  | "orange"
  | "cyan"
  | "rose"
  | "slate";

export interface DashboardWidgetConfig {
  title?: string;
  description?: string;
  tone?: DashboardWidgetTone;
  period?: "today" | "week" | "month" | "quarter" | "year";
  limit?: number;
  customKpiId?: string;
}

export interface DashboardWidgetInstance {
  instanceId: string;
  definitionId: DashboardWidgetDefinitionId;
  definitionVersion: number;
  hidden: boolean;
  config: DashboardWidgetConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidgetPosition {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export type CustomKpiSource =
  | "patients"
  | "consultations"
  | "payments"
  | "plans"
  | "agenda"
  | "system";

export type CustomKpiMetric =
  | "count"
  | "sum"
  | "average"
  | "percentage";

export type CustomKpiVisualization =
  | "largeNumber"
  | "percentage"
  | "progress"
  | "simpleCard";

export interface CustomKpiFilter {
  field: string;
  operator: "equals" | "notEquals" | "greaterThan" | "lessThan";
  value: string | number | boolean;
}

export interface CustomKpiConfig {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  tone: DashboardWidgetTone;
  category: DashboardWidgetCategory;
  source: CustomKpiSource;
  metric: CustomKpiMetric;
  valueField?: string;
  filters: CustomKpiFilter[];
  comparison: "none" | "previousPeriod";
  visualization: CustomKpiVisualization;
  format: "number" | "currency" | "percentage";
  precision?: 0 | 1 | 2;
  notation?: "standard" | "compact";
  prefix?: string;
  suffix?: string;
  trendDirection?: "increaseIsPositive" | "decreaseIsPositive" | "neutral";
  size: DashboardWidgetSizePreset;
  createdAt: string;
  updatedAt: string;
}

export type DashboardPresetId =
  | "default"
  | "clinical"
  | "financial"
  | "operational"
  | "empty";

export interface DashboardGridPreferences {
  rowsMode: "auto" | "manual";
  minRows: number;
  maxRows: number;
  compaction: "vertical";
}

export interface DashboardPreferences {
  schemaVersion: number;
  userId: string;
  sucursalId: string | null;
  activePresetId: DashboardPresetId | null;
  widgets: DashboardWidgetInstance[];
  customKpis: CustomKpiConfig[];
  layout: DashboardWidgetPosition[];
  smallScreenOrder: string[];
  grid: DashboardGridPreferences;
  updatedAt: string;
  revision: string;
}

export interface DashboardScope {
  userId: string;
  sucursalId: string | null;
}

export interface LegacyDashboardPreferences {
  kpiOrder: string[];
  hiddenKpiIds: string[];
}
