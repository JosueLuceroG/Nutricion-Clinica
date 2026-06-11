import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieReportsRepository } from "./DexieReportsRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Indicator } from "../domain/Indicator";
import type { IndicatorProps } from "../domain/Indicator";
import { IndicatorValue } from "../domain/IndicatorValue";
import type { IndicatorValueProps } from "../domain/IndicatorValue";
import { GeneratedReport } from "../domain/GeneratedReport";
import type { GeneratedReportProps } from "../domain/GeneratedReport";
import { DashboardConfig } from "../domain/DashboardConfig";
import type { DashboardConfigProps } from "../domain/DashboardConfig";
import { IndicatorNotFoundError, ReportNotFoundError } from "../domain/ReportsRepository";
import { indicatorIdFromUnsafe, createIndicatorId } from "../domain/IndicatorId";

const makeIndicator = (overrides: Partial<IndicatorProps> = {}): Indicator =>
  Indicator.reconstitute({
    id: overrides.id ?? indicatorIdFromUnsafe(crypto.randomUUID()),
    name: overrides.name ?? "Pacientes activos",
    description: overrides.description ?? "",
    category: overrides.category ?? "consultas",
    unit: overrides.unit ?? "",
    calculationType: overrides.calculationType ?? "count",
    formula: overrides.formula,
    refreshFrequency: overrides.refreshFrequency ?? "monthly",
    metaValue: overrides.metaValue,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? 1000000,
    updatedAt: overrides.updatedAt ?? 1000000,
  });

const makeIndicatorValue = (overrides: Partial<IndicatorValueProps> = {}): IndicatorValue =>
  IndicatorValue.reconstitute({
    id: overrides.id ?? crypto.randomUUID(),
    indicatorId: overrides.indicatorId ?? indicatorIdFromUnsafe(crypto.randomUUID()),
    value: overrides.value ?? 42,
    periodStart: overrides.periodStart ?? "2024-01-01",
    periodEnd: overrides.periodEnd ?? "2024-01-31",
    dimension: overrides.dimension ?? "global",
    dimensionType: overrides.dimensionType ?? "month",
    metadataJson: overrides.metadataJson ?? "{}",
    createdAt: overrides.createdAt ?? 1000000,
  });

const makeReport = (overrides: Partial<GeneratedReportProps> = {}): GeneratedReport =>
  GeneratedReport.reconstitute({
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? "Reporte mensual",
    type: overrides.type ?? "operativo",
    parametersJson: overrides.parametersJson ?? "{}",
    contentHtml: overrides.contentHtml ?? "<p>Reporte</p>",
    generatedAt: overrides.generatedAt ?? 2000000,
    generatedBy: overrides.generatedBy ?? "user-1",
    status: overrides.status ?? "draft",
  });

const makeDashboardConfig = (overrides: Partial<DashboardConfigProps> = {}): DashboardConfig =>
  DashboardConfig.reconstitute({
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? "user-1",
    widgetType: overrides.widgetType ?? "kpi_card",
    title: overrides.title ?? "Indicador principal",
    indicatorIdsJson: overrides.indicatorIdsJson ?? "[]",
    position: overrides.position ?? 0,
    settingsJson: overrides.settingsJson ?? "{}",
    isVisible: overrides.isVisible ?? true,
    createdAt: overrides.createdAt ?? 1000000,
    updatedAt: overrides.updatedAt ?? 1000000,
  });

