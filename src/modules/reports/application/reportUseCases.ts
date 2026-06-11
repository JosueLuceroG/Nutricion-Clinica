import { Indicator, type IndicatorProps } from "../domain/Indicator";
import { createIndicatorId, type IndicatorId } from "../domain/IndicatorId";
import { IndicatorValue, type IndicatorValueProps } from "../domain/IndicatorValue";
import { GeneratedReport, type ReportType } from "../domain/GeneratedReport";
import { DashboardConfig, type DashboardConfigProps } from "../domain/DashboardConfig";
import type { ReportsRepository } from "../domain/ReportsRepository";

export const createIndicatorUC = async (
  repo: ReportsRepository,
  input: Omit<IndicatorProps, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean },
): Promise<Indicator> => {
  const indicator = Indicator.create({
    ...input,
    id: createIndicatorId(),
  });
  await repo.saveIndicator(indicator);
  return indicator;
};

export const updateIndicatorUC = async (
  repo: ReportsRepository,
  id: IndicatorId,
  input: Partial<IndicatorProps>,
): Promise<Indicator> => {
  const existing = await repo.findIndicatorById(id);
  if (!existing) throw new Error(`Indicador no encontrado: ${id}`);
  const updated = existing.with(input);
  await repo.saveIndicator(updated);
  return updated;
};

export const deleteIndicatorUC = async (
  repo: ReportsRepository,
  id: IndicatorId,
): Promise<void> => {
  await repo.deleteIndicator(id);
};

export const listIndicatorsUC = async (repo: ReportsRepository): Promise<Indicator[]> => {
  return repo.findAllIndicators();
};

export const recordIndicatorValueUC = async (
  repo: ReportsRepository,
  input: Omit<IndicatorValueProps, "createdAt" | "id" | "metadataJson"> & { createdAt?: number; metadataJson?: string },
): Promise<IndicatorValue> => {
  const value = IndicatorValue.create({
    ...input,
    id: crypto.randomUUID(),
  });
  await repo.saveIndicatorValue(value);
  return value;
};

export const getIndicatorHistoryUC = async (
  repo: ReportsRepository,
  indicatorId: IndicatorId,
): Promise<IndicatorValue[]> => {
  return repo.findValuesByIndicator(indicatorId);
};

export const generateReportUC = async (
  repo: ReportsRepository,
  params: {
    title: string;
    type: ReportType;
    parametersJson?: string;
    generatedBy: string;
    contentHtml: string;
  },
): Promise<GeneratedReport> => {
  const report = GeneratedReport.create({
    id: crypto.randomUUID(),
    title: params.title,
    type: params.type,
    parametersJson: params.parametersJson ?? "{}",
    contentHtml: params.contentHtml,
    generatedBy: params.generatedBy,
  });
  await repo.saveReport(report);
  return report;
};

export const saveDashboardConfigUC = async (
  repo: ReportsRepository,
  input: Omit<DashboardConfigProps, "createdAt" | "updatedAt" | "isVisible" | "id"> & { isVisible?: boolean },
): Promise<DashboardConfig> => {
  const config = DashboardConfig.create({
    ...input,
    id: crypto.randomUUID(),
  });
  await repo.saveDashboardConfig(config);
  return config;
};

export const listDashboardConfigsUC = async (
  repo: ReportsRepository,
  userId: string,
): Promise<DashboardConfig[]> => {
  return repo.findDashboardConfigsByUser(userId);
};
