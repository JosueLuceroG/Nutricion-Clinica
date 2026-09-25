import type { DashboardKpis } from "@app/hooks/useDashboardKpis";
import type { CustomKpiConfig, CustomKpiMetric, CustomKpiSource } from "./dashboardWidgetTypes";

export interface CustomKpiResult {
  value: number;
  formattedValue: string;
  hint: string;
  trend?: string;
  trendTone?: "up" | "down" | "neutral";
}

export interface CustomKpiFieldDefinition {
  value: string;
  label: string;
  source: CustomKpiSource;
  format: CustomKpiConfig["format"];
  defaultMetric: CustomKpiMetric;
  allowedMetrics: CustomKpiMetric[];
  read: (data: DashboardKpis) => number;
  denominator?: (data: DashboardKpis) => number;
  averageDivisor?: (data: DashboardKpis) => number;
  previous?: (data: DashboardKpis) => number;
}

const fields: CustomKpiFieldDefinition[] = [
  {
    value: "patients.active",
    label: "Pacientes activos",
    source: "patients",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count", "percentage"],
    read: (data) => data.totalActivePatients,
    denominator: (data) => data.totalPatients,
  },
  {
    value: "patients.newThisMonth",
    label: "Nuevos este mes",
    source: "patients",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count", "percentage"],
    read: (data) => data.newPatientsThisMonth,
    denominator: (data) => data.totalPatients,
    previous: (data) => data.newPatientsPreviousMonth,
  },
  {
    value: "patients.total",
    label: "Total de pacientes",
    source: "patients",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count"],
    read: (data) => data.totalPatients,
  },
  {
    value: "consultations.today",
    label: "Consultas de hoy",
    source: "consultations",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count", "percentage"],
    read: (data) => data.consultationsToday,
    denominator: (data) => data.consultationsToday + data.scheduledConsultationsToday,
  },
  {
    value: "consultations.thisMonth",
    label: "Consultas del mes",
    source: "consultations",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count", "average"],
    read: (data) => data.consultationsThisMonth,
    averageDivisor: () => Math.max(1, new Date().getDate()),
  },
  {
    value: "payments.incomeThisMonth",
    label: "Ingresos del mes",
    source: "payments",
    format: "currency",
    defaultMetric: "sum",
    allowedMetrics: ["sum", "average", "percentage"],
    read: (data) => data.incomeThisMonth,
    denominator: (data) => data.incomeThisMonth + data.pendingPaymentsAmountThisMonth,
    averageDivisor: (data) => data.paymentsThisMonth,
    previous: (data) => data.incomePreviousMonth,
  },
  {
    value: "payments.pendingAmount",
    label: "Saldo pendiente",
    source: "payments",
    format: "currency",
    defaultMetric: "sum",
    allowedMetrics: ["sum"],
    read: (data) => data.pendingPaymentsAmount,
  },
  {
    value: "payments.pendingCount",
    label: "Cobros pendientes",
    source: "payments",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count"],
    read: (data) => data.pendingPayments,
  },
  {
    value: "plans.active",
    label: "Planes activos",
    source: "plans",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count"],
    read: (data) => data.activePlans,
  },
  {
    value: "plans.expiring",
    label: "Planes por vencer",
    source: "plans",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count", "percentage"],
    read: (data) => data.expiringPlans.length,
    denominator: (data) => data.activePlans,
  },
  {
    value: "agenda.today",
    label: "Citas de hoy",
    source: "agenda",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count"],
    read: (data) => data.appointmentsToday.length,
  },
  {
    value: "agenda.unconfirmed",
    label: "Citas sin confirmar",
    source: "agenda",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count", "percentage"],
    read: (data) => data.unconfirmedAppointments.length,
    denominator: (data) => data.upcomingAppointments.length,
  },
  {
    value: "system.pendingSync",
    label: "Pendientes de sincronizar",
    source: "system",
    format: "number",
    defaultMetric: "count",
    allowedMetrics: ["count"],
    read: (data) => data.pendingSync,
  },
];

