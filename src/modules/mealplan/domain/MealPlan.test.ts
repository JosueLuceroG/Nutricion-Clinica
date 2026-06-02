import { describe, it, expect } from "vitest";
import { MealPlan } from "./MealPlan";
import { MealPlanId } from "./MealPlanId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { MEAL_SLOT_ORDER } from "./MealSlot";

const pid = PatientId.generate();

const build = (overrides: Partial<Parameters<typeof MealPlan.create>[0]> = {}) => {
  return MealPlan.create({
    patientId: pid,
    name: "Plan hipocalórico 1500 kcal",
    startDate: new Date("2024-06-15"),
    kcalTarget: 1500,
    proteinTargetG: 80,
    carbsTargetG: 180,
    fatTargetG: 50,
    meals: MEAL_SLOT_ORDER.map((slot) => ({ slot, exchanges: [] })),
    ...overrides,
  });
};

describe("MealPlan entity", () => {
  it("crea plan con valores por defecto (status=draft, 5 tiempos vacíos)", () => {
    const p = build();
    expect(p.status).toBe("draft");
    expect(p.meals).toHaveLength(5);
    expect(MEAL_SLOT_ORDER.every((slot) => p.getMeal(slot))).toBe(true);
    expect(p.isActive).toBe(false);
    expect(p.isCompleted).toBe(false);
  });

  it("rechaza nombre con menos de 3 caracteres", () => {
    expect(() => build({ name: "ab" })).toThrow();
  });

  it("rechaza nombre con más de 200 caracteres", () => {
    expect(() => build({ name: "x".repeat(201) })).toThrow();
  });

  it("rechaza kcal objetivo fuera de rango (800-5000)", () => {
    expect(() => build({ kcalTarget: 500 })).toThrow();
    expect(() => build({ kcalTarget: 6000 })).toThrow();
  });

  it("rechaza proteína objetivo fuera de rango (0-400)", () => {
    expect(() => build({ proteinTargetG: -1 })).toThrow();
    expect(() => build({ proteinTargetG: 500 })).toThrow();
  });

  it("rechaza fecha de fin anterior a inicio", () => {
    expect(() =>
      build({
        startDate: new Date("2024-06-15"),
        endDate: new Date("2024-01-01"),
      }),
    ).toThrow();
  });

  it("trimea name y description; normaliza vacíos a null", () => {
    const p = build({ name: "  Plan X  ", description: "  ", notes: "   " });
    expect(p.name).toBe("Plan X");
    expect(p.description).toBeNull();
    expect(p.notes).toBeNull();
  });

  it("permite asociar consultationId", () => {
    const cid = ConsultationId.generate();
    const p = build({ consultationId: cid });
    expect(p.consultationId?.equals(cid)).toBe(true);
  });

  it("withStatus transiciona draft → active → completed", () => {
    const p = build();
    const active = p.withStatus("active");
    expect(active.status).toBe("active");
    expect(active.isActive).toBe(true);
    const completed = active.withStatus("completed");
    expect(completed.isCompleted).toBe(true);
  });

  it("withStatus bloquea cambios desde completed", () => {
    const p = build();
    const completed = p.withStatus("active").withStatus("completed");
    expect(() => completed.withStatus("draft")).toThrow();
  });

  it("withMeals actualiza intercambios preservando slots", () => {
    const p = build();
    const updated = p.withMeals(
      MEAL_SLOT_ORDER.map((slot) => ({
        slot,
        exchanges: slot === "breakfast" ? [{ foodId: "fruta-manzana", count: 1 }] : [],
      })),
    );
    const bf = updated.getMeal("breakfast");
    expect(bf?.exchanges).toHaveLength(1);
    expect(updated.getMeal("lunch")?.exchanges).toHaveLength(0);
  });

  it("withMeals lanza error si está completado", () => {
    const p = build();
    const completed = p.withStatus("active").withStatus("completed");
    expect(() => completed.withMeals([])).toThrow();
  });

  it("withTargets actualiza kcal/macros", () => {
    const p = build();
    const updated = p.withTargets({ kcal: 2000, proteinG: 100 });
    expect(updated.kcalTarget).toBe(2000);
    expect(updated.proteinTargetG).toBe(100);
    expect(updated.carbsTargetG).toBe(p.carbsTargetG);
  });

  it("softDelete marca deletedAt", () => {
    const p = build();
    const deleted = p.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
  });

  it("softDelete idempotente", () => {
    const p = build();
    const first = p.softDelete();
    const second = first.softDelete();
    expect(second.deletedAt?.getTime()).toBe(first.deletedAt?.getTime());
  });

  it("reconstitute preserva todos los campos", () => {
    const id = MealPlanId.generate();
    const cid = ConsultationId.generate();
    const p = build({ id, consultationId: cid, endDate: new Date("2024-12-15") });
    const r = MealPlan.reconstitute(p.toProps());
    expect(r.id.equals(id)).toBe(true);
    expect(r.consultationId?.equals(cid)).toBe(true);
    expect(r.endDate?.toISOString()).toBe(new Date("2024-12-15").toISOString());
  });
});
