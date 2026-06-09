import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieGoalRepository } from "./DexieGoalRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Goal } from "../domain/Goal";
import { createGoalId } from "../domain/GoalId";

const patientId = crypto.randomUUID();
const professionalId = crypto.randomUUID();

const makeGoal = (overrides: Partial<{
  patientId: string;
  type: "antropometrico" | "bioquimico" | "clinico" | "dietetico" | "conductual" | "personalizado";
  variable: string;
  status: "activo" | "en_pausa" | "logrado" | "no_logrado" | "abandonado" | "modificado";
  priority: "alta" | "media" | "baja";
}> = {}) => {
  return Goal.create({
    id: createGoalId(),
    patientId: overrides.patientId ?? patientId,
    type: overrides.type ?? "antropometrico",
    variable: overrides.variable ?? "peso",
    initialValue: 80,
    initialValueDate: "2026-06-01",
    targetValue: 70,
    unit: "kg",
    startDate: "2026-06-01",
    targetDate: "2026-09-01",
    criterion: "numerico",
    criterionDetail: "Reducir 10 kg",
    priority: overrides.priority ?? "alta",
    source: "clinica",
    reason: "Mejorar composición corporal",
    actionPlan: "Dieta hipocalórica y ejercicio",
    trackingMetrics: ["peso", "imc"],
    alerts: [],
    professionalId,
    notes: "",
    status: overrides.status ?? "activo",
  });
};

describe("DexieGoalRepository", () => {
  let repo: DexieGoalRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieGoalRepository(db);
  });

  it("guarda y recupera un objetivo por id", async () => {
    const g = makeGoal();
    await repo.save(g);

    const found = await repo.findById(g.id);
    expect(found).not.toBeNull();
    expect(found?.variable).toBe("peso");
    expect(found?.type).toBe("antropometrico");
    expect(found?.patientId).toBe(patientId);
  });

  it("retorna null cuando el objetivo no existe", async () => {
    const found = await repo.findById(createGoalId());
    expect(found).toBeNull();
  });

  it("findByPatient filtra por paciente", async () => {
    const g1 = makeGoal();
    const otherPatient = crypto.randomUUID();
    const g2 = makeGoal({ patientId: otherPatient, variable: "imc" });
    await repo.save(g1);
    await repo.save(g2);

    const results = await repo.findByPatient(patientId);
    expect(results).toHaveLength(1);
    expect(results[0]?.variable).toBe("peso");
  });

  it("findByStatus filtra por estado", async () => {
    await repo.save(makeGoal({ variable: "peso", status: "activo" }));
    await repo.save(makeGoal({ variable: "imc", status: "logrado" }));

    const active = await repo.findByStatus("activo");
    expect(active).toHaveLength(1);
    expect(active[0]?.variable).toBe("peso");
  });

  it("findAll retorna todos los objetivos", async () => {
    await repo.save(makeGoal({ variable: "peso" }));
    await repo.save(makeGoal({ variable: "imc" }));
    await repo.save(makeGoal({ variable: "cintura" }));

    const all = await repo.findAll();
    expect(all).toHaveLength(3);
  });

  it("delete elimina el objetivo", async () => {
    const g = makeGoal();
    await repo.save(g);

    await repo.delete(g.id);

    const found = await repo.findById(g.id);
    expect(found).toBeNull();
  });

  it("delete no lanza si el objetivo no existe", async () => {
    await expect(repo.delete(createGoalId())).resolves.toBeUndefined();
  });
});
