import { describe, it, expect, vi } from "vitest";
import {
  createIndicatorUC,
  updateIndicatorUC,
  deleteIndicatorUC,
  listIndicatorsUC,
  recordIndicatorValueUC,
  getIndicatorHistoryUC,
  generateReportUC,
  saveDashboardConfigUC,
  listDashboardConfigsUC,
} from "./reportUseCases";
import type { ReportsRepository } from "../domain/ReportsRepository";
import { Indicator } from "../domain/Indicator";
import { createIndicatorId, indicatorIdFrom, type IndicatorId } from "../domain/IndicatorId";
import { IndicatorValue } from "../domain/IndicatorValue";
import { GeneratedReport } from "../domain/GeneratedReport";
import { DashboardConfig } from "../domain/DashboardConfig";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUUID2 = "660e8400-e29b-41d4-a716-446655440001";
const validUUID3 = "770e8400-e29b-41d4-a716-446655440002";

function createMockRepo(): ReportsRepository {
  const indicatorStore = new Map<string, Indicator>();
  const valueStore = new Map<string, IndicatorValue>();
  const reportStore = new Map<string, GeneratedReport>();
  const configStore = new Map<string, DashboardConfig>();
  return {
    saveIndicator: vi.fn(async (ind: Indicator) => {
      indicatorStore.set(ind.id, ind);
    }),
    findIndicatorById: vi.fn(async (id: IndicatorId) => indicatorStore.get(id) ?? null),
    findAllIndicators: vi.fn(async () => Array.from(indicatorStore.values())),
    deleteIndicator: vi.fn(async (id: IndicatorId) => {
      indicatorStore.delete(id);
    }),
    saveIndicatorValue: vi.fn(async (val: IndicatorValue) => {
      valueStore.set(val.id, val);
    }),
    findValuesByIndicator: vi.fn(async (indicatorId: IndicatorId) =>
      Array.from(valueStore.values()).filter((v) => v.indicatorId === indicatorId),
    ),
    findLatestValueByIndicator: vi.fn(async (indicatorId: IndicatorId) => {
      const values = Array.from(valueStore.values()).filter(
        (v) => v.indicatorId === indicatorId,
      );
      return values.length > 0 ? values[values.length - 1] : null;
    }),
    saveReport: vi.fn(async (rep: GeneratedReport) => {
      reportStore.set(rep.id, rep);
    }),
    findReportById: vi.fn(async (id: string) => reportStore.get(id) ?? null),
    findAllReports: vi.fn(async () => Array.from(reportStore.values())),
    deleteReport: vi.fn(async (id: string) => {
      reportStore.delete(id);
    }),
    saveDashboardConfig: vi.fn(async (config: DashboardConfig) => {
      configStore.set(config.id, config);
    }),
    findDashboardConfigsByUser: vi.fn(async (userId: string) =>
      Array.from(configStore.values()).filter((c) => c.userId === userId),
    ),
    deleteDashboardConfig: vi.fn(async (id: string) => {
      configStore.delete(id);
    }),
  };
}

// ---------------------------------------------------------------------------
// Indicator use cases
// ---------------------------------------------------------------------------
describe("createIndicatorUC", () => {
  it("crea un indicador y lo guarda en el repositorio", async () => {
    const repo = createMockRepo();
    const input = {
      name: "Consultas del mes",
      description: "Total de consultas en el mes",
      category: "consultas" as const,
      unit: "consultas",
      calculationType: "count" as const,
      refreshFrequency: "monthly" as const,
      metaValue: 100,
    };

    const result = await createIndicatorUC(repo, input);

    expect(result.name).toBe("Consultas del mes");
    expect(result.category).toBe("consultas");
    expect(result.calculationType).toBe("count");
    expect(result.metaValue).toBe(100);
    expect(result.isActive).toBe(true);
    expect(result.createdAt).toBeGreaterThan(0);
    expect(repo.saveIndicator).toHaveBeenCalledWith(result);
  });

  it("asigna isActive false si se especifica", async () => {
    const repo = createMockRepo();
    const input = {
      name: "Indicador inactivo",
      description: "",
      category: "adherencia" as const,
      unit: "%",
      calculationType: "percentage" as const,
      refreshFrequency: "weekly" as const,
      isActive: false,
    };

    const result = await createIndicatorUC(repo, input);

    expect(result.isActive).toBe(false);
  });
});