describe("DexieReportsRepository", () => {
  let repo: DexieReportsRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieReportsRepository(db);
  });

  describe("Indicator", () => {
    it("guarda y recupera un indicador por id", async () => {
      const indicator = makeIndicator({ name: "Consultas del mes" });
      await repo.saveIndicator(indicator);

      const found = await repo.findIndicatorById(indicator.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Consultas del mes");
    });

    it("findIndicatorById retorna null si no existe", async () => {
      const found = await repo.findIndicatorById(createIndicatorId());
      expect(found).toBeNull();
    });

    it("findAllIndicators retorna todos los indicadores", async () => {
      await repo.saveIndicator(makeIndicator({ name: "Indicador A" }));
      await repo.saveIndicator(makeIndicator({ name: "Indicador B" }));

      const all = await repo.findAllIndicators();
      expect(all).toHaveLength(2);
      expect(all.map((i) => i.name).sort()).toEqual(["Indicador A", "Indicador B"]);
    });

    it("deleteIndicator elimina un indicador existente", async () => {
      const indicator = makeIndicator();
      await repo.saveIndicator(indicator);

      await repo.deleteIndicator(indicator.id);

      const found = await repo.findIndicatorById(indicator.id);
      expect(found).toBeNull();
    });

    it("deleteIndicator lanza IndicatorNotFoundError si no existe", async () => {
      const id = createIndicatorId();
      await expect(repo.deleteIndicator(id)).rejects.toThrow(IndicatorNotFoundError);
    });
  });

  describe("IndicatorValue", () => {
    it("guarda y recupera valores por indicator", async () => {
      const indicatorId = indicatorIdFromUnsafe(crypto.randomUUID());
      const v1 = makeIndicatorValue({ indicatorId, value: 10 });
      const v2 = makeIndicatorValue({ indicatorId, value: 20 });

      await repo.saveIndicatorValue(v1);
      await repo.saveIndicatorValue(v2);

      const values = await repo.findValuesByIndicator(indicatorId);
      expect(values).toHaveLength(2);
      expect(values.map((v) => v.value).sort()).toEqual([10, 20]);
    });

    it("findLatestValueByIndicator retorna el valor mas reciente", async () => {
      const indicatorId = indicatorIdFromUnsafe(crypto.randomUUID());
      const old = makeIndicatorValue({ indicatorId, value: 10, createdAt: 1000 });
      const latest = makeIndicatorValue({ indicatorId, value: 20, createdAt: 2000 });

      await repo.saveIndicatorValue(old);
      await repo.saveIndicatorValue(latest);

      const found = await repo.findLatestValueByIndicator(indicatorId);
      expect(found).not.toBeNull();
      expect(found?.value).toBe(20);
    });

    it("findLatestValueByIndicator retorna null si no hay valores", async () => {
      const found = await repo.findLatestValueByIndicator(createIndicatorId());
      expect(found).toBeNull();
    });
  });

  describe("GeneratedReport", () => {
    it("guarda y recupera un reporte por id", async () => {
      const report = makeReport({ title: "Reporte financiero" });
      await repo.saveReport(report);

      const found = await repo.findReportById(report.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe("Reporte financiero");
    });

    it("findReportById retorna null si no existe", async () => {
      const found = await repo.findReportById(crypto.randomUUID());
      expect(found).toBeNull();
    });

    it("findAllReports retorna todos ordenados por generatedAt descendente", async () => {
      const r1 = makeReport({ title: "A", generatedAt: 1000 });
      const r2 = makeReport({ title: "B", generatedAt: 3000 });
      const r3 = makeReport({ title: "C", generatedAt: 2000 });

      await repo.saveReport(r1);
      await repo.saveReport(r2);
      await repo.saveReport(r3);

      const all = await repo.findAllReports();
      expect(all).toHaveLength(3);
      expect(all[0]?.title).toBe("B");
      expect(all[1]?.title).toBe("C");
      expect(all[2]?.title).toBe("A");
    });

    it("deleteReport elimina un reporte existente", async () => {
      const report = makeReport();
      await repo.saveReport(report);

      await repo.deleteReport(report.id);

      const found = await repo.findReportById(report.id);
      expect(found).toBeNull();
    });

    it("deleteReport lanza ReportNotFoundError si no existe", async () => {
      await expect(repo.deleteReport(crypto.randomUUID())).rejects.toThrow(ReportNotFoundError);
    });
  });

  describe("DashboardConfig", () => {
    it("guarda y recupera configuraciones por usuario", async () => {
      const userId = crypto.randomUUID();
      const c1 = makeDashboardConfig({ userId, title: "Widget A" });
      const c2 = makeDashboardConfig({ userId, title: "Widget B" });

      await repo.saveDashboardConfig(c1);
      await repo.saveDashboardConfig(c2);

      const configs = await repo.findDashboardConfigsByUser(userId);
      expect(configs).toHaveLength(2);
      expect(configs.map((c) => c.title).sort()).toEqual(["Widget A", "Widget B"]);
    });

    it("findDashboardConfigsByUser retorna vacio si no hay configuraciones", async () => {
      const configs = await repo.findDashboardConfigsByUser("nonexistent");
      expect(configs).toEqual([]);
    });

    it("deleteDashboardConfig elimina una configuracion", async () => {
      const config = makeDashboardConfig();
      await repo.saveDashboardConfig(config);

      await repo.deleteDashboardConfig(config.id);

      const configs = await repo.findDashboardConfigsByUser(config.userId);
      expect(configs).toHaveLength(0);
    });
  });
});
