import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  createAdherenceRecordUC,
  calculateAdherenceIndexUC,
  listAdherenceByPatientUC,
  createBarrierEventUC,
  listBarriersByPatientUC,
} from "./adherenceUseCases";
import { DexieAdherenceRepository } from "../infrastructure/DexieAdherenceRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { createAdherenceId } from "../domain/AdherenceId";
import { AdherenceRecord } from "../domain/AdherenceRecord";

describe("adherenceUseCases", () => {
  let repo: DexieAdherenceRepository;
  let db: NutriClinicaDB;
  const patientId = crypto.randomUUID();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-ad-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieAdherenceRepository(db);
  });

  it("createAdherenceRecordUC crea con score y source correctos", async () => {
    const record = await createAdherenceRecordUC(repo, {
      patientId,
      date: "2025-02-10",
      source: "consulta",
      adherenceMenu: 90,
      adherenceWater: 80,
      adherenceActivity: 70,
      adherenceSupplements: 60,
      adherenceSleep: 50,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });

    expect(record.source).toBe("consulta");
    expect(record.adherenceMenu).toBe(90);
    expect(record.adherenceWater).toBe(80);

    const found = await repo.findRecordById(record.id);
    expect(found?.source).toBe("consulta");
  });

  it("calculateAdherenceIndexUC computa índice ponderado correctamente", async () => {
    const r1 = AdherenceRecord.create({
      id: createAdherenceId(), patientId, date: "2025-03-01", source: "app",
      adherenceMenu: 100, adherenceWater: 50, adherenceActivity: 50, adherenceSupplements: 100, adherenceSleep: 100,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    const r2 = AdherenceRecord.create({
      id: createAdherenceId(), patientId, date: "2025-03-08", source: "app",
      adherenceMenu: 0, adherenceWater: 50, adherenceActivity: 50, adherenceSupplements: 0, adherenceSleep: 0,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    await repo.saveRecord(r1);
    await repo.saveRecord(r2);

    const index = await calculateAdherenceIndexUC(repo, patientId, "2025-03-01", "2025-03-31");

    expect(index.scoreMenu).toBe(50);
    expect(index.scoreWater).toBe(50);
    expect(index.scoreActivity).toBe(50);
    expect(index.scoreSupplements).toBe(50);
    expect(index.scoreSleep).toBe(50);
    const expectedGlobal = Math.round(50 * 0.3 + 50 * 0.2 + 50 * 0.2 + 50 * 0.15 + 50 * 0.15);
    expect(index.scoreGlobal).toBe(expectedGlobal);
    expect(index.patientId).toBe(patientId);
  });

  it("calculateAdherenceIndexUC retorna 0 si no hay registros", async () => {
    const index = await calculateAdherenceIndexUC(repo, patientId, "2025-01-01", "2025-01-31");
    expect(index.scoreGlobal).toBe(0);
    expect(index.tendency).toBe("estable");
  });

  it("listAdherenceRecordsUC filtra por paciente", async () => {
    const otherPid = crypto.randomUUID();
    await createAdherenceRecordUC(repo, {
      patientId, date: "2025-04-01", source: "portal",
      adherenceMenu: 80, adherenceWater: 80, adherenceActivity: 80, adherenceSupplements: 80, adherenceSleep: 80,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });
    await createAdherenceRecordUC(repo, {
      patientId: otherPid, date: "2025-04-01", source: "portal",
      adherenceMenu: 80, adherenceWater: 80, adherenceActivity: 80, adherenceSupplements: 80, adherenceSleep: 80,
      notes: "", intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "",
    });

    const records = await listAdherenceByPatientUC(repo, patientId);
    expect(records).toHaveLength(1);
    expect(records[0]?.patientId).toBe(patientId);
  });

  it("createBarrierEventUC crea una barrera", async () => {
    const barrier = await createBarrierEventUC(repo, {
      patientId, type: "tiempo", description: "Poco tiempo para cocinar", date: "2025-04-10",
    });

    expect(barrier.type).toBe("tiempo");
    expect(barrier.description).toBe("Poco tiempo para cocinar");
    expect(barrier.patientId).toBe(patientId);
  });

  it("listBarriersByPatientUC filtra por paciente", async () => {
    const otherPid = crypto.randomUUID();
    await createBarrierEventUC(repo, {
      patientId, type: "economica", description: "B1", date: "2025-04-01",
    });
    await createBarrierEventUC(repo, {
      patientId: otherPid, type: "social", description: "B2", date: "2025-04-01",
    });

    const barriers = await listBarriersByPatientUC(repo, patientId);
    expect(barriers).toHaveLength(1);
    expect(barriers[0]?.type).toBe("economica");
  });
});