describe("updateIndicatorUC", () => {
  it("actualiza solo los campos proporcionados", async () => {
    const repo = createMockRepo();
    const existing = Indicator.create({
      id: createIndicatorId(),
      name: "Indicador original",
      description: "Descripción original",
      category: "consultas",
      unit: "",
      calculationType: "count",
      refreshFrequency: "monthly",
    });
    await repo.saveIndicator(existing);

    const result = await updateIndicatorUC(repo, existing.id, {
      name: "Indicador actualizado",
      metaValue: 200,
    });

    expect(result.name).toBe("Indicador actualizado");
    expect(result.description).toBe("Descripción original");
    expect(result.metaValue).toBe(200);
    expect(repo.saveIndicator).toHaveBeenCalled();
  });

  it("lanza error si el indicador no existe", async () => {
    const repo = createMockRepo();
    const id = createIndicatorId();

    await expect(
      updateIndicatorUC(repo, id, { name: "X" }),
    ).rejects.toThrow("no encontrado");
  });
});

describe("deleteIndicatorUC", () => {
  it("llama a repo.deleteIndicator con el id proporcionado", async () => {
    const repo = createMockRepo();
    const id = createIndicatorId();

    await deleteIndicatorUC(repo, id);

    expect(repo.deleteIndicator).toHaveBeenCalledWith(id);
  });
});

describe("listIndicatorsUC", () => {
  it("retorna todos los indicadores del repositorio", async () => {
    const repo = createMockRepo();
    const ind1 = Indicator.create({
      id: createIndicatorId(),
      name: "Ind A",
      description: "",
      category: "consultas",
      unit: "",
      calculationType: "count",
      refreshFrequency: "monthly",
    });
    const ind2 = Indicator.create({
      id: createIndicatorId(),
      name: "Ind B",
      description: "",
      category: "financiero",
      unit: "USD",
      calculationType: "avg",
      refreshFrequency: "daily",
    });
    await repo.saveIndicator(ind1);
    await repo.saveIndicator(ind2);

    const result = await listIndicatorsUC(repo);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(ind1);
    expect(result).toContainEqual(ind2);
  });
});

// ---------------------------------------------------------------------------
// IndicatorValue use cases
// ---------------------------------------------------------------------------
describe("recordIndicatorValueUC", () => {
  it("registra un valor de indicador y lo guarda", async () => {
    const repo = createMockRepo();
    const input = {
      indicatorId: indicatorIdFrom(validUUID).toString(),
      value: 85,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      dimension: "general",
      dimensionType: "month" as const,
    };

    const result = await recordIndicatorValueUC(repo, input);

    expect(result.indicatorId).toBe(validUUID);
    expect(result.value).toBe(85);
    expect(result.dimensionType).toBe("month");
    expect(result.createdAt).toBeGreaterThan(0);
    expect(repo.saveIndicatorValue).toHaveBeenCalledWith(result);
  });

  it("metadataJson usa '{}' por defecto si no se provee", async () => {
    const repo = createMockRepo();
    const input = {
      indicatorId: indicatorIdFrom(validUUID).toString(),
      value: 42,
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      dimension: "general",
      dimensionType: "month" as const,
    };

    const result = await recordIndicatorValueUC(repo, input);

    expect(result.metadataJson).toBe("{}");
  });
});

