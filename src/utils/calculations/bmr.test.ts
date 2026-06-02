import { describe, it, expect } from "vitest";
import { calculateBMR, calculateBMRBoth } from "./bmr";

describe("calculateBMR - Mifflin-St Jeor", () => {
  it("calcula BMR para hombre 30 años, 80kg, 180cm", () => {
    const result = calculateBMR(
      { sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 },
      "mifflin-st-jeor",
    );
    expect(result.value).toBe(1780);
    expect(result.formula).toBe("mifflin-st-jeor");
  });

  it("calcula BMR para mujer 25 años, 60kg, 165cm", () => {
    const result = calculateBMR(
      { sex: "female", weightKg: 60, heightCm: 165, ageYears: 25 },
      "mifflin-st-jeor",
    );
    expect(result.value).toBe(1345);
  });

  it("mujer siempre tiene BMR menor que hombre con mismos datos", () => {
    const female = calculateBMR(
      { sex: "female", weightKg: 70, heightCm: 170, ageYears: 30 },
      "mifflin-st-jeor",
    );
    const male = calculateBMR(
      { sex: "male", weightKg: 70, heightCm: 170, ageYears: 30 },
      "mifflin-st-jeor",
    );
    expect(female.value).toBeLessThan(male.value);
  });

  it("BMR disminuye con la edad", () => {
    const young = calculateBMR(
      { sex: "male", weightKg: 80, heightCm: 180, ageYears: 25 },
      "mifflin-st-jeor",
    );
    const old = calculateBMR(
      { sex: "male", weightKg: 80, heightCm: 180, ageYears: 65 },
      "mifflin-st-jeor",
    );
    expect(old.value).toBeLessThan(young.value);
  });

  it("rechaza peso inválido", () => {
    expect(() =>
      calculateBMR({ sex: "male", weightKg: 0, heightCm: 180, ageYears: 30 }),
    ).toThrow(RangeError);
  });

  it("rechaza edad negativa", () => {
    expect(() =>
      calculateBMR({ sex: "male", weightKg: 80, heightCm: 180, ageYears: -1 }),
    ).toThrow(RangeError);
  });
});

describe("calculateBMR - Harris-Benedict", () => {
  it("calcula BMR para hombre 30 años, 80kg, 180cm", () => {
    const result = calculateBMR(
      { sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 },
      "harris-benedict",
    );
    expect(result.value).toBe(1854);
  });

  it("calcula BMR para mujer 25 años, 60kg, 165cm", () => {
    const result = calculateBMR(
      { sex: "female", weightKg: 60, heightCm: 165, ageYears: 25 },
      "harris-benedict",
    );
    expect(result.value).toBe(1405);
  });
});

describe("calculateBMRBoth", () => {
  it("devuelve ambas fórmulas con la misma entrada", () => {
    const both = calculateBMRBoth({
      sex: "male",
      weightKg: 75,
      heightCm: 175,
      ageYears: 35,
    });
    expect(both["mifflin-st-jeor"].formula).toBe("mifflin-st-jeor");
    expect(both["harris-benedict"].formula).toBe("harris-benedict");
    expect(both["mifflin-st-jeor"].value).toBeGreaterThan(0);
    expect(both["harris-benedict"].value).toBeGreaterThan(0);
  });
});
