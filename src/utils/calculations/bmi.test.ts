import { describe, it, expect } from "vitest";
import { calculateBMI, classifyBMI } from "./bmi";

describe("calculateBMI", () => {
  it("calcula BMI normal para adulto promedio", () => {
    const result = calculateBMI({ weightKg: 70, heightM: 1.75 });
    expect(result.value).toBeCloseTo(22.86, 2);
    expect(result.category).toBe("normal");
  });

  it("clasifica bajo peso", () => {
    const result = calculateBMI({ weightKg: 50, heightM: 1.7 });
    expect(result.category).toBe("underweight");
  });

  it("clasifica sobrepeso", () => {
    const result = calculateBMI({ weightKg: 80, heightM: 1.7 });
    expect(result.value).toBeCloseTo(27.68, 2);
    expect(result.category).toBe("overweight");
  });

  it("clasifica obesidad grado I", () => {
    const result = calculateBMI({ weightKg: 95, heightM: 1.7 });
    expect(result.category).toBe("obesity-i");
  });

  it("clasifica obesidad grado II", () => {
    const result = calculateBMI({ weightKg: 110, heightM: 1.7 });
    expect(result.category).toBe("obesity-ii");
  });

  it("clasifica obesidad grado III (mórbida)", () => {
    const result = calculateBMI({ weightKg: 140, heightM: 1.7 });
    expect(result.category).toBe("obesity-iii");
  });

  it("rechaza peso negativo", () => {
    expect(() => calculateBMI({ weightKg: -1, heightM: 1.7 })).toThrow(RangeError);
  });

  it("rechaza peso cero", () => {
    expect(() => calculateBMI({ weightKg: 0, heightM: 1.7 })).toThrow(RangeError);
  });

  it("rechaza altura cero", () => {
    expect(() => calculateBMI({ weightKg: 70, heightM: 0 })).toThrow(RangeError);
  });

  it("rechaza altura fuera de rango plausible", () => {
    expect(() => calculateBMI({ weightKg: 70, heightM: 3 })).toThrow(RangeError);
    expect(() => calculateBMI({ weightKg: 70, heightM: 0.3 })).toThrow(RangeError);
  });

  it("rechaza NaN", () => {
    expect(() => calculateBMI({ weightKg: NaN, heightM: 1.7 })).toThrow(RangeError);
  });

  it("classifyBMI cubre todos los rangos OMS", () => {
    expect(classifyBMI(17)).toBe("underweight");
    expect(classifyBMI(18.5)).toBe("normal");
    expect(classifyBMI(24.99)).toBe("normal");
    expect(classifyBMI(25)).toBe("overweight");
    expect(classifyBMI(29.99)).toBe("overweight");
    expect(classifyBMI(30)).toBe("obesity-i");
    expect(classifyBMI(34.99)).toBe("obesity-i");
    expect(classifyBMI(35)).toBe("obesity-ii");
    expect(classifyBMI(39.99)).toBe("obesity-ii");
    expect(classifyBMI(40)).toBe("obesity-iii");
  });
});
