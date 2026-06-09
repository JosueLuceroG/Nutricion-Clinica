import { describe, it, expect, beforeEach } from "vitest";
import { generateReportUC } from "./reportUseCases";
import { ReportTypeSchema, type GeneratedReport, type ReportType, type GeneratedReportProps } from "../domain/GeneratedReport";
import { GeneratedReportSchema } from "../domain/GeneratedReport";
import type { ReportsRepository } from "../domain/ReportsRepository";
import type { Indicator } from "../domain/Indicator";
import type { IndicatorId } from "../domain/IndicatorId";
import type { IndicatorValue } from "../domain/IndicatorValue";
import type { DashboardConfig } from "../domain/DashboardConfig";

class InMemoryReportsRepository implements ReportsRepository {
  private reports: GeneratedReport[] = [];
  private indicators: Indicator[] = [];
  private indicatorValues: IndicatorValue[] = [];
  private dashboardConfigs: DashboardConfig[] = [];

  async saveIndicator(indicator: Indicator): Promise<void> {
    const idx = this.indicators.findIndex((i) => i.id === indicator.id);
    if (idx >= 0) this.indicators[idx] = indicator;
    else this.indicators.push(indicator);
  }
  async findIndicatorById(id: IndicatorId): Promise<Indicator | null> {
    return this.indicators.find((i) => i.id === id) ?? null;
  }
  async findAllIndicators(): Promise<Indicator[]> {
    return this.indicators;
  }
  async deleteIndicator(id: IndicatorId): Promise<void> {
    this.indicators = this.indicators.filter((i) => i.id !== id);
  }
  async saveIndicatorValue(value: IndicatorValue): Promise<void> {
    this.indicatorValues.push(value);
  }
  async findValuesByIndicator(indicatorId: IndicatorId): Promise<IndicatorValue[]> {
    return this.indicatorValues.filter((v) => v.indicatorId === indicatorId);
  }
  async findLatestValueByIndicator(indicatorId: IndicatorId): Promise<IndicatorValue | null> {
    const values = this.indicatorValues.filter((v) => v.indicatorId === indicatorId);
    return values.length > 0 ? values[values.length - 1] : null;
  }
  async saveReport(report: GeneratedReport): Promise<void> {
    this.reports.push(report);
  }
  async findReportById(id: string): Promise<GeneratedReport | null> {
    return this.reports.find((r) => r.id === id) ?? null;
  }
  async findAllReports(): Promise<GeneratedReport[]> {
    return this.reports;
  }
  async deleteReport(id: string): Promise<void> {
    this.reports = this.reports.filter((r) => r.id !== id);
  }
  async saveDashboardConfig(config: DashboardConfig): Promise<void> {
    this.dashboardConfigs.push(config);
  }
  async findDashboardConfigsByUser(userId: string): Promise<DashboardConfig[]> {
    return this.dashboardConfigs.filter((c) => c.userId === userId);
  }
  async deleteDashboardConfig(id: string): Promise<void> {
    this.dashboardConfigs = this.dashboardConfigs.filter((c) => c.id !== id);
  }
}

describe("generateReportUC", () => {
  let repo: InMemoryReportsRepository;

  beforeEach(() => {
    repo = new InMemoryReportsRepository();
  });

  const allTypes: ReportType[] = ["operativo", "financiero", "regulatorio", "kpi"];

  it.each(allTypes)("crea un reporte con type %s", async (type) => {
    const report = await generateReportUC(repo, {
      title: `Reporte ${type}`,
      type,
      generatedBy: "user-test",
      contentHtml: "<p>contenido</p>",
    });

    expect(report.type).toBe(type);
    expect(report.title).toBe(`Reporte ${type}`);
    expect(report.status).toBe("draft");
    expect(report.generatedBy).toBe("user-test");
    expect(report.contentHtml).toBe("<p>contenido</p>");

    const saved = await repo.findReportById(report.id);
    expect(saved).not.toBeNull();
    expect(saved!.type).toBe(type);
  });

  it("persiste el reporte en el repositorio", async () => {
    const report = await generateReportUC(repo, {
      title: "Persistencia test",
      type: "regulatorio",
      generatedBy: "user-test",
      contentHtml: "<p>test</p>",
    });

    const saved = await repo.findReportById(report.id);
    expect(saved).toBeDefined();
    expect(saved!.title).toBe("Persistencia test");
    expect(saved!.type).toBe("regulatorio");
  });

  it("asigna status draft por defecto", async () => {
    const report = await generateReportUC(repo, {
      title: "Draft test",
      type: "operativo",
      generatedBy: "user",
      contentHtml: "",
    });
    expect(report.status).toBe("draft");
  });

  it("asigna generatedAt como timestamp positivo", async () => {
    const report = await generateReportUC(repo, {
      title: "Timestamp test",
      type: "financiero",
      generatedBy: "user",
      contentHtml: "",
    });
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.generatedAt).toBeLessThanOrEqual(Date.now());
  });
});

