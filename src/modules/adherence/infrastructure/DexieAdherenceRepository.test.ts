import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieAdherenceRepository } from "./DexieAdherenceRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { AdherenceRecord } from "../domain/AdherenceRecord";
import { AdherenceIndex } from "../domain/AdherenceIndex";
import { BarrierEvent } from "../domain/BarrierEvent";
import { createAdherenceId } from "../domain/AdherenceId";

describe("DexieAdherenceRepository", () => {
  let repo: DexieAdherenceRepository;
  let db: NutriClinicaDB;
  const patientId = crypto.randomUUID();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieAdherenceRepository(db);
  });

  it("guarda y recupera un AdherenceRecord por id", async () => {
    const record = AdherenceRecord.create({
      id: createAdherenceId(),
      patientId,
      date: "2025-01-15",
      source: "consulta",
      adherenceMenu: 80,
      adherenceWater: 70,
      adherenceActivity: 90,
      adherenceSupplements: 60,
      adherenceSleep: 75,
      notes: "",
      intercurrentEvents: "",
      barriers: "",
      facilitators: "",
      mealsLogged: "",
    });
    await repo.saveRecord(record);

    const found = await repo.findRecordById(record.id);
    expect(found).not.toBeNull();
    expect(found?.source).toBe("consulta");
    expect(found?.adherenceMenu).toBe(80);
    expect(found?.adherenceWater).toBe(70);
  });

  it("retorna null cuando el record no existe", async () => {
    const found = await repo.findRecordById(createAdherenceId());
    expect(found).toBeNull();
  });

  it("findRecordsByPatientAndRange filtra por paciente y rango de fechas", async () => {
    const r1 = AdherenceRecord.create({
      id: createAdherenceId(), patientId, date: "2025-01-10", source: "app",
      adherenceMenu: 50, adherenceWater: 50, adherenceActivity: 50, adherenceSupplements: 50, adherenceSleep: 50,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    const r2 = AdherenceRecord.create({
      id: createAdherenceId(), patientId, date: "2025-01-20", source: "app",
      adherenceMenu: 60, adherenceWater: 60, adherenceActivity: 60, adherenceSupplements: 60, adherenceSleep: 60,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    const r3 = AdherenceRecord.create({
      id: createAdherenceId(), patientId, date: "2025-02-01", source: "app",
      adherenceMenu: 70, adherenceWater: 70, adherenceActivity: 70, adherenceSupplements: 70, adherenceSleep: 70,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    await repo.saveRecord(r1);
    await repo.saveRecord(r2);
    await repo.saveRecord(r3);

    const results = await repo.findRecordsByPatientAndRange(patientId, "2025-01-01", "2025-01-31");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.date).sort()).toEqual(["2025-01-10", "2025-01-20"]);
  });

  it("guarda y recupera un AdherenceIndex por paciente", async () => {
    const index = AdherenceIndex.create({
      patientId,
      periodStart: "2025-01-01",
      periodEnd: "2025-01-31",
      scoreMenu: 80,
      scoreWater: 70,
      scoreActivity: 90,
      scoreSupplements: 60,
      scoreSleep: 75,
      scoreGlobal: 76,
      tendency: "estable",
    });
    await repo.saveIndex(index);

    const indexes = await repo.findIndexesByPatient(patientId);
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.scoreGlobal).toBe(76);
    expect(indexes[0]?.tendency).toBe("estable");
  });

  it("findIndexesByPatient retorna vacío si no hay índices", async () => {
    const indexes = await repo.findIndexesByPatient(patientId);
    expect(indexes).toHaveLength(0);
  });

  it("elimina un AdherenceRecord", async () => {
    const record = AdherenceRecord.create({
      id: createAdherenceId(), patientId, date: "2025-01-15", source: "portal",
      adherenceMenu: 100, adherenceWater: 100, adherenceActivity: 100, adherenceSupplements: 100, adherenceSleep: 100,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    await repo.saveRecord(record);
    await repo.deleteRecord(record.id);

    const found = await repo.findRecordById(record.id);
    expect(found).toBeNull();
  });

  it("guarda y recupera BarrierEvents por paciente", async () => {
    const b1 = BarrierEvent.create({
      patientId, type: "economica", description: "Falta presupuesto", date: "2025-01-10", actionTaken: "",
    });
    const b2 = BarrierEvent.create({
      patientId, type: "tiempo", description: "Horario laboral", date: "2025-01-12", actionTaken: "Reorganizar horarios",
    });
    await repo.saveBarrier(b1);
    await repo.saveBarrier(b2);

    const barriers = await repo.findBarriersByPatient(patientId);
    expect(barriers).toHaveLength(2);
    expect(barriers.map((b) => b.type).sort()).toEqual(["economica", "tiempo"]);
  });

  it("elimina un BarrierEvent", async () => {
    const b = BarrierEvent.create({
      patientId, type: "emocional", description: "Ansiedad", date: "2025-01-15", actionTaken: "",
    });
    await repo.saveBarrier(b);
    await repo.deleteBarrier(b.id);

    const barriers = await repo.findBarriersByPatient(patientId);
    expect(barriers).toHaveLength(0);
  });
});
