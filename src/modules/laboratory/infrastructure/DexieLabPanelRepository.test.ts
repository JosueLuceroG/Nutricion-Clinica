import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieLabPanelRepository } from "./DexieLabPanelRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { LabPanel } from "../domain/LabPanel";
import { LabPanelId } from "../domain/LabPanelId";
import { LabResult } from "../domain/LabResult";
import { PatientId } from "@modules/patient/domain/PatientId";

const makePanel = (
  patientId: PatientId,
  overrides: Partial<{
    daysAgo: number;
    values: { test: Parameters<typeof LabResult.from>[0]["test"]; value: number }[];
    notes: string | null;
  }> = {},
) => {
  const date = new Date();
  date.setDate(date.getDate() - (overrides.daysAgo ?? 0));
  return LabPanel.create({
    patientId,
    takenAt: date,
    results: (overrides.values ?? [{ test: "GLUCOSA", value: 95 }]).map((v) => LabResult.from(v)),
    notes: overrides.notes ?? null,
  });
};

describe("DexieLabPanelRepository", () => {
  let repo: DexieLabPanelRepository;
  let db: NutriClinicaDB;
  const pid = PatientId.generate();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-lab-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieLabPanelRepository(db);
  });

  it("guarda y recupera un panel por id preservando los resultados", async () => {
    const panel = makePanel(pid, {
      values: [
        { test: "GLUCOSA", value: 95 },
        { test: "COLESTEROL_TOTAL", value: 200 },
        { test: "HDL", value: 50 },
      ],
    });
    await repo.save(panel);

    const found = await repo.findById(panel.id);
    expect(found).not.toBeNull();
    expect(found?.patientId.equals(pid)).toBe(true);
    expect(found?.results).toHaveLength(3);
    expect(found?.getValue("GLUCOSA")).toBe(95);
    expect(found?.getValue("COLESTEROL_TOTAL")).toBe(200);
    expect(found?.getValue("HDL")).toBe(50);
  });

  it("filtra por patientId", async () => {
    const other = PatientId.generate();
    await repo.save(makePanel(pid));
    await repo.save(makePanel(pid, { daysAgo: 30 }));
    await repo.save(makePanel(other));

    const mine = await repo.findAll({ patientId: pid });
    expect(mine).toHaveLength(2);
    expect(mine.every((p) => p.patientId.equals(pid))).toBe(true);
  });

  it("ordena por fecha de toma descendente (más reciente primero)", async () => {
    await repo.save(makePanel(pid, { daysAgo: 60 }));
    await repo.save(makePanel(pid, { daysAgo: 0 }));
    await repo.save(makePanel(pid, { daysAgo: 30 }));

    const items = await repo.findAll({ patientId: pid });
    expect(items).toHaveLength(3);
    expect(items[0]?.takenAt.getTime()).toBeGreaterThanOrEqual(items[1]?.takenAt.getTime() ?? 0);
    expect(items[1]?.takenAt.getTime()).toBeGreaterThanOrEqual(items[2]?.takenAt.getTime() ?? 0);
  });

  it("excluye soft-deleted", async () => {
    const p1 = makePanel(pid);
    const p2 = makePanel(pid);
    await repo.save(p1);
    await repo.save(p2);
    await repo.delete(p1.id, true);

    const items = await repo.findAll({ patientId: pid });
    expect(items.map((p) => p.id.toString())).toEqual([p2.id.toString()]);
  });

  it("filtra por rango de fechas", async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() - 5);

    await repo.save(makePanel(pid, { daysAgo: 60 }));
    await repo.save(makePanel(pid, { daysAgo: 15 }));
    await repo.save(makePanel(pid, { daysAgo: 2 }));

    const items = await repo.findAll({ patientId: pid, from, to });
    expect(items).toHaveLength(1);
    expect(items[0]?.takenAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
  });

  it("preserva la lista de resultados y sus valores en roundtrip", async () => {
    const panel = LabPanel.create({
      patientId: pid,
      takenAt: new Date(),
      results: [
        LabResult.from({ test: "HBA1C", value: 5.4 }),
        LabResult.from({ test: "CREATININA", value: 0.9 }),
        LabResult.from({ test: "VITAMINA_D", value: 32 }),
      ],
      notes: "Control trimestral",
    });
    await repo.save(panel);

    const found = await repo.findById(panel.id);
    expect(found?.results).toHaveLength(3);
    expect(found?.notes).toBe("Control trimestral");
    expect(found?.hasTest("HBA1C")).toBe(true);
    expect(found?.hasTest("TSH")).toBe(false);
  });

  it("count refleja el total sin soft-deleted", async () => {
    const a = makePanel(pid);
    const b = makePanel(pid);
    await repo.save(a);
    await repo.save(b);
    await repo.delete(a.id, true);

    expect(await repo.count({ patientId: pid })).toBe(1);
  });

  it("count sin filtros incluye todos los pacientes", async () => {
    await repo.save(makePanel(pid));
    await repo.save(makePanel(PatientId.generate()));
    expect(await repo.count()).toBe(2);
  });

  it("hard delete elimina definitivamente", async () => {
    const p = makePanel(pid);
    await repo.save(p);
    await repo.delete(p.id, false);

    const found = await repo.findById(p.id);
    expect(found).toBeNull();
  });

  it("delete en id inexistente (soft) no lanza error", async () => {
    await expect(repo.delete(LabPanelId.generate(), true)).resolves.not.toThrow();
  });
});
