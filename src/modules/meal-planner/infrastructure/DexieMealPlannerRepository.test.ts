import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieMealPlannerRepository } from "./DexieMealPlannerRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { WeeklyPlan } from "../domain/WeeklyPlan";
import { ShoppingList } from "../domain/ShoppingList";
import { createWeeklyPlanId } from "../domain/WeeklyPlanId";

describe("DexieMealPlannerRepository", () => {
  let repo: DexieMealPlannerRepository;
  let db: NutriClinicaDB;
  const patientId = crypto.randomUUID();
  const professionalId = crypto.randomUUID();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-mp-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-mp-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieMealPlannerRepository(db);
  });

  it("guarda y recupera un WeeklyPlan por id", async () => {
    const plan = WeeklyPlan.create({
      id: createWeeklyPlanId(),
      patientId,
      name: "Plan semanal",
      type: "weekly",
      startDate: "2025-06-01",
      endDate: "2025-06-07",
      targetKcal: 1800,
      targetProteinPct: 20,
      targetFatPct: 25,
      targetCarbPct: 55,
      targetFiberG: 25,
      timesPerDay: 5,
      professionalId,
      restrictions: [],
      days: [],
    });
    await repo.savePlan(plan);

    const found = await repo.findPlanById(plan.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Plan semanal");
    expect(found?.type).toBe("weekly");
    expect(found?.status).toBe("draft");
  });

  it("retorna null cuando el plan no existe", async () => {
    const found = await repo.findPlanById(createWeeklyPlanId());
    expect(found).toBeNull();
  });

  it("findPlansByPatient filtra por paciente", async () => {
    const otherPid = crypto.randomUUID();
    await repo.savePlan(WeeklyPlan.create({
      id: createWeeklyPlanId(), patientId, name: "Plan A", type: "weekly",
      startDate: "2025-06-01", endDate: "2025-06-07", targetKcal: 1500,
      targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    }));
    await repo.savePlan(WeeklyPlan.create({
      id: createWeeklyPlanId(), patientId: otherPid, name: "Plan B", type: "weekly",
      startDate: "2025-06-01", endDate: "2025-06-07", targetKcal: 1500,
      targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    }));

    const plans = await repo.findPlansByPatient(patientId);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.name).toBe("Plan A");
  });

  it("guarda y recupera ShoppingList por paciente", async () => {
    const plan = WeeklyPlan.create({
      id: createWeeklyPlanId(), patientId, name: "Plan", type: "weekly",
      startDate: "2025-06-01", endDate: "2025-06-07", targetKcal: 1500,
      targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    });
    await repo.savePlan(plan);

    const list = ShoppingList.create({
      patientId,
      weeklyPlanId: plan.id,
      name: "Compras: Plan",
      numberOfPeople: 2,
      currency: "MXN",
      items: JSON.stringify([{ group: "frutas", food: "manzana", quantity: 5, unit: "pieza" }]),
      note: "Comprar el lunes",
    });
    await repo.saveShoppingList(list);

    const lists = await repo.findShoppingListsByPatient(patientId);
    expect(lists).toHaveLength(1);
    expect(lists[0]?.name).toBe("Compras: Plan");
    expect(lists[0]?.weeklyPlanId).toBe(plan.id);
  });

  it("elimina un WeeklyPlan", async () => {
    const plan = WeeklyPlan.create({
      id: createWeeklyPlanId(), patientId, name: "Temp", type: "weekly",
      startDate: "2025-06-01", endDate: "2025-06-07", targetKcal: 1500,
      targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    });
    await repo.savePlan(plan);
    await repo.deletePlan(plan.id);

    const found = await repo.findPlanById(plan.id);
    expect(found).toBeNull();
  });
});
