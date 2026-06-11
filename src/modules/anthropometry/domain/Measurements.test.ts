import { describe, it, expect } from "vitest";
import { Weight, Height, Circumference, Skinfold } from "./Measurements";

describe("Weight", () => {
  it("crea peso válido en kg", () => {
    const w = Weight.fromKg(70);
    expect(w.toKg()).toBe(70);
  });

  it("rechaza peso negativo", () => {
    expect(() => Weight.fromKg(-1)).toThrow();
  });

  it("rechaza peso cero", () => {
    expect(() => Weight.fromKg(0)).toThrow();
  });

  it("rechaza peso > 500 kg", () => {
    expect(() => Weight.fromKg(600)).toThrow();
  });

  it("rechaza NaN e Infinity", () => {
    expect(() => Weight.fromKg(NaN)).toThrow();
    expect(() => Weight.fromKg(Infinity)).toThrow();
  });

  it("convierte a gramos", () => {
    const w = Weight.fromKg(70.5);
    expect(w.toGrams()).toBe(70500);
  });

  it("equals retorna true para mismo peso", () => {
    const a = Weight.fromKg(70);
    const b = Weight.fromKg(70);
    expect(a.equals(b)).toBe(true);
  });

  it("equals retorna false para pesos distintos", () => {
    const a = Weight.fromKg(70);
    const b = Weight.fromKg(80);
    expect(a.equals(b)).toBe(false);
  });
});

describe("Height", () => {
  it("crea altura desde centímetros", () => {
    const h = Height.fromCentimeters(170);
    expect(h.toCentimeters()).toBe(170);
    expect(h.toMeters()).toBeCloseTo(1.7);
  });

  it("crea altura desde metros", () => {
    const h = Height.fromMeters(1.75);
    expect(h.toMeters()).toBe(1.75);
    expect(h.toCentimeters()).toBe(175);
  });

  it("rechaza altura < 50 cm", () => {
    expect(() => Height.fromCentimeters(10)).toThrow();
  });

  it("rechaza altura > 250 cm", () => {
    expect(() => Height.fromCentimeters(300)).toThrow();
  });

  it("rechaza altura < 0.5 m", () => {
    expect(() => Height.fromMeters(0.1)).toThrow();
  });

  it("rechaza altura > 2.5 m", () => {
    expect(() => Height.fromMeters(3)).toThrow();
  });

  it("rechaza NaN", () => {
    expect(() => Height.fromCentimeters(NaN)).toThrow();
  });

  it("equals retorna true para misma altura", () => {
    const a = Height.fromCentimeters(170);
    const b = Height.fromCentimeters(170);
    expect(a.equals(b)).toBe(true);
  });

  it("equals retorna false para alturas distintas", () => {
    const a = Height.fromCentimeters(170);
    const b = Height.fromCentimeters(180);
    expect(a.equals(b)).toBe(false);
  });
});

describe("Circumference", () => {
  it("crea circunferencia válida", () => {
    const c = Circumference.fromCm(80);
    expect(c.toCm()).toBe(80);
  });

  it("rechaza valor negativo", () => {
    expect(() => Circumference.fromCm(-1)).toThrow();
  });

  it("rechaza valor < 5 cm", () => {
    expect(() => Circumference.fromCm(2)).toThrow();
  });

  it("rechaza valor > 300 cm", () => {
    expect(() => Circumference.fromCm(350)).toThrow();
  });

  it("rechaza NaN", () => {
    expect(() => Circumference.fromCm(NaN)).toThrow();
  });

  it("equals retorna true para misma circunferencia", () => {
    const a = Circumference.fromCm(80);
    const b = Circumference.fromCm(80);
    expect(a.equals(b)).toBe(true);
  });

  it("equals retorna false para valores distintos", () => {
    const a = Circumference.fromCm(80);
    const b = Circumference.fromCm(90);
    expect(a.equals(b)).toBe(false);
  });
});

describe("Skinfold", () => {
  it("crea pliegue válido", () => {
    const s = Skinfold.fromMm(10);
    expect(s.toMm()).toBe(10);
  });

  it("rechaza valor negativo", () => {
    expect(() => Skinfold.fromMm(-1)).toThrow();
  });

  it("rechaza valor > 80 mm", () => {
    expect(() => Skinfold.fromMm(85)).toThrow();
  });

  it("acepta valor cero", () => {
    const s = Skinfold.fromMm(0);
    expect(s.toMm()).toBe(0);
  });

  it("rechaza NaN", () => {
    expect(() => Skinfold.fromMm(NaN)).toThrow();
  });

  it("equals retorna true para mismo pliegue", () => {
    const a = Skinfold.fromMm(15);
    const b = Skinfold.fromMm(15);
    expect(a.equals(b)).toBe(true);
  });

  it("equals retorna false para valores distintos", () => {
    const a = Skinfold.fromMm(10);
    const b = Skinfold.fromMm(20);
    expect(a.equals(b)).toBe(false);
  });
});
