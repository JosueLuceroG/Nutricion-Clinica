import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  createWeeklyPlanUC,
  listPlansByPatientUC,
  deletePlanUC,
  createShoppingListFromPlanUC,
} from "./mealPlannerUseCases";
import { DexieMealPlannerRepository } from "../infrastructure/DexieMealPlannerRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { createWeeklyPlanId } from "../domain/WeeklyPlanId";
import { WeeklyPlan } from "../domain/WeeklyPlan";

describe("mealPlannerUseCases", () => {
  let repo: DexieMealPlannerRepository;
  let db: NutriClinicaDB;
  const patientId = crypto.randomUUID();
  const professionalId = crypto.randomUUID();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-mp-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieMealPlannerRepository(db);
  });

  it("createWeeklyPlanUC crea con tipo/status/fechas correctos", async () => {
    const plan = await createWeeklyPlanUC(repo, {
      patientId,
      name: "Plan mensual",
      type: "monthly",
      startDate: "2025-07-01",
      endDate: "2025-07-31",
      targetKcal: 1600,
      targetProteinPct: 25,
      targetFatPct: 25,
      targetCarbPct: 50,
      targetFiberG: 30,
      timesPerDay: 5,
      restrictions: ["sin lactosa"],
      days: [],
      professionalId,
    });

    expect(plan.type).toBe("monthly");
    expect(plan.status).toBe("draft");
    expect(plan.startDate).toBe("2025-07-01");
    expect(plan.endDate).toBe("2025-07-31");
    expect(plan.restrictions).toEqual(["sin lactosa"]);
  });

  it("createShoppingListFromPlanUC genera lista de compras desde los meals del plan", async () => {
    const plan = WeeklyPlan.create({
      id: createWeeklyPlanId(),
      patientId,
      name: "Plan semanal",
      type: "weekly",
      startDate: "2025-07-07",
      endDate: "2025-07-13",
      targetKcal: 1500,
      targetProteinPct: 20,
      targetFatPct: 25,
      targetCarbPct: 55,
      targetFiberG: 25,
      timesPerDay: 5,
      professionalId,
      restrictions: [],
      days: [
        {
          dayNumber: 1,
          date: "2025-07-07",
          meals: [
            {
              slot: "breakfast",
              exchanges: [{ foodId: "fruta-manzana", count: 2 }],
              targetKcal: 300,
            },
            {
              slot: "lunch",
              exchanges: [{ foodId: "pollo-pechuga", count: 1 }, { foodId: "arroz", count: 1 }],
              targetKcal: 500,
            },
          ],
          notes: "",
        },
        {
          dayNumber: 2,
          date: "2025-07-08",
          meals: [
            {
              slot: "breakfast",
              exchanges: [{ foodId: "fruta-manzana", count: 1 }],
              targetKcal: 300,
            },
          ],
          notes: "",
        },
      ],
    });
    await repo.savePlan(plan);

    const list = await createShoppingListFromPlanUC(repo, plan.id, patientId);

    expect(list.name).toBe("Compras: Plan semanal");
    const items = JSON.parse(list.items) as Array<{ group: string; food: string; quantity: number; unit: string }>;
    expect(items).toHaveLength(3);
    const manzana = items.find((i) => i.food === "fruta-manzana");
    expect(manzana?.quantity).toBe(3);
    expect(manzana?.unit).toBe("ración");
  });

  it("listPlansByPatientUC filtra por paciente", async () => {
    const otherPid = crypto.randomUUID();
    await createWeeklyPlanUC(repo, {
      patientId, name: "Plan A", type: "weekly",
      startDate: "2025-08-01", endDate: "2025-08-07",
      targetKcal: 0, targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    });
    await createWeeklyPlanUC(repo, {
      patientId: otherPid, name: "Plan B", type: "weekly",
      startDate: "2025-08-01", endDate: "2025-08-07",
      targetKcal: 0, targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    });

    const plans = await listPlansByPatientUC(repo, patientId);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.name).toBe("Plan A");
  });

  it("deletePlanUC elimina un plan", async () => {
    const plan = await createWeeklyPlanUC(repo, {
      patientId, name: "Temp", type: "daily",
      startDate: "2025-09-01", endDate: "2025-09-01",
      targetKcal: 0, targetProteinPct: 20, targetFatPct: 25, targetCarbPct: 55, targetFiberG: 25, timesPerDay: 5,
      professionalId,
      restrictions: [], days: [],
    });

    await deletePlanUC(repo, plan.id);

    const plans = await listPlansByPatientUC(repo, patientId);
    expect(plans).toHaveLength(0);
  });
});