describe("getReportsByType (filtering via findAllReports)", () => {
  let repo: InMemoryReportsRepository;

  const getReportsByType = async (r: ReportsRepository, type: ReportType): Promise<GeneratedReport[]> => {
    const all = await r.findAllReports();
    return all.filter((report) => report.type === type);
  };

  beforeEach(async () => {
    repo = new InMemoryReportsRepository();
    await generateReportUC(repo, { title: "Op 1", type: "operativo", generatedBy: "u1", contentHtml: "" });
    await generateReportUC(repo, { title: "Fin 1", type: "financiero", generatedBy: "u1", contentHtml: "" });
    await generateReportUC(repo, { title: "Reg 1", type: "regulatorio", generatedBy: "u2", contentHtml: "" });
    await generateReportUC(repo, { title: "KPI 1", type: "kpi", generatedBy: "u2", contentHtml: "" });
    await generateReportUC(repo, { title: "Op 2", type: "operativo", generatedBy: "u1", contentHtml: "" });
  });

  it("filtra reportes por tipo operativo", async () => {
    const result = await getReportsByType(repo, "operativo");
    expect(result).toHaveLength(2);
    result.forEach((r) => expect(r.type).toBe("operativo"));
  });

  it("filtra reportes por tipo financiero", async () => {
    const result = await getReportsByType(repo, "financiero");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("financiero");
  });

  it("filtra reportes por tipo regulatorio", async () => {
    const result = await getReportsByType(repo, "regulatorio");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("regulatorio");
  });

  it("filtra reportes por tipo kpi", async () => {
    const result = await getReportsByType(repo, "kpi");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("kpi");
  });

  it("retorna arreglo vacío si no hay reportes del tipo", async () => {
    const repoVacio = new InMemoryReportsRepository();
    const result = await getReportsByType(repoVacio, "regulatorio");
    expect(result).toHaveLength(0);
  });
});

describe("ReportTypeSchema", () => {
  it("incluye 'regulatorio' como opción válida", () => {
    const result = ReportTypeSchema.safeParse("regulatorio");
    expect(result.success).toBe(true);
  });

  it("incluye 'operativo' como opción válida", () => {
    expect(ReportTypeSchema.safeParse("operativo").success).toBe(true);
  });

  it("incluye 'financiero' como opción válida", () => {
    expect(ReportTypeSchema.safeParse("financiero").success).toBe(true);
  });

  it("incluye 'kpi' como opción válida", () => {
    expect(ReportTypeSchema.safeParse("kpi").success).toBe(true);
  });

  it("rechaza un tipo inválido", () => {
    expect(ReportTypeSchema.safeParse("invalid").success).toBe(false);
    expect(ReportTypeSchema.safeParse("").success).toBe(false);
  });

  it("GenerateReportSchema acepta todos los tipos incluyendo regulatorio", () => {
    const validReport: GeneratedReportProps = {
      id: crypto.randomUUID(),
      title: "Test regulatorio",
      type: "regulatorio",
      parametersJson: "{}",
      contentHtml: "<p>test</p>",
      generatedAt: Date.now(),
      generatedBy: "user",
      status: "draft",
    };
    const result = GeneratedReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it("GeneratedReportSchema rechaza un reporte con tipo inválido", () => {
    const invalidReport = {
      id: crypto.randomUUID(),
      title: "Test",
      type: "invalid-type",
      parametersJson: "{}",
      contentHtml: "",
      generatedAt: Date.now(),
      generatedBy: "user",
      status: "draft",
    };
    const result = GeneratedReportSchema.safeParse(invalidReport);
    expect(result.success).toBe(false);
  });
});
