import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieGoalRepository } from "../infrastructure/DexieGoalRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import {
  createGoalUC,
  updateGoalUC,
  listGoalsByPatientUC,
  deleteGoalUC,
  achieveGoalUC,
} from "./goalUseCases";
import { createGoalId } from "../domain/GoalId";

describe("goalUseCases", () => {
  let repo: DexieGoalRepository;
  let db: NutriClinicaDB;
  const professionalId = crypto.randomUUID();
  const patientId = crypto.randomUUID();

  const baseInput = {
    patientId,
    type: "antropometrico" as const,
    variable: "peso",
    initialValue: 80,
    initialValueDate: "2026-06-01",
    targetValue: 70,
    unit: "kg",
    startDate: "2026-06-01",
    targetDate: "2026-09-01",
    criterion: "numerico" as const,
    criterionDetail: "Reducir 10 kg",
    priority: "alta" as const,
    source: "clinica" as const,
    reason: "Mejorar composición corporal",
    actionPlan: "Dieta hipocalórica",
    trackingMetrics: ["peso"],
    notes: "",
  };

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-gl-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieGoalRepository(db);
  });

  it("createGoalUC crea con type y variable correctos", async () => {
    const goal = await createGoalUC(repo, baseInput, professionalId);

    expect(goal.type).toBe("antropometrico");
    expect(goal.variable).toBe("peso");
    expect(goal.status).toBe("activo");
    expect(goal.professionalId).toBe(professionalId);
    expect(goal.patientId).toBe(patientId);

    const found = await repo.findById(goal.id);
    expect(found).not.toBeNull();
  });

  it("listGoalsByPatientUC filtra por paciente", async () => {
    await createGoalUC(repo, baseInput, professionalId);
    await createGoalUC(repo, { ...baseInput, variable: "imc" }, professionalId);
    const otherPatient = crypto.randomUUID();
    await createGoalUC(repo, { ...baseInput, patientId: otherPatient, variable: "cintura" }, professionalId);

    const results = await listGoalsByPatientUC(repo, patientId);
    expect(results).toHaveLength(2);
  });

  it("listGoalsByPatientUC retorna vacío si no hay objetivos", async () => {
    const results = await listGoalsByPatientUC(repo, patientId);
    expect(results).toHaveLength(0);
  });

  it("updateGoalUC actualiza campos", async () => {
    const goal = await createGoalUC(repo, baseInput, professionalId);

    const updated = await updateGoalUC(repo, goal.id, {
      targetValue: 65,
      priority: "media",
    });

    expect(updated.targetValue).toBe(65);
    expect(updated.priority).toBe("media");
    expect(updated.variable).toBe("peso");

    const found = await repo.findById(goal.id);
    expect(found?.targetValue).toBe(65);
  });

  it("updateGoalUC lanza si el objetivo no existe", async () => {
    await expect(updateGoalUC(repo, createGoalId(), { variable: "imc" })).rejects.toThrow();
  });

  it("achieveGoalUC cambia status a logrado", async () => {
    const goal = await createGoalUC(repo, baseInput, professionalId);

    const achieved = await achieveGoalUC(repo, goal.id);

    expect(achieved.status).toBe("logrado");
    expect(achieved.closeDate).not.toBeUndefined();

    const found = await repo.findById(goal.id);
    expect(found?.status).toBe("logrado");
  });

  it("achieveGoalUC lanza si el objetivo no existe", async () => {
    await expect(achieveGoalUC(repo, createGoalId())).rejects.toThrow();
  });

  it("deleteGoalUC elimina el objetivo", async () => {
    const goal = await createGoalUC(repo, baseInput, professionalId);

    await deleteGoalUC(repo, goal.id);

    const found = await repo.findById(goal.id);
    expect(found).toBeNull();
  });
});
