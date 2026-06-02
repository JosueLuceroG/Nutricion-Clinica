import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieMealPlanRepository } from "./DexieMealPlanRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { MealPlan } from "../domain/MealPlan";
import { MealPlanId } from "../domain/MealPlanId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { MEAL_SLOT_ORDER } from "../domain/MealSlot";

const make = (
  patientId: PatientId,
  overrides: Partial<{
    daysAgo: number;
    name: string;
    status: "draft" | "active" | "completed" | "cancelled";
  }> = {},
) => {
  const date = new Date();
  date.setDate(date.getDate() - (overrides.daysAgo ?? 0));
  return MealPlan.create({
    patientId,
    name: overrides.name ?? "Plan hipocalórico 1500 kcal",
    startDate: date,
    kcalTarget: 1500,
    proteinTargetG: 80,
    carbsTargetG: 180,
    fatTargetG: 50,
    meals: MEAL_SLOT_ORDER.map((slot) => ({ slot, exchanges: [] })),
    status: overrides.status,
  });
};

describe("DexieMealPlanRepository", () => {
  let repo: DexieMealPlanRepository;
  let db: NutriClinicaDB;
  const pid = PatientId.generate();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-mp-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieMealPlanRepository(db);
  });

  it("guarda y recupera un plan por id", async () => {
    const p = make(pid, { name: "Plan A" });
    await repo.save(p);
    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("Plan A");
    expect(found?.kcalTarget).toBe(1500);
    expect(found?.meals).toHaveLength(5);
  });

  it("preserva los intercambios (exchanges) de cada tiempo", async () => {
    const p = MealPlan.create({
      patientId: pid,
      name: "Plan con alimentos",
      startDate: new Date(),
      kcalTarget: 1500,
      proteinTargetG: 80,
      carbsTargetG: 180,
      fatTargetG: 50,
      meals: MEAL_SLOT_ORDER.map((slot, i) => ({
        slot,
        exchanges:
          i === 0
            ? [
                { foodId: "fruta-manzana", count: 1 },
                { foodId: "leche-descremada", count: 1 },
              ]
            : i === 2
              ? [
                  { foodId: "cereal-tortilla-maiz", count: 2 },
                  { foodId: "legum-frijol", count: 1 },
                  { foodId: "aoa-pechuga-pollo", count: 2 },
                ]
              : [],
      })),
    });
    await repo.save(p);
    const found = await repo.findById(p.id);
    expect(found?.getMeal("breakfast")?.exchanges).toHaveLength(2);
    expect(found?.getMeal("lunch")?.exchanges).toHaveLength(3);
    expect(found?.getMeal("dinner")?.exchanges).toHaveLength(0);
  });

  it("filtra por patientId y ordena por fecha de inicio descendente", async () => {
    const other = PatientId.generate();
    await repo.save(make(pid, { daysAgo: 60 }));
    await repo.save(make(pid, { daysAgo: 0 }));
    await repo.save(make(pid, { daysAgo: 30 }));
    await repo.save(make(other));

    const mine = await repo.findAll({ patientId: pid });
    expect(mine).toHaveLength(3);
    expect(mine.every((m) => m.patientId.equals(pid))).toBe(true);
    expect(mine[0]?.startDate.getTime()).toBeGreaterThanOrEqual(mine[1]?.startDate.getTime() ?? 0);
  });

  it("filtra por status (uno o varios)", async () => {
    await repo.save(make(pid, { status: "draft" }));
    await repo.save(make(pid, { status: "active" }));
    await repo.save(make(pid, { status: "completed" }));

    const active = await repo.findAll({ patientId: pid, status: ["draft", "active"] });
    expect(active).toHaveLength(2);

    const drafts = await repo.findAll({ patientId: pid, status: "draft" });
    expect(drafts).toHaveLength(1);
  });

  it("excluye soft-deleted por defecto", async () => {
    const a = make(pid);
    const b = make(pid);
    await repo.save(a);
    await repo.save(b);
    await repo.delete(a.id, true);

    const items = await repo.findAll({ patientId: pid });
    expect(items).toHaveLength(1);
  });

  it("count refleja el total sin soft-deleted", async () => {
    await repo.save(make(pid));
    await repo.save(make(pid));
    expect(await repo.count({ patientId: pid })).toBe(2);
  });

  it("hard delete elimina definitivamente", async () => {
    const p = make(pid);
    await repo.save(p);
    await repo.delete(p.id, false);
    const found = await repo.findById(p.id);
    expect(found).toBeNull();
  });

  it("delete sobre id inexistente (soft) no lanza", async () => {
    await expect(repo.delete(MealPlanId.generate(), true)).resolves.not.toThrow();
  });

  it("combina patientId + status (no descarta filtros previos)", async () => {
    const other = PatientId.generate();
    await repo.save(make(pid, { status: "draft" }));
    await repo.save(make(pid, { status: "active" }));
    await repo.save(make(pid, { status: "completed" }));
    await repo.save(make(other, { status: "draft" }));
    await repo.save(make(other, { status: "active" }));

    const result = await repo.findAll({ patientId: pid, status: "draft" });
    expect(result).toHaveLength(1);
    expect(result[0]?.patientId.equals(pid)).toBe(true);
    expect(result[0]?.status).toBe("draft");
  });
});
