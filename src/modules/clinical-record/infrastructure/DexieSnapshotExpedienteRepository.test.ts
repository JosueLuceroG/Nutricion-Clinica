import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieSnapshotExpedienteRepository } from "./DexieSnapshotExpedienteRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { SnapshotExpedienteProps } from "../domain/SnapshotExpediente";

const makeSnapshot = (overrides: Partial<SnapshotExpedienteProps> = {}): SnapshotExpedienteProps => ({
  id: overrides.id ?? crypto.randomUUID(),
  consultaId: overrides.consultaId ?? crypto.randomUUID(),
  patientId: overrides.patientId ?? crypto.randomUUID(),
  fechaSnapshot: overrides.fechaSnapshot ?? new Date().toISOString(),
  contenidoJsonExpediente: overrides.contenidoJsonExpediente ?? "{}",
  contenidoJsonAntropometria: overrides.contenidoJsonAntropometria ?? null,
  contenidoJsonBioquimica: overrides.contenidoJsonBioquimica ?? null,
  contenidoJsonPlan: overrides.contenidoJsonPlan ?? null,
  hashIntegridad: overrides.hashIntegridad ?? crypto.randomUUID(),
  versionSmae: overrides.versionSmae ?? "1.0",
  profesionalId: overrides.profesionalId ?? crypto.randomUUID(),
  createdAt: overrides.createdAt ?? new Date().toISOString(),
});

describe("DexieSnapshotExpedienteRepository", () => {
  let repo: DexieSnapshotExpedienteRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieSnapshotExpedienteRepository(db);
  });

  it("save y findByConsultaId hacen roundtrip", async () => {
    const consultaId = crypto.randomUUID();
    const snapshot = makeSnapshot({ consultaId, versionSmae: "2.0" });

    await repo.save(snapshot);

    const found = await repo.findByConsultaId(consultaId);
    expect(found).not.toBeNull();
    expect(found?.consultaId).toBe(consultaId);
    expect(found?.versionSmae).toBe("2.0");
  });

  it("findByConsultaId retorna null si no existe", async () => {
    const found = await repo.findByConsultaId(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("save y findByPatientId hacen roundtrip", async () => {
    const patientId = crypto.randomUUID();
    const snapshot = makeSnapshot({ patientId });

    await repo.save(snapshot);

    const results = await repo.findByPatientId(patientId);
    expect(results).toHaveLength(1);
    expect(results[0]?.patientId).toBe(patientId);
  });

  it("findByPatientId retorna arreglo vacio si no hay datos", async () => {
    const results = await repo.findByPatientId(crypto.randomUUID());
    expect(results).toEqual([]);
  });

  it("multiples snapshots del mismo paciente son encontrados por findByPatientId", async () => {
    const patientId = crypto.randomUUID();
    const s1 = makeSnapshot({ patientId, consultaId: crypto.randomUUID() });
    const s2 = makeSnapshot({ patientId, consultaId: crypto.randomUUID() });

    await repo.save(s1);
    await repo.save(s2);

    const results = await repo.findByPatientId(patientId);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.consultaId).sort()).toEqual(
      [s1.consultaId, s2.consultaId].sort(),
    );
  });

  it("findByConsultaId distingue entre diferentes consultas", async () => {
    const s1 = makeSnapshot({ consultaId: "consulta-a" });
    const s2 = makeSnapshot({ consultaId: "consulta-b" });

    await repo.save(s1);
    await repo.save(s2);

    const found = await repo.findByConsultaId("consulta-a");
    expect(found?.consultaId).toBe("consulta-a");
    expect(found?.id).toBe(s1.id);
  });
});
