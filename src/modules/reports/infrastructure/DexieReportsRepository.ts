import type { ReportsRepository } from "../domain/ReportsRepository";
import { IndicatorNotFoundError, ReportNotFoundError } from "../domain/ReportsRepository";
import type { Indicator } from "../domain/Indicator";
import type { IndicatorId } from "../domain/IndicatorId";
import type { IndicatorValue } from "../domain/IndicatorValue";
import type { GeneratedReport } from "../domain/GeneratedReport";
import type { DashboardConfig } from "../domain/DashboardConfig";
import {
  indicatorDomainToRow,
  indicatorRowToDomain,
  indicatorValueDomainToRow,
  indicatorValueRowToDomain,
  generatedReportDomainToRow,
  generatedReportRowToDomain,
  dashboardConfigDomainToRow,
  dashboardConfigRowToDomain,
} from "./reportMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieReportsRepository implements ReportsRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async saveIndicator(indicator: Indicator): Promise<void> {
    const row = indicatorDomainToRow(indicator);
    await this.db.indicators.put(row);
  }

  async findIndicatorById(id: IndicatorId): Promise<Indicator | null> {
    const row = await this.db.indicators.get(id);
    if (!row) return null;
    return indicatorRowToDomain(row);
  }

  async findAllIndicators(): Promise<Indicator[]> {
    const rows = await this.db.indicators.toArray();
    return rows.map(indicatorRowToDomain);
  }

  async deleteIndicator(id: IndicatorId): Promise<void> {
    const existing = await this.db.indicators.get(id);
    if (!existing) throw new IndicatorNotFoundError(id);
    await this.db.indicators.delete(id);
  }

  async saveIndicatorValue(value: IndicatorValue): Promise<void> {
    const row = indicatorValueDomainToRow(value);
    await this.db.indicator_values.put(row);
  }

  async findValuesByIndicator(indicatorId: IndicatorId): Promise<IndicatorValue[]> {
    const rows = await this.db.indicator_values
      .where("indicator_id")
      .equals(indicatorId)
      .toArray();
    return rows.map(indicatorValueRowToDomain);
  }

  async findLatestValueByIndicator(indicatorId: IndicatorId): Promise<IndicatorValue | null> {
    const rows = await this.db.indicator_values
      .where("indicator_id")
      .equals(indicatorId)
      .reverse()
      .sortBy("created_at");
    return rows.length > 0 ? indicatorValueRowToDomain(rows[0]) : null;
  }

  async saveReport(report: GeneratedReport): Promise<void> {
    const row = generatedReportDomainToRow(report);
    await this.db.generated_reports.put(row);
  }

  async findReportById(id: string): Promise<GeneratedReport | null> {
    const row = await this.db.generated_reports.get(id);
    if (!row) return null;
    return generatedReportRowToDomain(row);
  }

  async findAllReports(): Promise<GeneratedReport[]> {
    const rows = await this.db.generated_reports.orderBy("generated_at").reverse().toArray();
    return rows.map(generatedReportRowToDomain);
  }

  async deleteReport(id: string): Promise<void> {
    const existing = await this.db.generated_reports.get(id);
    if (!existing) throw new ReportNotFoundError(id);
    await this.db.generated_reports.delete(id);
  }

  async saveDashboardConfig(config: DashboardConfig): Promise<void> {
    const row = dashboardConfigDomainToRow(config);
    await this.db.dashboard_configs.put(row);
  }

  async findDashboardConfigsByUser(userId: string): Promise<DashboardConfig[]> {
    const rows = await this.db.dashboard_configs
      .where("user_id")
      .equals(userId)
      .toArray();
    return rows.map(dashboardConfigRowToDomain);
  }

  async deleteDashboardConfig(id: string): Promise<void> {
    await this.db.dashboard_configs.delete(id);
  }
}