describe("getIndicatorHistoryUC", () => {
  it("retorna el historial de valores de un indicador", async () => {
    const repo = createMockRepo();
    const indicatorId = indicatorIdFrom(validUUID);
    const val1 = IndicatorValue.create({
      id: validUUID,
      indicatorId: indicatorId.toString(),
      value: 10,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      dimension: "general",
      dimensionType: "month",
    });
    const val2 = IndicatorValue.create({
      id: validUUID2,
      indicatorId: indicatorId.toString(),
      value: 20,
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      dimension: "general",
      dimensionType: "month",
    });
    await repo.saveIndicatorValue(val1);
    await repo.saveIndicatorValue(val2);

    const result = await getIndicatorHistoryUC(repo, indicatorId);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(val1);
    expect(result).toContainEqual(val2);
  });

  it("retorna arreglo vacío si no hay valores", async () => {
    const repo = createMockRepo();

    const result = await getIndicatorHistoryUC(repo, indicatorIdFrom(validUUID));

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Report use cases
// ---------------------------------------------------------------------------
describe("generateReportUC", () => {
  it("genera un reporte y lo guarda", async () => {
    const repo = createMockRepo();
    const params = {
      title: "Reporte operativo enero",
      type: "operativo" as const,
      generatedBy: "Dr. Pérez",
      contentHtml: "<p>Contenido del reporte</p>",
    };

    const result = await generateReportUC(repo, params);

    expect(result.title).toBe("Reporte operativo enero");
    expect(result.type).toBe("operativo");
    expect(result.generatedBy).toBe("Dr. Pérez");
    expect(result.contentHtml).toBe("<p>Contenido del reporte</p>");
    expect(result.status).toBe("draft");
    expect(result.generatedAt).toBeGreaterThan(0);
    expect(repo.saveReport).toHaveBeenCalledWith(result);
  });

  it("asigna parametersJson por defecto", async () => {
    const repo = createMockRepo();
    const params = {
      title: "Reporte financiero",
      type: "financiero" as const,
      generatedBy: "Sistema",
      contentHtml: "<h1>Reporte</h1>",
    };

    const result = await generateReportUC(repo, params);

    expect(result.parametersJson).toBe("{}");
  });

  it("acepta parametersJson personalizado", async () => {
    const repo = createMockRepo();
    const params = {
      title: "Reporte KPI",
      type: "kpi" as const,
      generatedBy: "Admin",
      contentHtml: "<div>KPIs</div>",
      parametersJson: '{"year":2026,"month":1}',
    };

    const result = await generateReportUC(repo, params);

    expect(result.parametersJson).toBe('{"year":2026,"month":1}');
  });
});

// ---------------------------------------------------------------------------
// DashboardConfig use cases
// ---------------------------------------------------------------------------
describe("saveDashboardConfigUC", () => {
  it("guarda una configuración de dashboard", async () => {
    const repo = createMockRepo();
    const input = {
      userId: "user-001",
      widgetType: "kpi_card" as const,
      title: "Ingresos del mes",
      position: 0,
      indicatorIdsJson: "[]",
      settingsJson: "{}",
    };

    const result = await saveDashboardConfigUC(repo, input);

    expect(result.userId).toBe("user-001");
    expect(result.widgetType).toBe("kpi_card");
    expect(result.title).toBe("Ingresos del mes");
    expect(result.position).toBe(0);
    expect(result.isVisible).toBe(true);
    expect(result.createdAt).toBeGreaterThan(0);
    expect(repo.saveDashboardConfig).toHaveBeenCalledWith(result);
  });

  it("asigna isVisible false si se especifica", async () => {
    const repo = createMockRepo();
    const input = {
      userId: "user-002",
      widgetType: "chart" as const,
      title: "Gráfico oculto",
      position: 1,
      isVisible: false,
      indicatorIdsJson: "[]",
      settingsJson: "{}",
    };

    const result = await saveDashboardConfigUC(repo, input);

    expect(result.isVisible).toBe(false);
  });
});

describe("listDashboardConfigsUC", () => {
  it("retorna configuraciones filtradas por usuario", async () => {
    const repo = createMockRepo();
    const config1 = DashboardConfig.create({
      id: validUUID,
      userId: "user-001",
      widgetType: "kpi_card",
      title: "Widget 1",
      position: 0,
      indicatorIdsJson: "[]",
      settingsJson: "{}",
    });
    const config2 = DashboardConfig.create({
      id: validUUID2,
      userId: "user-001",
      widgetType: "chart",
      title: "Widget 2",
      position: 1,
      indicatorIdsJson: "[]",
      settingsJson: "{}",
    });
    const config3 = DashboardConfig.create({
      id: validUUID3,
      userId: "user-002",
      widgetType: "table",
      title: "Widget 3",
      position: 0,
      indicatorIdsJson: "[]",
      settingsJson: "{}",
    });
    await repo.saveDashboardConfig(config1);
    await repo.saveDashboardConfig(config2);
    await repo.saveDashboardConfig(config3);

    const result = await listDashboardConfigsUC(repo, "user-001");

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(config1);
    expect(result).toContainEqual(config2);
    expect(result).not.toContainEqual(config3);
  });

  it("retorna arreglo vacío si el usuario no tiene configuraciones", async () => {
    const repo = createMockRepo();

    const result = await listDashboardConfigsUC(repo, "user-no-existe");

    expect(result).toEqual([]);
  });
});
