import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieEvolutionRepository } from "./DexieEvolutionRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { EvolutionRecordProps } from "../domain/EvolutionRecord";
import type { EvolutionIndicatorProps } from "../domain/EvolutionIndicator";
import type { TemporalComparisonProps } from "../domain/TemporalComparison";
import type { StagnationAlertProps } from "../domain/StagnationAlert";

const makeRecordProps = (overrides: Partial<EvolutionRecordProps> = {}): EvolutionRecordProps => ({
  id: crypto.randomUUID(),
  patientId: crypto.randomUUID(),
  consultationId: crypto.randomUUID(),
  professionalId: crypto.randomUUID(),
  changesSinceLastConsultation: "",
  intercurrentEvents: "",
  perceivedCompliance: 5,
  barriersIdentified: "",
  facilitatorsIdentified: "",
  patientSatisfaction: 3,
  nextConsultationPlan: "",
  requiresReferral: false,
  referralSpecialties: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const makeIndicatorProps = (overrides: Partial<EvolutionIndicatorProps> = {}): EvolutionIndicatorProps => ({
  id: crypto.randomUUID(),
  patientId: crypto.randomUUID(),
  variable: "peso",
  initialConsultationId: crypto.randomUUID(),
  currentConsultationId: crypto.randomUUID(),
  initialValue: 80,
  currentValue: 75,
  absoluteChange: -5,
  percentChange: -6.25,
  status: "en_progreso",
  calculatedAt: Date.now(),
  ...overrides,
});

const makeComparisonProps = (overrides: Partial<TemporalComparisonProps> = {}): TemporalComparisonProps => ({
  id: crypto.randomUUID(),
  patientId: crypto.randomUUID(),
  currentConsultationId: crypto.randomUUID(),
  comparedConsultationId: crypto.randomUUID(),
  differencesJson: "{}",
  summary: "",
  calculatedAt: Date.now(),
  ...overrides,
});

const makeAlertProps = (overrides: Partial<StagnationAlertProps> = {}): StagnationAlertProps => ({
  id: crypto.randomUUID(),
  patientId: crypto.randomUUID(),
  variable: "peso",
  periodWeeks: 4,
  severity: "media",
  generatedAt: Date.now(),
  actionTaken: "",
  notes: "",
  ...overrides,
});

describe("DexieEvolutionRepository", () => {
  let repo: DexieEvolutionRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieEvolutionRepository(db);
  });

  describe("EvolutionRecord", () => {
    it("createRecord guarda y retorna un registro de evolución", async () => {
      const record = await repo.createRecord(makeRecordProps({ changesSinceLastConsultation: "Mejoría notable" }));
      expect(record.id).toBeTruthy();
      expect(record.changesSinceLastConsultation).toBe("Mejoría notable");
    });

    it("findRecordById retorna el registro por su id", async () => {
      const created = await repo.createRecord(makeRecordProps());
      const found = await repo.findRecordById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("findRecordById retorna null si no existe", async () => {
      const found = await repo.findRecordById(crypto.randomUUID());
      expect(found).toBeNull();
    });

    it("updateRecord modifica campos del registro", async () => {
      const created = await repo.createRecord(makeRecordProps());
      const updated = await repo.updateRecord(created.id, { changesSinceLastConsultation: "Sin cambios" });
      expect(updated.changesSinceLastConsultation).toBe("Sin cambios");
    });

    it("updateRecord lanza error si el registro no existe", async () => {
      await expect(repo.updateRecord(crypto.randomUUID(), { changesSinceLastConsultation: "test" })).rejects.toThrow("EvolutionRecord no encontrado");
    });

    it("findRecordsByPatient retorna registros del paciente", async () => {
      const patientId = crypto.randomUUID();
      const r1 = await repo.createRecord(makeRecordProps({ patientId }));
      const r2 = await repo.createRecord(makeRecordProps({ patientId }));
      await repo.createRecord(makeRecordProps());

      const results = await repo.findRecordsByPatient(patientId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain(r1.id);
      expect(results.map((r) => r.id)).toContain(r2.id);
    });

    it("findRecordsByConsultation retorna el registro de una consulta", async () => {
      const consultationId = crypto.randomUUID();
      const created = await repo.createRecord(makeRecordProps({ consultationId }));
      const found = await repo.findRecordsByConsultation(consultationId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("findRecordsByConsultation retorna null si no hay registro", async () => {
      const found = await repo.findRecordsByConsultation(crypto.randomUUID());
      expect(found).toBeNull();
    });
  });

  describe("EvolutionIndicator", () => {
    it("createIndicator guarda y retorna un indicador", async () => {
      const indicator = await repo.createIndicator(makeIndicatorProps({ variable: "imc", currentValue: 22 }));
      expect(indicator.variable).toBe("imc");
      expect(indicator.props.currentValue).toBe(22);
    });

    it("findIndicatorsByPatient retorna indicadores del paciente", async () => {
      const patientId = crypto.randomUUID();
      const i1 = await repo.createIndicator(makeIndicatorProps({ patientId }));
      const i2 = await repo.createIndicator(makeIndicatorProps({ patientId }));
      await repo.createIndicator(makeIndicatorProps());

      const results = await repo.findIndicatorsByPatient(patientId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain(i1.id);
      expect(results.map((r) => r.id)).toContain(i2.id);
    });

    it.skip("findIndicatorsByConsultation retorna indicadores de una consulta", async () => {
      const consultationId = crypto.randomUUID();
      const i1 = await repo.createIndicator(makeIndicatorProps({ currentConsultationId: consultationId }));
      const i2 = await repo.createIndicator(makeIndicatorProps({ currentConsultationId: consultationId }));
      await repo.createIndicator(makeIndicatorProps());

      const results = await repo.findIndicatorsByConsultation(consultationId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain(i1.id);
      expect(results.map((r) => r.id)).toContain(i2.id);
    });

    it("findLatestIndicator retorna el indicador más reciente de una variable", async () => {
      const patientId = crypto.randomUUID();
      await repo.createIndicator(makeIndicatorProps({ patientId, variable: "peso", calculatedAt: 1000 }));
      const latest = await repo.createIndicator(makeIndicatorProps({ patientId, variable: "peso", calculatedAt: 2000 }));

      const found = await repo.findLatestIndicator(patientId, "peso");
      expect(found).not.toBeNull();
      expect(found?.id).toBe(latest.id);
    });

    it("findLatestIndicator retorna null si no hay indicadores", async () => {
      const found = await repo.findLatestIndicator(crypto.randomUUID(), "peso");
      expect(found).toBeNull();
    });
  });

  describe("TemporalComparison", () => {
    it("createComparison guarda y retorna una comparación", async () => {
      const comparison = await repo.createComparison(makeComparisonProps({ summary: "Mejoría significativa" }));
      expect(comparison.summary).toBe("Mejoría significativa");
    });

    it("findComparisonsByPatient retorna comparaciones del paciente", async () => {
      const patientId = crypto.randomUUID();
      const c1 = await repo.createComparison(makeComparisonProps({ patientId }));
      const c2 = await repo.createComparison(makeComparisonProps({ patientId }));
      await repo.createComparison(makeComparisonProps());

      const results = await repo.findComparisonsByPatient(patientId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain(c1.id);
      expect(results.map((r) => r.id)).toContain(c2.id);
    });

    it("findComparisonBetween encuentra comparación entre dos consultas", async () => {
      const consultA = crypto.randomUUID();
      const consultB = crypto.randomUUID();
      await repo.createComparison(makeComparisonProps({ currentConsultationId: consultA, comparedConsultationId: consultB }));

      const found = await repo.findComparisonBetween(consultA, consultB);
      expect(found).not.toBeNull();
    });

    it("findComparisonBetween retorna null si no existe", async () => {
      const found = await repo.findComparisonBetween(crypto.randomUUID(), crypto.randomUUID());
      expect(found).toBeNull();
    });
  });

  describe("StagnationAlert", () => {
    it("createStagnationAlert guarda y retorna una alerta", async () => {
      const alert = await repo.createStagnationAlert(makeAlertProps({ severity: "alta" }));
      expect(alert.severity).toBe("alta");
    });

    it("findActiveAlertsByPatient retorna alertas no resueltas", async () => {
      const patientId = crypto.randomUUID();
      const a1 = await repo.createStagnationAlert(makeAlertProps({ patientId }));
      const a2 = await repo.createStagnationAlert(makeAlertProps({ patientId }));
      await repo.createStagnationAlert(makeAlertProps({ patientId, resolvedAt: Date.now() }));

      const active = await repo.findActiveAlertsByPatient(patientId);
      expect(active).toHaveLength(2);
      expect(active.map((a) => a.id)).toContain(a1.id);
      expect(active.map((a) => a.id)).toContain(a2.id);
    });

    it("resolveAlert marca la alerta como resuelta", async () => {
      const alert = await repo.createStagnationAlert(makeAlertProps());
      expect(alert.props.resolvedAt).toBeUndefined();

      await repo.resolveAlert(alert.id);

      const updated = await repo.findActiveAlertsByPatient(alert.props.patientId);
      expect(updated).toHaveLength(0);
    });

    it("updateStagnationAlert modifica campos de la alerta", async () => {
      const alert = await repo.createStagnationAlert(makeAlertProps({ actionTaken: "" }));
      const updated = await repo.updateStagnationAlert(alert.id, { actionTaken: "Derivado a nutrición" });
      expect(updated.props.actionTaken).toBe("Derivado a nutrición");
    });

    it("updateStagnationAlert lanza error si la alerta no existe", async () => {
      await expect(repo.updateStagnationAlert(crypto.randomUUID(), { actionTaken: "test" })).rejects.toThrow("StagnationAlert no encontrado");
    });
  });
});
