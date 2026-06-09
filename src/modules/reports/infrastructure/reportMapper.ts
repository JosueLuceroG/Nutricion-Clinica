import { Indicator, type IndicatorProps } from "../domain/Indicator";
import type { IndicatorId } from "../domain/IndicatorId";
import { IndicatorValue, type IndicatorValueProps } from "../domain/IndicatorValue";
import { GeneratedReport, type GeneratedReportProps } from "../domain/GeneratedReport";
import { DashboardConfig, type DashboardConfigProps } from "../domain/DashboardConfig";

export interface IndicatorRow {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  calculation_type: string;
  formula: string | null;
  refresh_frequency: string;
  meta_value: number | null;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface IndicatorValueRow {
  id: string;
  indicator_id: string;
  value: number;
  period_start: string;
  period_end: string;
  dimension: string;
  dimension_type: string;
  metadata_json: string;
  created_at: number;
}

export interface GeneratedReportRow {
  id: string;
  title: string;
  type: string;
  parameters_json: string;
  content_html: string;
  generated_at: number;
  generated_by: string;
  status: string;
}

export interface DashboardConfigRow {
  id: string;
  user_id: string;
  widget_type: string;
  title: string;
  indicator_ids_json: string;
  position: number;
  settings_json: string;
  is_visible: number;
  created_at: number;
  updated_at: number;
}

export function indicatorRowToDomain(row: IndicatorRow): Indicator {
  return Indicator.reconstitute({
    id: row.id as IndicatorId,
    name: row.name,
    description: row.description,
    category: row.category as IndicatorProps["category"],
    unit: row.unit,
    calculationType: row.calculation_type as IndicatorProps["calculationType"],
    formula: row.formula ?? undefined,
    refreshFrequency: row.refresh_frequency as IndicatorProps["refreshFrequency"],
    metaValue: row.meta_value ?? undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function indicatorDomainToRow(indicator: Indicator): IndicatorRow {
  const p = indicator.toProps();
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    unit: p.unit,
    calculation_type: p.calculationType,
    formula: p.formula ?? null,
    refresh_frequency: p.refreshFrequency,
    meta_value: p.metaValue ?? null,
    is_active: p.isActive ? 1 : 0,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function indicatorValueRowToDomain(row: IndicatorValueRow): IndicatorValue {
  return IndicatorValue.reconstitute({
    id: row.id,
    indicatorId: row.indicator_id as IndicatorId,
    value: row.value,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dimension: row.dimension,
    dimensionType: row.dimension_type as IndicatorValueProps["dimensionType"],
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
  });
}

export function indicatorValueDomainToRow(value: IndicatorValue): IndicatorValueRow {
  const p = value.toProps();
  return {
    id: p.id,
    indicator_id: p.indicatorId,
    value: p.value,
    period_start: p.periodStart,
    period_end: p.periodEnd,
    dimension: p.dimension,
    dimension_type: p.dimensionType,
    metadata_json: p.metadataJson,
    created_at: p.createdAt,
  };
}

export function generatedReportRowToDomain(row: GeneratedReportRow): GeneratedReport {
  return GeneratedReport.reconstitute({
    id: row.id,
    title: row.title,
    type: row.type as GeneratedReportProps["type"],
    parametersJson: row.parameters_json,
    contentHtml: row.content_html,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    status: row.status as GeneratedReportProps["status"],
  });
}

export function generatedReportDomainToRow(report: GeneratedReport): GeneratedReportRow {
  const p = report.toProps();
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    parameters_json: p.parametersJson,
    content_html: p.contentHtml,
    generated_at: p.generatedAt,
    generated_by: p.generatedBy,
    status: p.status,
  };
}

export function dashboardConfigRowToDomain(row: DashboardConfigRow): DashboardConfig {
  return DashboardConfig.reconstitute({
    id: row.id,
    userId: row.user_id,
    widgetType: row.widget_type as DashboardConfigProps["widgetType"],
    title: row.title,
    indicatorIdsJson: row.indicator_ids_json,
    position: row.position,
    settingsJson: row.settings_json,
    isVisible: row.is_visible === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function dashboardConfigDomainToRow(config: DashboardConfig): DashboardConfigRow {
  const p = config.toProps();
  return {
    id: p.id,
    user_id: p.userId,
    widget_type: p.widgetType,
    title: p.title,
    indicator_ids_json: p.indicatorIdsJson,
    position: p.position,
    settings_json: p.settingsJson,
    is_visible: p.isVisible ? 1 : 0,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}
