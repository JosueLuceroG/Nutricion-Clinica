import { describe, expect, it } from "vitest";
import type { DashboardKpis } from "@app/hooks/useDashboardKpis";
import { evaluateCustomKpi } from "./dashboardMetricEngine";
import type { CustomKpiConfig } from "./dashboardWidgetTypes";

function createConfig(
  overrides: Partial<CustomKpiConfig> = {},
): CustomKpiConfig {
  return {
    id: "custom-kpi-1",
    name: "Métrica personalizada",
    description: "Detalle de la métrica",
    iconKey: "sparkles",
    tone: "purple",
    category: "custom",
    source: "patients",
    metric: "count",
    valueField: "patients.active",
    filters: [],
    comparison: "none",
    visualization: "largeNumber",
    format: "number",
    size: "small",
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    ...overrides,
  };
}

function createData(overrides: Partial<DashboardKpis> = {}): DashboardKpis {
  return {
    totalActivePatients: 0,
    totalPatients: 0,
    newPatientsThisMonth: 0,
    newPatientsPreviousMonth: 0,
    activePlans: 0,
    consultationsToday: 0,
    scheduledConsultationsToday: 0,
    consultationsThisMonth: 0,
    upcomingConsultations: [],
    upcomingAppointments: [],
    appointmentsToday: [],
    unconfirmedAppointments: [],
    patientNamesById: {},
    expiringPlans: [],
    recentPatients: [],
    pendingSync: 0,
    pendingPayments: 0,
    pendingPaymentsAmount: 0,
    pendingPaymentsThisMonth: 0,
    pendingPaymentsAmountThisMonth: 0,
    incomeThisMonth: 0,
    incomePreviousMonth: 0,
    incomeActivity: [],
    paymentsThisMonth: 0,
    recentPayments: [],
    weeklyActivity: [],
    monthlyActivity: [],
    ...overrides,
  };
}

describe("evaluateCustomKpi", () => {
  it("cuenta el valor de la fuente seleccionada", () => {
    const result = evaluateCustomKpi(
      createConfig(),
      createData({ totalActivePatients: 37 }),
    );

    expect(result).toEqual({
      value: 37,
      formattedValue: "37",
      hint: "Detalle de la métrica",
    });
  });

  it("formatea importes como moneda MXN", () => {
    const result = evaluateCustomKpi(
      createConfig({
        source: "payments",
        metric: "sum",
        valueField: "payments.incomeThisMonth",
        format: "currency",
      }),
      createData({ incomeThisMonth: 12_345.5 }),
    );

    expect(result.value).toBe(12_345.5);
    expect(result.formattedValue).toBe("$12,345.50");
  });

  it("calcula y formatea porcentajes respecto al total de la fuente", () => {
    const result = evaluateCustomKpi(
      createConfig({ metric: "percentage", format: "currency" }),
      createData({ totalActivePatients: 25, totalPatients: 40 }),
    );

    expect(result.value).toBe(62.5);
    expect(result.formattedValue).toBe("62.5%");
  });

  it("compara contra el periodo anterior cuando la fuente lo permite", () => {
    const result = evaluateCustomKpi(
      createConfig({
        source: "payments",
        metric: "sum",
        valueField: "payments.incomeThisMonth",
        format: "currency",
        comparison: "previousPeriod",
      }),
      createData({ incomeThisMonth: 1_500, incomePreviousMonth: 1_000 }),
    );
    expect(result.trend).toBe("↑ 50%");
    expect(result.trendTone).toBe("up");
  });

  it("rechaza indicadores que no pertenecen a la fuente declarada", () => {
    const result = evaluateCustomKpi(
      createConfig({
        source: "system",
        metric: "sum",
        valueField: "payments.incomeThisMonth",
        format: "currency",
      }),
      createData({ incomeThisMonth: 15_000 }),
    );

    expect(result.formattedValue).toBe("--");
    expect(result.hint).toBe("Configuración no válida");
  });

  it("calcula porcentajes únicamente con el denominador compatible", () => {
    const result = evaluateCustomKpi(
      createConfig({
        source: "plans",
        metric: "percentage",
        valueField: "plans.expiring",
        format: "percentage",
      }),
      createData({ activePlans: 8, expiringPlans: [{}, {}] as DashboardKpis["expiringPlans"] }),
    );

    expect(result.value).toBe(25);
    expect(result.formattedValue).toBe("25%");
  });

  it("aplica formato avanzado sin alterar el valor calculado", () => {
    const result = evaluateCustomKpi(
      createConfig({
        source: "payments",
        metric: "sum",
        valueField: "payments.incomeThisMonth",
        format: "currency",
        precision: 0,
        notation: "compact",
        prefix: "≈",
        suffix: " MXN",
      }),
      createData({ incomeThisMonth: 12_450 }),
    );

    expect(result.value).toBe(12_450);
    expect(result.formattedValue).toMatch(/^≈.*12.*MXN$/);
  });

  it("invierte el tono cuando una disminución representa una mejora", () => {
    const result = evaluateCustomKpi(
      createConfig({
        source: "payments",
        metric: "sum",
        valueField: "payments.incomeThisMonth",
        format: "currency",
        comparison: "previousPeriod",
        trendDirection: "decreaseIsPositive",
      }),
      createData({ incomeThisMonth: 800, incomePreviousMonth: 1_000 }),
    );

    expect(result.trend).toBe("↓ 20%");
    expect(result.trendTone).toBe("up");
  });
});
