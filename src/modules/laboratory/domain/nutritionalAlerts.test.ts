import { describe, it, expect } from "vitest";
import { LabResult } from "./LabResult";
import { generateNutritionalAlerts, getBlockingAlerts, requiresImmediateReferral } from "./nutritionalAlerts";
import type { LabReferenceRange } from "./LabReferenceRange";

const baseRanges: LabReferenceRange[] = [
  { test: "GLUCOSA", sex: "all", low: 70, high: 100, criticalLow: 54, criticalHigh: null },
  { test: "LDL", sex: "all", low: null, high: 130, criticalLow: null, criticalHigh: null },
  { test: "HDL", sex: "female", low: 50, high: null, criticalLow: null, criticalHigh: null },
  { test: "HDL", sex: "male", low: 40, high: null, criticalLow: null, criticalHigh: null },
  { test: "TRIGLICERIDOS", sex: "all", low: null, high: 150, criticalLow: null, criticalHigh: null },
  { test: "CREATININA", sex: "female", low: 0.5, high: 1.1, criticalLow: null, criticalHigh: null },
  { test: "HEMOGLOBINA", sex: "female", low: 12, high: 16, criticalLow: 8, criticalHigh: null },
  { test: "HEMOGLOBINA", sex: "male", low: 13.5, high: 17.5, criticalLow: 8, criticalHigh: null },
  { test: "ALBUMINA", sex: "all", low: 3.5, high: 5.0, criticalLow: null, criticalHigh: null },
  { test: "FERRITINA", sex: "female", low: 12, high: 150, criticalLow: null, criticalHigh: null },
  { test: "VITAMINA_D", sex: "all", low: 30, high: 100, criticalLow: 12, criticalHigh: null },
];

describe("generateNutritionalAlerts", () => {
  it("no genera alertas para valores normales", () => {
    const results = [LabResult.from({ test: "GLUCOSA", value: 90 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(alerts).toHaveLength(0);
  });

  it("genera alerta warning para GLUCOSA alta", () => {
    const results = [LabResult.from({ test: "GLUCOSA", value: 150 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].flag).toBe("high");
    expect(alerts[0].severity).toBe("warning");
  });

  it("genera alerta blocking para GLUCOSA crítica", () => {
    const results = [LabResult.from({ test: "GLUCOSA", value: 50 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].flag).toBe("critical-low");
    expect(alerts[0].severity).toBe("blocking");
  });

  it("genera alerta warning para LDL alto", () => {
    const results = [LabResult.from({ test: "LDL", value: 160 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "male", 40);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].test).toBe("LDL");
    expect(alerts[0].severity).toBe("warning");
  });

  it("genera alerta warning para HDL bajo en mujer", () => {
    const results = [LabResult.from({ test: "HDL", value: 35 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].flag).toBe("low");
    expect(alerts[0].severity).toBe("warning");
  });

  it("genera alerta blocking para HEMOGLOBINA crítica", () => {
    const results = [LabResult.from({ test: "HEMOGLOBINA", value: 7 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].flag).toBe("critical-low");
    expect(alerts[0].severity).toBe("blocking");
  });

  it("genera alertas múltiples para varios tests alterados", () => {
    const results = [
      LabResult.from({ test: "GLUCOSA", value: 150 }),
      LabResult.from({ test: "LDL", value: 160 }),
      LabResult.from({ test: "HDL", value: 35 }),
    ];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(alerts).toHaveLength(3);
  });

  it("respeta rangos por sexo", () => {
    const results = [LabResult.from({ test: "HDL", value: 45 })];
    const femaleAlerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    const maleAlerts = generateNutritionalAlerts(results, baseRanges, "male", 30);
    expect(femaleAlerts).toHaveLength(1);
    expect(maleAlerts).toHaveLength(0);
  });

  it("asigna mensaje por defecto cuando no hay config nutricional", () => {
    const results = [LabResult.from({ test: "BUN", value: 30 })];
    const ranges: LabReferenceRange[] = [
      { test: "BUN", sex: "all", low: 7, high: 20, criticalLow: null, criticalHigh: null },
    ];
    const alerts = generateNutritionalAlerts(results, ranges, "female", 30);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].message).toContain("fuera de rango");
  });

  it("retorna array vacío para resultados vacíos", () => {
    const alerts = generateNutritionalAlerts([], baseRanges, "female", 30);
    expect(alerts).toHaveLength(0);
  });

  it("retorna array vacío cuando no hay rangos (no se puede evaluar)", () => {
    const results = [LabResult.from({ test: "GLUCOSA", value: 150 })];
    const alerts = generateNutritionalAlerts(results, [], "female", 30);
    expect(alerts).toHaveLength(0);
  });
});

describe("getBlockingAlerts", () => {
  it("retorna solo alertas blocking", () => {
    const results = [
      LabResult.from({ test: "GLUCOSA", value: 50 }),
      LabResult.from({ test: "LDL", value: 160 }),
    ];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    const blocking = getBlockingAlerts(alerts);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].severity).toBe("blocking");
  });

  it("retorna array vacío si no hay blocking", () => {
    const results = [LabResult.from({ test: "LDL", value: 160 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "male", 40);
    const blocking = getBlockingAlerts(alerts);
    expect(blocking).toHaveLength(0);
  });
});

describe("requiresImmediateReferral", () => {
  it("retorna true si hay alerta blocking", () => {
    const results = [LabResult.from({ test: "GLUCOSA", value: 50 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(requiresImmediateReferral(alerts)).toBe(true);
  });

  it("retorna false si no hay alerta blocking", () => {
    const results = [LabResult.from({ test: "GLUCOSA", value: 150 })];
    const alerts = generateNutritionalAlerts(results, baseRanges, "female", 30);
    expect(requiresImmediateReferral(alerts)).toBe(false);
  });

  it("retorna false para array vacío", () => {
    expect(requiresImmediateReferral([])).toBe(false);
  });
});
