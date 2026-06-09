import type { Indicator } from "./Indicator";
import type { IndicatorId } from "./IndicatorId";
import type { IndicatorValue } from "./IndicatorValue";
import type { GeneratedReport } from "./GeneratedReport";
import type { DashboardConfig } from "./DashboardConfig";

export interface ReportsRepository {
  saveIndicator(indicator: Indicator): Promise<void>;
  findIndicatorById(id: IndicatorId): Promise<Indicator | null>;
  findAllIndicators(): Promise<Indicator[]>;
  deleteIndicator(id: IndicatorId): Promise<void>;

  saveIndicatorValue(value: IndicatorValue): Promise<void>;
  findValuesByIndicator(indicatorId: IndicatorId): Promise<IndicatorValue[]>;
  findLatestValueByIndicator(indicatorId: IndicatorId): Promise<IndicatorValue | null>;

  saveReport(report: GeneratedReport): Promise<void>;
  findReportById(id: string): Promise<GeneratedReport | null>;
  findAllReports(): Promise<GeneratedReport[]>;
  deleteReport(id: string): Promise<void>;

  saveDashboardConfig(config: DashboardConfig): Promise<void>;
  findDashboardConfigsByUser(userId: string): Promise<DashboardConfig[]>;
  deleteDashboardConfig(id: string): Promise<void>;
}

export class IndicatorNotFoundError extends Error {
  constructor(public readonly id: IndicatorId) {
    super(`Indicador no encontrado: ${id}`);
    this.name = "IndicatorNotFoundError";
  }
}

export class ReportNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Reporte no encontrado: ${id}`);
    this.name = "ReportNotFoundError";
  }
}
