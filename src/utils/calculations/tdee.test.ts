import { describe, it, expect } from "vitest";
import { calculateTDEE, distributionToGrams, ActivityLevel } from "./tdee";

describe("calculateTDEE", () => {
  it("factor sedentario (1.2)", () => {
    expect(calculateTDEE(1500, ActivityLevel.sedentary)).toBe(1800);
  });

  it("factor ligero (1.375)", () => {
    expect(calculateTDEE(1500, ActivityLevel.light)).toBe(2063);
  });

  it("factor moderado (1.55)", () => {
    expect(calculateTDEE(1500, ActivityLevel.moderate)).toBe(2325);
  });

  it("factor muy activo (1.725)", () => {
    expect(calculateTDEE(1500, ActivityLevel.active)).toBe(2588);
  });

  it("factor extremadamente activo (1.9)", () => {
    expect(calculateTDEE(1500, ActivityLevel.veryActive)).toBe(2850);
  });

  it("rechaza BMR cero o negativo", () => {
    expect(() => calculateTDEE(0, ActivityLevel.sedentary)).toThrow(RangeError);
    expect(() => calculateTDEE(-100, ActivityLevel.sedentary)).toThrow(RangeError);
  });

  it("rechaza factor desconocido", () => {
    expect(() => calculateTDEE(1500, 2.5 as never)).toThrow(RangeError);
  });
});

describe("distributionToGrams", () => {
  it("distribución 50/20/30 sobre 2000 kcal", () => {
    const result = distributionToGrams(2000, { carbsPct: 50, proteinPct: 20, fatPct: 30 });
    expect(result.kcalFromCarbs).toBe(1000);
    expect(result.kcalFromProtein).toBe(400);
    expect(result.kcalFromFat).toBe(600);
    expect(result.carbsG).toBe(250);
    expect(result.proteinG).toBe(100);
    expect(result.fatG).toBe(67);
  });

  it("rechaza distribución que no suma 100%", () => {
    expect(() =>
      distributionToGrams(2000, { carbsPct: 50, proteinPct: 20, fatPct: 20 }),
    ).toThrow(RangeError);
  });

  it("rechaza porcentajes negativos", () => {
    expect(() =>
      distributionToGrams(2000, { carbsPct: -10, proteinPct: 60, fatPct: 50 }),
    ).toThrow(RangeError);
  });

  it("rechaza porcentajes mayores a 100", () => {
    expect(() =>
      distributionToGrams(2000, { carbsPct: 110, proteinPct: 0, fatPct: -10 }),
    ).toThrow(RangeError);
  });

  it("maneja distribución alta en proteína (atleta)", () => {
    const result = distributionToGrams(3000, { carbsPct: 40, proteinPct: 30, fatPct: 30 });
    expect(result.proteinG).toBe(225);
    expect(result.fatG).toBe(100);
  });
});
