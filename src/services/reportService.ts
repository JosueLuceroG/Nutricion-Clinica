import { db } from "@services/db/dexieSchema";
import { DexieReportsRepository } from "@modules/reports/infrastructure/DexieReportsRepository";
import { createIndicatorUC, updateIndicatorUC, deleteIndicatorUC, listIndicatorsUC, recordIndicatorValueUC, getIndicatorHistoryUC, generateReportUC, saveDashboardConfigUC, listDashboardConfigsUC } from "@modules/reports/application/reportUseCases";
import type { IndicatorId } from "@modules/reports/domain/IndicatorId";
import type { Indicator } from "@modules/reports/domain/Indicator";
import type { IndicatorValue } from "@modules/reports/domain/IndicatorValue";
import type { GeneratedReport } from "@modules/reports/domain/GeneratedReport";
import type { DashboardConfig } from "@modules/reports/domain/DashboardConfig";
import type { IndicatorProps } from "@modules/reports/domain/Indicator";
import type { IndicatorValueProps } from "@modules/reports/domain/IndicatorValue";
import type { DashboardConfigProps } from "@modules/reports/domain/DashboardConfig";

const repository = new DexieReportsRepository(db);

export const reportService = {
  createIndicator: (input: Omit<IndicatorProps, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }): Promise<Indicator> => createIndicatorUC(repository, input),
  updateIndicator: (id: IndicatorId, input: Partial<IndicatorProps>): Promise<Indicator> => updateIndicatorUC(repository, id, input),
  deleteIndicator: (id: IndicatorId): Promise<void> => deleteIndicatorUC(repository, id),
  listIndicators: (): Promise<Indicator[]> => listIndicatorsUC(repository),
  recordIndicatorValue: (input: Omit<IndicatorValueProps, "createdAt"> & { createdAt?: number }): Promise<IndicatorValue> => recordIndicatorValueUC(repository, input),
  getIndicatorHistory: (indicatorId: IndicatorId): Promise<IndicatorValue[]> => getIndicatorHistoryUC(repository, indicatorId),
  getIndicatorValues: (indicatorId: IndicatorId): Promise<IndicatorValue[]> => getIndicatorHistoryUC(repository, indicatorId),
  generateReport: (params: { title: string; type: "operativo" | "financiero" | "regulatorio" | "kpi"; parametersJson?: string; generatedBy: string; contentHtml: string }): Promise<GeneratedReport> => generateReportUC(repository, params),
  saveDashboardConfig: (input: Omit<DashboardConfigProps, "createdAt" | "updatedAt" | "isVisible"> & { isVisible?: boolean }): Promise<DashboardConfig> => saveDashboardConfigUC(repository, input),
  listDashboardConfigs: (userId: string): Promise<DashboardConfig[]> => listDashboardConfigsUC(repository, userId),
};

export type ReportService = typeof reportService;
