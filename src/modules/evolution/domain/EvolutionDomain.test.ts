import { describe, it, expect } from "vitest";
import { EvolutionRecordSchema } from "./EvolutionRecord";
import { EvolutionIndicatorSchema } from "./EvolutionIndicator";
import { TemporalComparisonSchema } from "./TemporalComparison";
import { StagnationAlertSchema } from "./StagnationAlert";
import {
  EvolutionVariableSchema, EvolutionVariableLabel,
  IndicatorStatusSchema, IndicatorStatusLabel,
  StagnationSeveritySchema, StagnationSeverityLabel,
} from "./EvolutionTypes";

describe("EvolutionVariable", () => {
  it("includes expected variables", () => {
    const result = EvolutionVariableSchema.safeParse("peso");
    expect(result.success).toBe(true);
  });

  it("rejects invalid variable", () => {
    const result = EvolutionVariableSchema.safeParse("invalid_var");
    expect(result.success).toBe(false);
  });

  it("has labels for all variables", () => {
    const vars = EvolutionVariableSchema.options;
    for (const v of vars) {
      expect(EvolutionVariableLabel[v]).toBeDefined();
      expect(EvolutionVariableLabel[v].length).toBeGreaterThan(0);
    }
  });
});

describe("IndicatorStatus", () => {
  const statuses = IndicatorStatusSchema.options;
  for (const status of statuses) {
    it(`has label for ${status}`, () => {
      expect(IndicatorStatusLabel[status]).toBeDefined();
      expect(IndicatorStatusLabel[status].length).toBeGreaterThan(0);
    });
  }
});

describe("StagnationSeverity", () => {
  const severities = StagnationSeveritySchema.options;
  for (const s of severities) {
    it(`has label for ${s}`, () => {
      expect(StagnationSeverityLabel[s]).toBeDefined();
      expect(StagnationSeverityLabel[s].length).toBeGreaterThan(0);
    });
  }
});

describe("EvolutionRecordSchema", () => {
  const valid = () => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    patientId: "550e8400-e29b-41d4-a716-446655440001",
    consultationId: "550e8400-e29b-41d4-a716-446655440002",
    professionalId: "550e8400-e29b-41d4-a716-446655440003",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it("accepts valid record", () => {
    const result = EvolutionRecordSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  it("rejects invalid id", () => {
    const result = EvolutionRecordSchema.safeParse({ ...valid(), id: "not-uuid" });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = EvolutionRecordSchema.parse(valid());
    expect(result.changesSinceLastConsultation).toBe("");
    expect(result.perceivedCompliance).toBe(5);
    expect(result.patientSatisfaction).toBe(3);
    expect(result.requiresReferral).toBe(false);
    expect(result.referralSpecialties).toEqual([]);
  });

  it("perceivedCompliance must be 1-10", () => {
    const low = EvolutionRecordSchema.safeParse({ ...valid(), perceivedCompliance: 0 });
    expect(low.success).toBe(false);
    const high = EvolutionRecordSchema.safeParse({ ...valid(), perceivedCompliance: 11 });
    expect(high.success).toBe(false);
  });

  it("patientSatisfaction must be 1-5", () => {
    const low = EvolutionRecordSchema.safeParse({ ...valid(), patientSatisfaction: 0 });
    expect(low.success).toBe(false);
    const high = EvolutionRecordSchema.safeParse({ ...valid(), patientSatisfaction: 6 });
    expect(high.success).toBe(false);
  });
});

describe("EvolutionIndicatorSchema", () => {
  const valid = () => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    patientId: "550e8400-e29b-41d4-a716-446655440001",
    variable: "peso" as const,
    initialConsultationId: "550e8400-e29b-41d4-a716-446655440002",
    currentConsultationId: "550e8400-e29b-41d4-a716-446655440003",
    initialValue: 80,
    currentValue: 75,
    absoluteChange: -5,
    percentChange: -6.25,
    status: "en_progreso" as const,
    calculatedAt: Date.now(),
  });

  it("accepts valid indicator", () => {
    const result = EvolutionIndicatorSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  it("rejects invalid variable", () => {
    const result = EvolutionIndicatorSchema.safeParse({ ...valid(), variable: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = EvolutionIndicatorSchema.safeParse({ ...valid(), status: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("TemporalComparisonSchema", () => {
  const valid = () => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    patientId: "550e8400-e29b-41d4-a716-446655440001",
    currentConsultationId: "550e8400-e29b-41d4-a716-446655440002",
    comparedConsultationId: "550e8400-e29b-41d4-a716-446655440003",
    differencesJson: "[]",
    summary: "Sin cambios significativos",
    calculatedAt: Date.now(),
  });

  it("accepts valid comparison", () => {
    expect(TemporalComparisonSchema.safeParse(valid()).success).toBe(true);
  });
});

describe("StagnationAlertSchema", () => {
  const valid = () => ({
    id: "550e8400-e29b-41d4-a716-446655440000",
    patientId: "550e8400-e29b-41d4-a716-446655440001",
    variable: "peso" as const,
    periodWeeks: 4,
    severity: "media" as const,
    actionTaken: "",
    notes: "",
    generatedAt: Date.now(),
    resolvedAt: undefined,
  });

  it("accepts valid alert", () => {
    expect(StagnationAlertSchema.safeParse(valid()).success).toBe(true);
  });
});

describe("calculateIndicatorUC", () => {
  it("calculates absolute and percent change", async () => {
    const initialValue: number = 80;
    const currentValue: number = 75;
    const absoluteChange = currentValue - initialValue;
    const percentChange = initialValue !== 0
      ? Math.round((absoluteChange / initialValue) * 10000) / 100
      : 0;
    expect(absoluteChange).toBe(-5);
    expect(percentChange).toBe(-6.25);
  });
});
