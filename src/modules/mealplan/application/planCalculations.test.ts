import { describe, it, expect } from "vitest";
import { foodExchangeNutrition, planDailyNutrition, planVsTarget } from "./planCalculations";
import { MealPlan } from "../domain/MealPlan";
import { PatientId } from "@modules/patient/domain/PatientId";
import { MEAL_SLOT_ORDER } from "../domain/MealSlot";

const pid = PatientId.generate();

const buildPlan = (kcalTarget: number) =>
  MealPlan.create({
    patientId: pid,
    name: "Plan de prueba",
    startDate: new Date("2024-06-15"),
    kcalTarget,
    proteinTargetG: 100,
    carbsTargetG: 200,
    fatTargetG: 60,
    meals: MEAL_SLOT_ORDER.map((slot) => ({
      slot,
      exchanges:
        slot === "breakfast"
          ? [
              { foodId: "fruta-manzana", count: 1 },
              { foodId: "avena" as never, count: 2 }, // inexistente, pero cuenta como 0
              { foodId: "leche-descremada", count: 1 },
            ]
          : slot === "lunch"
            ? [
                { foodId: "cereal-tortilla-maiz", count: 2 },
                { foodId: "legum-frijol", count: 1 },
                { foodId: "aoa-pechuga-pollo", count: 2 },
                { foodId: "aceite-oliva", count: 1 },
              ]
            : slot === "dinner"
              ? [
                  { foodId: "verdura-acelga", count: 1 },
                  { foodId: "aoa-pescado-blanco", count: 1 },
                  { foodId: "cereal-arroz", count: 1 },
                ]
              : [],
    })),
  });

const buildGenerousPlan = (kcalTarget: number) =>
  MealPlan.create({
    patientId: pid,
    name: "Plan generoso",
    startDate: new Date("2024-06-15"),
    kcalTarget,
    proteinTargetG: 200,
    carbsTargetG: 400,
    fatTargetG: 150,
    meals: MEAL_SLOT_ORDER.map((slot, i) => ({
      slot,
      exchanges: Array.from({ length: 6 + i }, () => ({ foodId: "cereal-tortilla-maiz" as never, count: 3 })),
    })),
  });

describe("planCalculations", () => {
  it("foodExchangeNutrition retorna 0 si el alimento no existe", () => {
    const n = foodExchangeNutrition("no-existe" as never, 5);
    expect(n).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("foodExchangeNutrition suma correctamente", () => {
    const n = foodExchangeNutrition("fruta-manzana", 3);
    expect(n.kcal).toBe(180);
    expect(n.carbsG).toBe(45);
  });

  it("planDailyNutrition suma kcal/macros de los 3 tiempos con alimentos", () => {
    const plan = buildPlan(1500);
    const totals = planDailyNutrition(plan);
    // breakfast: manzana(60) + 0 + leche desc(80) = 140 kcal
    // lunch: tortilla×2(140) + frijol(80) + pechuga×2(80) + aceite(45) = 345 kcal
    // dinner: acelga(25) + pescado(40) + arroz(70) = 135 kcal
    expect(totals.kcal).toBe(140 + 345 + 135);
    expect(totals.proteinG).toBeGreaterThan(0);
    expect(totals.carbsG).toBeGreaterThan(0);
    expect(totals.fatG).toBeGreaterThan(0);
  });

  it("planVsTarget retorna negativo si déficit", () => {
    const plan = buildPlan(2000);
    const diff = planVsTarget(plan);
    expect(diff.kcal).toBeLessThan(0);
  });

  it("planVsTarget retorna positivo si excedente (plan generoso)", () => {
    const plan = buildGenerousPlan(800);
    const diff = planVsTarget(plan);
    expect(diff.kcal).toBeGreaterThan(0);
  });

  it("planDailyNutrition de un plan vacío es 0", () => {
    const plan = MealPlan.create({
      patientId: pid,
      name: "Plan vacío",
      startDate: new Date(),
      kcalTarget: 1500,
      proteinTargetG: 80,
      carbsTargetG: 180,
      fatTargetG: 50,
      meals: MEAL_SLOT_ORDER.map((slot) => ({ slot, exchanges: [] })),
    });
    const totals = planDailyNutrition(plan);
    expect(totals.kcal).toBe(0);
    expect(totals.proteinG).toBe(0);
    expect(totals.carbsG).toBe(0);
    expect(totals.fatG).toBe(0);
  });
});
