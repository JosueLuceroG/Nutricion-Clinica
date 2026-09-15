import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieConsultationRepository } from "./DexieConsultationRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Consultation } from "../domain/Consultation";
import { ConsultationId } from "../domain/ConsultationId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { useSyncStore } from "@store/syncStore";

const make = (
  patientId: PatientId,
  overrides: Partial<{
    daysAgo: number;
    number: number;
    status: "scheduled" | "in-progress" | "completed" | "cancelled";
    reason: string;
  }> = {},
) => {
  const date = new Date();
  date.setDate(date.getDate() - (overrides.daysAgo ?? 0));
  return Consultation.create({
    patientId,
    consultationDate: date,
    consultationNumber: overrides.number ?? 1,
    reason: overrides.reason ?? "Control inicial",
    status: overrides.status,
  });
};

describe("DexieConsultationRepository", () => {
  let repo: DexieConsultationRepository;
  let db: NutriClinicaDB;
  const pid = PatientId.generate();

  beforeEach(async () => {
    useSyncStore.getState().setSucursalId("suc-1");
    db = new NutriClinicaDB(`test-consult-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieConsultationRepository(db);
  });

  it("guarda y recupera una consulta por id", async () => {
    const c = make(pid, { reason: "Control trimestral" });
    await repo.save(c);
    const found = await repo.findById(c.id);
    expect(found).not.toBeNull();
    expect(found?.reason).toBe("Control trimestral");
    expect(found?.patientId.equals(pid)).toBe(true);
  });

  it("no lee, sobrescribe ni elimina una consulta de otra sucursal", async () => {
    const consultation = make(pid);
    await repo.save(consultation);
    await db.consultations.update(consultation.id.toString(), { sucursal_id: "suc-2" });

    expect(await repo.findById(consultation.id)).toBeNull();
    await expect(repo.save(consultation)).rejects.toThrow(/otra sucursal/);
    await repo.delete(consultation.id, true);
    expect(await db.consultations.get(consultation.id.toString())).toMatchObject({
      sucursal_id: "suc-2",
      deleted_at: null,
    });
  });

  it("nextConsultationNumber retorna 1 para paciente sin consultas", async () => {
    const next = await repo.nextConsultationNumber(pid);
    expect(next).toBe(1);
  });

  it("nextConsultationNumber retorna max+1 considerando soft-deleted", async () => {
    await repo.save(make(pid, { number: 1 }));
    await repo.save(make(pid, { number: 2 }));
    const c3 = make(pid, { number: 3 });
    await repo.save(c3);
    await repo.delete(c3.id, true);

    const next = await repo.nextConsultationNumber(pid);
    expect(next).toBe(3);
  });

  it("filtra por patientId y ordena por fecha descendente", async () => {
    const other = PatientId.generate();
    await repo.save(make(pid, { daysAgo: 60, number: 1 }));
    await repo.save(make(pid, { daysAgo: 0, number: 2 }));
    await repo.save(make(pid, { daysAgo: 30, number: 3 }));
    await repo.save(make(other, { daysAgo: 0, number: 1 }));

    const mine = await repo.findAll({ patientId: pid });
    expect(mine).toHaveLength(3);
    expect(mine.every((c) => c.patientId.equals(pid))).toBe(true);
    expect(mine[0]?.consultationNumber).toBe(2);
  });

  it("filtra por status (uno o varios)", async () => {
    await repo.save(make(pid, { status: "scheduled", number: 1 }));
    await repo.save(make(pid, { status: "in-progress", number: 2 }));
    await repo.save(make(pid, { status: "completed", number: 3 }));

    const active = await repo.findAll({ patientId: pid, status: ["scheduled", "in-progress"] });
    expect(active).toHaveLength(2);

    const scheduled = await repo.findAll({ patientId: pid, status: "scheduled" });
    expect(scheduled).toHaveLength(1);
  });

  it("filtra por sucursalId", async () => {
    const c1 = make(pid, { number: 1 });
    const c2 = make(pid, { number: 2 });
    await repo.save(c1);
    await repo.save(c2);
    await db.consultations.update(c1.id.toString(), { sucursal_id: "suc-1" });
    await db.consultations.update(c2.id.toString(), { sucursal_id: "suc-2" });

    const results = await repo.findAll({ sucursalId: "suc-1" });

    expect(results).toHaveLength(1);
    expect(results[0]?.consultationNumber).toBe(1);
    expect(await repo.count({ sucursalId: "suc-1" })).toBe(1);
  });

  it("excluye soft-deleted por defecto", async () => {
    const a = make(pid, { number: 1 });
    const b = make(pid, { number: 2 });
    await repo.save(a);
    await repo.save(b);
    await repo.delete(a.id, true);

    const items = await repo.findAll({ patientId: pid });
    expect(items).toHaveLength(1);
    expect(await repo.findById(a.id)).toBeNull();
    expect((await repo.findById(a.id, true))?.deletedAt).not.toBeNull();
  });

  it("count refleja el total sin soft-deleted", async () => {
    await repo.save(make(pid, { number: 1 }));
    await repo.save(make(pid, { number: 2 }));
    expect(await repo.count({ patientId: pid })).toBe(2);
  });

  it("hard delete elimina definitivamente", async () => {
    const c = make(pid);
    await repo.save(c);
    await repo.delete(c.id, false);
    const found = await repo.findById(c.id);
    expect(found).toBeNull();
  });

  it("delete sobre id inexistente (soft) no lanza", async () => {
    await expect(repo.delete(ConsultationId.generate(), true)).resolves.not.toThrow();
  });
});