export const CUSTOM_KPI_FIELDS = fields.reduce<Record<CustomKpiSource, CustomKpiFieldDefinition[]>>(
  (grouped, field) => {
    grouped[field.source].push(field);
    return grouped;
  },
  {
    patients: [],
    consultations: [],
    payments: [],
    plans: [],
    agenda: [],
    system: [],
  },
);

export function getCustomKpiField(
  source: CustomKpiSource,
  valueField: string | undefined,
): CustomKpiFieldDefinition | null {
  return CUSTOM_KPI_FIELDS[source].find((field) => field.value === valueField) ?? null;
}

export function customKpiSupportsComparison(
  field: CustomKpiFieldDefinition,
  metric: CustomKpiMetric,
): boolean {
  return Boolean(field.previous) && (metric === "count" || metric === "sum");
}

function calculatedValue(
  field: CustomKpiFieldDefinition,
  metric: CustomKpiMetric,
  data: DashboardKpis,
): number {
  const rawValue = field.read(data);
  if (metric === "percentage") {
    const denominator = field.denominator?.(data) ?? 0;
    return denominator > 0 ? (rawValue / denominator) * 100 : 0;
  }
  if (metric === "average") {
    const divisor = field.averageDivisor?.(data) ?? 0;
    return divisor > 0 ? rawValue / divisor : 0;
  }
  return rawValue;
}

function formatValue(config: CustomKpiConfig, format: CustomKpiConfig["format"], value: number): string {
  const precision = config.precision ?? (format === "currency" ? 2 : 1);
  const notation = config.notation ?? "standard";
  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: precision,
    notation,
  };
  if (config.precision !== undefined) options.minimumFractionDigits = precision;
  if (format === "currency") {
    options.style = "currency";
    options.currency = "MXN";
  } else if (format === "percentage") {
    options.style = "percent";
  }
  const normalizedValue = format === "percentage" ? value / 100 : value;
  const formatted = new Intl.NumberFormat("es-MX", options).format(normalizedValue);
  return `${config.prefix ?? ""}${formatted}${config.suffix ?? ""}`;
}

export function evaluateCustomKpi(
  config: CustomKpiConfig,
  data: DashboardKpis | null,
): CustomKpiResult {
  if (!data) return { value: 0, formattedValue: "--", hint: "Esperando datos reales" };
  const field = getCustomKpiField(config.source, config.valueField);
  if (!field || !field.allowedMetrics.includes(config.metric) || config.filters.length > 0) {
    return { value: 0, formattedValue: "--", hint: "Configuración no válida" };
  }

  const value = calculatedValue(field, config.metric, data);
  const format = config.metric === "percentage" ? "percentage" : field.format;
  let trend: string | undefined;
  let trendTone: CustomKpiResult["trendTone"];

  if (config.comparison === "previousPeriod" && customKpiSupportsComparison(field, config.metric)) {
    const previous = field.previous?.(data) ?? 0;
    if (previous === 0 && value > 0) {
      trend = "Nuevo";
      trendTone = config.trendDirection === "neutral" ? "neutral" : config.trendDirection === "decreaseIsPositive" ? "down" : "up";
    } else if (previous > 0) {
      const change = Math.round(((value - previous) / previous) * 100);
      trend = `${change > 0 ? "↑" : change < 0 ? "↓" : ""} ${Math.abs(change)}%`.trim();
      if (config.trendDirection === "neutral" || change === 0) trendTone = "neutral";
      else if (config.trendDirection === "decreaseIsPositive") trendTone = change < 0 ? "up" : "down";
      else trendTone = change > 0 ? "up" : "down";
    }
  }

  return {
    value,
    formattedValue: formatValue(config, format, value),
    hint: config.description || field.label,
    ...(trend ? { trend, trendTone } : {}),
  };
}
