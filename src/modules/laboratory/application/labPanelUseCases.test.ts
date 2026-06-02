import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { CreateLabPanelUseCase, GetLabPanelUseCase, ListLabPanelsUseCase, UpdateLabPanelUseCase, DeleteLabPanelUseCase } from "./labPanelUseCases";
import { DexieLabPanelRepository } from "../infrastructure/DexieLabPanelRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { LabPanelId } from "../domain/LabPanelId";
import { LabResult } from "../domain/LabResult";
import { LabPanelNotFoundError } from "../domain/LabPanelRepository";
import { PatientId } from "@modules/patient/domain/PatientId";

describe("labPanelUseCases", () => {
  let repo: DexieLabPanelRepository;
  let db: NutriClinicaDB;
  let create: CreateLabPanelUseCase;
  let get: GetLabPanelUseCase;
  let list: ListLabPanelsUseCase;
  let update: UpdateLabPanelUseCase;
  let del: DeleteLabPanelUseCase;
  const pid = PatientId.generate();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-lab-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieLabPanelRepository(db);
    create = new CreateLabPanelUseCase(repo);
    get = new GetLabPanelUseCase(repo);
    list = new ListLabPanelsUseCase(repo);
    update = new UpdateLabPanelUseCase(repo);
    del = new DeleteLabPanelUseCase(repo);
  });

  it("Create persiste el panel y lo recupera con sus resultados", async () => {
    const panel = await create.execute({
      patientId: pid,
      takenAt: new Date(),
      results: [LabResult.from({ test: "GLUCOSA", value: 92 })],
    });
    const found = await get.execute(panel.id);
    expect(found.results).toHaveLength(1);
    expect(found.getValue("GLUCOSA")).toBe(92);
  });

  it("Create rechaza panel sin resultados", async () => {
    await expect(
      create.execute({ patientId: pid, takenAt: new Date(), results: [] }),
    ).rejects.toThrow();
  });

  it("Get en id inexistente lanza LabPanelNotFoundError", async () => {
    await expect(get.execute(LabPanelId.generate())).rejects.toBeInstanceOf(LabPanelNotFoundError);
  });

  it("List filtra por paciente y devuelve total correcto", async () => {
    const other = PatientId.generate();
    await create.execute({ patientId: pid, takenAt: new Date(), results: [LabResult.from({ test: "GLUCOSA", value: 90 })] });
    await create.execute({ patientId: pid, takenAt: new Date(), results: [LabResult.from({ test: "HBA1C", value: 5.4 })] });
    await create.execute({ patientId: other, takenAt: new Date(), results: [LabResult.from({ test: "GLUCOSA", value: 88 })] });

    const result = await list.execute({ patientId: pid });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("Update modifica notas y conserva el resto", async () => {
    const panel = await create.execute({
      patientId: pid,
      takenAt: new Date(),
      results: [LabResult.from({ test: "TSH", value: 2.1 })],
      notes: "Original",
    });
    const updated = await update.execute(panel.id, { notes: "Actualizado" });
    expect(updated.notes).toBe("Actualizado");
    expect(updated.getValue("TSH")).toBe(2.1);
  });

  it("Update sobre id inexistente lanza error", async () => {
    await expect(update.execute(LabPanelId.generate(), { notes: "x" })).rejects.toBeInstanceOf(LabPanelNotFoundError);
  });

  it("Delete soft remueve de listados por defecto", async () => {
    const panel = await create.execute({
      patientId: pid,
      takenAt: new Date(),
      results: [LabResult.from({ test: "GLUCOSA", value: 95 })],
    });
    await del.execute(panel.id, true);
    const result = await list.execute({ patientId: pid });
    expect(result.items).toHaveLength(0);
  });
});
