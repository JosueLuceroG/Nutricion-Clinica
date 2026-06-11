import { describe, it, expect } from "vitest";
import {
  Indicator,
  IndicatorSchema,
  IndicatorCategorySchema,
  IndicatorCalculationTypeSchema,
  IndicatorRefreshFrequencySchema,
  type IndicatorProps,
} from "./Indicator";
import {
  indicatorIdFrom,
  createIndicatorId,
  IndicatorIdSchema,
} from "./IndicatorId";
import {
  IndicatorValue,
  IndicatorValueSchema,
  DimensionTypeSchema,
  type IndicatorValueProps,
} from "./IndicatorValue";
import {
  GeneratedReport,
  GeneratedReportSchema,
  ReportTypeSchema,
  ReportStatusSchema,
  type GeneratedReportProps,
} from "./GeneratedReport";
import {
  DashboardConfig,
  DashboardConfigSchema,
  WidgetTypeSchema,
  type DashboardConfigProps,
} from "./DashboardConfig";
import {
  IndicatorNotFoundError,
  ReportNotFoundError,
} from "./ReportsRepository";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUUID2 = "660e8400-e29b-41d4-a716-446655440001";
const now = Date.now();

// ---------------------------------------------------------------------------
// IndicatorId
// ---------------------------------------------------------------------------
describe("IndicatorId", () => {
  it("createIndicatorId genera un UUID válido", () => {
    const id = createIndicatorId();
    expect(IndicatorIdSchema.safeParse(id).success).toBe(true);
  });

  it("indicatorIdFrom acepta un UUID válido", () => {
    const id = indicatorIdFrom(validUUID);
    expect(id).toBe(validUUID);
  });

  it("indicatorIdFrom rechaza un string no UUID", () => {
    expect(() => indicatorIdFrom("no-es-uuid")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Indicator
// ---------------------------------------------------------------------------
const baseIndicator = {
  id: indicatorIdFrom(validUUID),
  name: "Consultas del mes",
  description: "Total de consultas realizadas en el mes actual",
  category: "consultas" as const,
  unit: "consultas",
  calculationType: "count" as const,
  refreshFrequency: "monthly" as const,
  metaValue: 100,
};

function createIndicator(
  overrides: Partial<IndicatorProps> = {},
): Indicator {
  return Indicator.create({ ...baseIndicator, ...overrides });
}

describe("Indicator.create", () => {
  it("crea indicador con datos válidos", () => {
    const ind = Indicator.create(baseIndicator);
    expect(ind.name).toBe("Consultas del mes");
    expect(ind.description).toBe("Total de consultas realizadas en el mes actual");
    expect(ind.category).toBe("consultas");
    expect(ind.unit).toBe("consultas");
    expect(ind.calculationType).toBe("count");
    expect(ind.refreshFrequency).toBe("monthly");
    expect(ind.metaValue).toBe(100);
    expect(ind.isActive).toBe(true);
    expect(ind.createdAt).toBeGreaterThan(0);
    expect(ind.updatedAt).toBeGreaterThan(0);
  });

  it("asigna isActive true por defecto", () => {
    const ind = Indicator.create(baseIndicator);
    expect(ind.isActive).toBe(true);
  });

  it("acepta isActive false explícitamente", () => {
    const ind = Indicator.create({ ...baseIndicator, isActive: false });
    expect(ind.isActive).toBe(false);
  });

  it("asigna description vacía por defecto si no se provee", () => {
    const ind = Indicator.create({ ...baseIndicator, description: "" });
    expect(ind.description).toBe("");
  });

  it("asigna unit vacía por defecto si no se provee", () => {
    const ind = Indicator.create({ ...baseIndicator, unit: "" });
    expect(ind.unit).toBe("");
  });
});

describe("Indicator.reconstitute", () => {
  it("reconstituye indicador existente sin modificar props", () => {
    const props: IndicatorProps = {
      id: indicatorIdFrom(validUUID),
      name: "Tasa de adherencia",
      description: "Porcentaje de pacientes que cumplen el tratamiento",
      category: "adherencia",
      unit: "%",
      calculationType: "percentage",
      formula: "(cumplidores / total) * 100",
      refreshFrequency: "weekly",
      metaValue: 80,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const ind = Indicator.reconstitute(props);
    expect(ind.name).toBe("Tasa de adherencia");
    expect(ind.category).toBe("adherencia");
    expect(ind.calculationType).toBe("percentage");
    expect(ind.formula).toBe("(cumplidores / total) * 100");
    expect(ind.metaValue).toBe(80);
    expect(ind.createdAt).toBe(now);
  });
});

describe("Indicator.toProps", () => {
  it("retorna copia de las propiedades", () => {
    const ind = createIndicator();
    const props = ind.toProps();
    expect(props.name).toBe("Consultas del mes");
    expect(props.category).toBe("consultas");
  });
});

describe("Indicator.with", () => {
  it("retorna nueva instancia sin mutar la original", () => {
    const original = createIndicator();
    const updated = original.with({ name: "Nuevo nombre" });
    expect(original.name).toBe("Consultas del mes");
    expect(updated.name).toBe("Nuevo nombre");
    expect(updated.id).toBe(original.id);
  });

  it("actualiza updatedAt", () => {
    const original = createIndicator();
    const updated = original.with({ metaValue: 200 });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt);
  });
});

describe("Indicator schema validation", () => {
  it("validaci\u00f3n pasa con datos correctos", () => {
    const props: IndicatorProps = {
      id: indicatorIdFrom(validUUID),
      name: "Ingresos mensuales",
      description: "Ingresos totales del mes",
      category: "financiero",
      unit: "USD",
      calculationType: "formula",
      formula: "SUM(ingresos)",
      refreshFrequency: "monthly",
      metaValue: 50000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    expect(IndicatorSchema.safeParse(props).success).toBe(true);
  });

  it("rechaza name vacío", () => {
    const props = { ...baseIndicator, name: "" };
    expect(IndicatorSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza name mayor a 200 caracteres", () => {
    const props = { ...baseIndicator, name: "x".repeat(201) };
    expect(IndicatorSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza category inválida", () => {
    const props = { ...baseIndicator, category: "otra" };
    expect(IndicatorSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza calculationType inválido", () => {
    const props = { ...baseIndicator, calculationType: "suma" };
    expect(IndicatorSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza refreshFrequency inválido", () => {
    const props = { ...baseIndicator, refreshFrequency: "yearly" };
    expect(IndicatorSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza createdAt no positivo", () => {
    const props = { ...baseIndicator, createdAt: 0 };
    expect(IndicatorSchema.safeParse(props).success).toBe(false);
  });
});

describe("Indicator enums exhaustiveness", () => {
  it("IndicatorCategory acepta todos los valores", () => {
    const categories = ["consultas", "adherencia", "patologias", "financiero"] as const;
    for (const c of categories) {
      expect(IndicatorCategorySchema.safeParse(c).success).toBe(true);
    }
  });

  it("IndicatorCalculationType acepta todos los valores", () => {
    const types = ["count", "avg", "percentage", "ratio", "formula"] as const;
    for (const t of types) {
      expect(IndicatorCalculationTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it("IndicatorRefreshFrequency acepta todos los valores", () => {
    const freqs = ["daily", "weekly", "monthly"] as const;
    for (const f of freqs) {
      expect(IndicatorRefreshFrequencySchema.safeParse(f).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// IndicatorValue
// ---------------------------------------------------------------------------
const baseIndicatorValue = {
  id: validUUID,
  indicatorId: indicatorIdFrom(validUUID2).toString(),
  value: 42,
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  dimension: "general",
  dimensionType: "month" as const,
};

describe("IndicatorValue.create", () => {
  it("crea valor de indicador con datos válidos", () => {
    const val = IndicatorValue.create({
      ...baseIndicatorValue,
      metadataJson: "{}",
    });
    expect(val.indicatorId).toBe(validUUID2);
    expect(val.value).toBe(42);
    expect(val.periodStart).toBe("2026-01-01");
    expect(val.periodEnd).toBe("2026-01-31");
    expect(val.dimension).toBe("general");
    expect(val.dimensionType).toBe("month");
    expect(val.metadataJson).toBe("{}");
    expect(val.createdAt).toBeGreaterThan(0);
  });

  it("metadataJson usa '{}' por defecto si no se provee en create", () => {
    const val = IndicatorValue.create(baseIndicatorValue);
    expect(val.metadataJson).toBe("{}");
  });
});

describe("IndicatorValue.reconstitute", () => {
  it("reconstituye valor existente", () => {
    const props: IndicatorValueProps = {
      id: validUUID2,
      indicatorId: indicatorIdFrom(validUUID),
      value: 85,
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      dimension: "por-sexo",
      dimensionType: "month",
      metadataJson: '{"gender":"female"}',
      createdAt: now,
    };
    const val = IndicatorValue.reconstitute(props);
    expect(val.value).toBe(85);
    expect(val.dimension).toBe("por-sexo");
    expect(val.metadataJson).toBe('{"gender":"female"}');
    expect(val.createdAt).toBe(now);
  });
});

describe("IndicatorValue.toProps", () => {
  it("retorna copia de propiedades", () => {
    const val = IndicatorValue.create(baseIndicatorValue);
    const props = val.toProps();
    expect(props.value).toBe(42);
    expect(props.dimensionType).toBe("month");
  });
});

describe("IndicatorValue schema validation", () => {
  it("validaci\u00f3n pasa con datos correctos", () => {
    const props: IndicatorValueProps = {
      id: validUUID,
      indicatorId: indicatorIdFrom(validUUID2),
      value: 100,
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      dimension: "general",
      dimensionType: "month",
      metadataJson: "{}",
      createdAt: now,
    };
    expect(IndicatorValueSchema.safeParse(props).success).toBe(true);
  });

  it("rechaza dimensionType inválido", () => {
    const props = { ...baseIndicatorValue, dimensionType: "decada" };
    expect(IndicatorValueSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza id no UUID", () => {
    const props = { ...baseIndicatorValue, id: "no-uuid" };
    expect(IndicatorValueSchema.safeParse(props).success).toBe(false);
  });

  it("acepta cualquier valor numérico (incluyendo negativos)", () => {
    const props = { ...baseIndicatorValue, value: -5, createdAt: now };
    expect(IndicatorValueSchema.safeParse(props).success).toBe(true);
  });

  it("acepta valor cero", () => {
    const props = { ...baseIndicatorValue, value: 0, createdAt: now };
    expect(IndicatorValueSchema.safeParse(props).success).toBe(true);
  });
});

describe("DimensionType enums", () => {
  it("DimensionTypeSchema acepta todos los valores", () => {
    const dims = ["day", "week", "month", "quarter", "year"] as const;
    for (const d of dims) {
      expect(DimensionTypeSchema.safeParse(d).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// GeneratedReport
// ---------------------------------------------------------------------------
const baseReport = {
  id: validUUID,
  title: "Reporte operativo mensual",
  type: "operativo" as const,
  parametersJson: "{}",
  contentHtml: "<p>Contenido del reporte</p>",
  generatedBy: "Dr. Pérez",
};

describe("GeneratedReport.create", () => {
  it("crea reporte con datos válidos", () => {
    const rep = GeneratedReport.create({
      ...baseReport,
      parametersJson: "{}",
    });
    expect(rep.title).toBe("Reporte operativo mensual");
    expect(rep.type).toBe("operativo");
    expect(rep.contentHtml).toBe("<p>Contenido del reporte</p>");
    expect(rep.generatedBy).toBe("Dr. Pérez");
    expect(rep.parametersJson).toBe("{}");
    expect(rep.status).toBe("draft");
    expect(rep.generatedAt).toBeGreaterThan(0);
  });

  it("asigna status 'draft' por defecto", () => {
    const rep = GeneratedReport.create(baseReport);
    expect(rep.status).toBe("draft");
  });

  it("acepta status personalizado", () => {
    const rep = GeneratedReport.create({ ...baseReport, status: "final" });
    expect(rep.status).toBe("final");
  });

  it("parametersJson tiene default {} si no se provee en create", () => {
    const rep = GeneratedReport.create(baseReport);
    expect(rep.parametersJson).toBe("{}");
  });
});

describe("GeneratedReport.reconstitute", () => {
  it("reconstituye reporte existente", () => {
    const props: GeneratedReportProps = {
      id: validUUID,
      title: "Reporte financiero Q1",
      type: "financiero",
      parametersJson: '{"year":2026,"quarter":1}',
      contentHtml: "<h1>Reporte</h1>",
      generatedAt: now,
      generatedBy: "Sistema",
      status: "final",
    };
    const rep = GeneratedReport.reconstitute(props);
    expect(rep.title).toBe("Reporte financiero Q1");
    expect(rep.type).toBe("financiero");
    expect(rep.status).toBe("final");
    expect(rep.generatedAt).toBe(now);
  });
});

describe("GeneratedReport.toProps", () => {
  it("retorna copia de propiedades", () => {
    const rep = GeneratedReport.create(baseReport);
    const props = rep.toProps();
    expect(props.title).toBe("Reporte operativo mensual");
    expect(props.type).toBe("operativo");
  });
});

describe("GeneratedReport.finalize", () => {
  it("cambia estado a final", () => {
    const rep = GeneratedReport.create(baseReport);
    const finalized = rep.finalize();
    expect(finalized.status).toBe("final");
  });
});

describe("GeneratedReport.archive", () => {
  it("cambia estado a archived", () => {
    const rep = GeneratedReport.create(baseReport);
    const archived = rep.archive();
    expect(archived.status).toBe("archived");
  });
});

describe("GeneratedReport schema validation", () => {
  it("validaci\u00f3n pasa con datos correctos", () => {
    const props: GeneratedReportProps = {
      id: validUUID,
      title: "Reporte regulatorio",
      type: "regulatorio",
      parametersJson: "{}",
      contentHtml: "<p>Contenido</p>",
      generatedAt: now,
      generatedBy: "Admin",
      status: "draft",
    };
    expect(GeneratedReportSchema.safeParse(props).success).toBe(true);
  });

  it("rechaza title vacío", () => {
    const props = { ...baseReport, title: "" };
    expect(GeneratedReportSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza type inválido", () => {
    const props = { ...baseReport, type: "otro" };
    expect(GeneratedReportSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza status inválido", () => {
    const props = { ...baseReport, status: "deleted" };
    expect(GeneratedReportSchema.safeParse(props).success).toBe(false);
  });
});

describe("ReportType enum", () => {
  it("ReportTypeSchema acepta todos los valores", () => {
    const types = ["operativo", "financiero", "regulatorio", "kpi"] as const;
    for (const t of types) {
      expect(ReportTypeSchema.safeParse(t).success).toBe(true);
    }
  });
});

describe("ReportStatus enum", () => {
  it("ReportStatusSchema acepta todos los valores", () => {
    const statuses = ["draft", "final", "archived"] as const;
    for (const s of statuses) {
      expect(ReportStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// DashboardConfig
// ---------------------------------------------------------------------------
const baseDashboardConfig = {
  id: validUUID,
  userId: "user-001",
  widgetType: "kpi_card" as const,
  title: "Ingresos mensuales",
  position: 0,
  indicatorIdsJson: "[]",
  settingsJson: "{}",
};

describe("DashboardConfig.create", () => {
  it("crea configuración de dashboard con datos válidos", () => {
    const config = DashboardConfig.create({
      ...baseDashboardConfig,
      indicatorIdsJson: "[]",
      settingsJson: "{}",
    });
    expect(config.userId).toBe("user-001");
    expect(config.widgetType).toBe("kpi_card");
    expect(config.title).toBe("Ingresos mensuales");
    expect(config.position).toBe(0);
    expect(config.indicatorIdsJson).toBe("[]");
    expect(config.settingsJson).toBe("{}");
    expect(config.isVisible).toBe(true);
    expect(config.createdAt).toBeGreaterThan(0);
    expect(config.updatedAt).toBeGreaterThan(0);
  });

  it("asigna isVisible true por defecto", () => {
    const config = DashboardConfig.create(baseDashboardConfig);
    expect(config.isVisible).toBe(true);
  });

  it("acepta isVisible false explícitamente", () => {
    const config = DashboardConfig.create({ ...baseDashboardConfig, isVisible: false });
    expect(config.isVisible).toBe(false);
  });
});

describe("DashboardConfig.reconstitute", () => {
  it("reconstituye configuración existente", () => {
    const props: DashboardConfigProps = {
      id: validUUID,
      userId: "user-002",
      widgetType: "chart",
      title: "Evolución de peso",
      indicatorIdsJson: '["id1","id2"]',
      position: 1,
      settingsJson: '{"chartType":"line"}',
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    };
    const config = DashboardConfig.reconstitute(props);
    expect(config.widgetType).toBe("chart");
    expect(config.title).toBe("Evolución de peso");
    expect(config.position).toBe(1);
    expect(config.indicatorIdsJson).toBe('["id1","id2"]');
    expect(config.settingsJson).toBe('{"chartType":"line"}');
    expect(config.createdAt).toBe(now);
  });
});

describe("DashboardConfig.toProps", () => {
  it("retorna copia de propiedades", () => {
    const config = DashboardConfig.create(baseDashboardConfig);
    const props = config.toProps();
    expect(props.title).toBe("Ingresos mensuales");
    expect(props.widgetType).toBe("kpi_card");
  });
});

describe("DashboardConfig schema validation", () => {
  it("validaci\u00f3n pasa con datos correctos", () => {
    const props: DashboardConfigProps = {
      id: validUUID,
      userId: "user-003",
      widgetType: "table",
      title: "Lista de pacientes",
      indicatorIdsJson: "[]",
      position: 2,
      settingsJson: '{"pageSize":10}',
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    };
    expect(DashboardConfigSchema.safeParse(props).success).toBe(true);
  });

  it("rechaza widgetType inválido", () => {
    const props = { ...baseDashboardConfig, widgetType: "grafico" };
    expect(DashboardConfigSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza title vacío", () => {
    const props = { ...baseDashboardConfig, title: "" };
    expect(DashboardConfigSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza position negativo", () => {
    const props = { ...baseDashboardConfig, position: -1 };
    expect(DashboardConfigSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza createdAt no positivo", () => {
    const props = { ...baseDashboardConfig, createdAt: 0 };
    expect(DashboardConfigSchema.safeParse(props).success).toBe(false);
  });
});

describe("WidgetType enum", () => {
  it("WidgetTypeSchema acepta todos los valores", () => {
    const types = ["kpi_card", "chart", "table", "list"] as const;
    for (const t of types) {
      expect(WidgetTypeSchema.safeParse(t).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ReportsRepository - Error classes
// ---------------------------------------------------------------------------
describe("ReportsRepository errors", () => {
  it("IndicatorNotFoundError tiene nombre y mensaje correctos", () => {
    const id = indicatorIdFrom(validUUID);
    const err = new IndicatorNotFoundError(id);
    expect(err.name).toBe("IndicatorNotFoundError");
    expect(err.message).toContain("Indicador no encontrado");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("ReportNotFoundError tiene nombre y mensaje correctos", () => {
    const id = validUUID;
    const err = new ReportNotFoundError(id);
    expect(err.name).toBe("ReportNotFoundError");
    expect(err.message).toContain("Reporte no encontrado");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("IndicatorNotFoundError es instancia de Error", () => {
    const err = new IndicatorNotFoundError(indicatorIdFrom(validUUID));
    expect(err).toBeInstanceOf(Error);
  });

  it("ReportNotFoundError es instancia de Error", () => {
    const err = new ReportNotFoundError(validUUID);
    expect(err).toBeInstanceOf(Error);
  });
});
