import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  Weight,
  Height,
  Circumference,
  Skinfold,
} from "@modules/anthropometry/domain/Measurements";

/**
 * Property tests para Measurements (Q-06).
 *
 * VOs cubiertos: Weight, Height, Circumference, Skinfold.
 *
 * Invariantes:
 * 1. Roundtrip: fromX(toX(v)) === v para cualquier v en rango.
 * 2. Reflexividad: fromKg(kg).equals(Weight.fromKg(kg)) siempre true.
 * 3. Cualquier valor fuera de rango (entero/flotante/NaN/Infinity) lanza.
 * 4. NaN/Infinity nunca se aceptan (validación Zod).
 * 5. Conversiones entre unidades preservan el valor (Height cm ↔ m).
 */

const validWeightArb = fc.double({
  min: 0.01,
  max: 500,
  noNaN: true,
  noDefaultInfinity: true,
});

const validHeightCmArb = fc.double({
  min: 50,
  max: 250,
  noNaN: true,
  noDefaultInfinity: true,
});

const validCircumferenceCmArb = fc.double({
  min: 5,
  max: 300,
  noNaN: true,
  noDefaultInfinity: true,
});

const validSkinfoldMmArb = fc.double({
  min: 0,
  max: 80,
  noNaN: true,
  noDefaultInfinity: true,
});

const nonFiniteArb = fc.oneof(
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
);

describe("Weight — property tests", () => {
  it("fromKg(kg).toKg() preserva cualquier kg válido", () => {
    fc.assert(
      fc.property(validWeightArb, (kg) => {
        const w = Weight.fromKg(kg);
        expect(w.toKg()).toBe(kg);
      }),
      { numRuns: 200 },
    );
  });

  it("fromKg es reflexivo: fromKg(kg).equals(fromKg(kg))", () => {
    fc.assert(
      fc.property(validWeightArb, (kg) => {
        const a = Weight.fromKg(kg);
        const b = Weight.fromKg(kg);
        expect(a.equals(b)).toBe(true);
      }),
    );
  });

  it("toGrams() = round(kg * 1000) para cualquier kg válido", () => {
    fc.assert(
      fc.property(validWeightArb, (kg) => {
        const w = Weight.fromKg(kg);
        expect(w.toGrams()).toBe(Math.round(kg * 1000));
      }),
    );
  });

  it("cualquier kg fuera de (0, 500] lanza", () => {
    const outOfRange = fc.oneof(
      fc.double({ min: -1000, max: 0, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 500.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
    );
    fc.assert(
      fc.property(outOfRange, (bad) => {
        expect(() => Weight.fromKg(bad)).toThrow();
      }),
    );
  });

  it("NaN/Infinity siempre lanzan", () => {
    fc.assert(
      fc.property(nonFiniteArb, (bad) => {
        expect(() => Weight.fromKg(bad)).toThrow();
      }),
    );
  });
});

describe("Height — property tests", () => {
  it("fromCentimeters(cm).toCentimeters() preserva cualquier cm válido", () => {
    fc.assert(
      fc.property(validHeightCmArb, (cm) => {
        const h = Height.fromCentimeters(cm);
        expect(h.toCentimeters()).toBe(Math.round(cm));
      }),
      { numRuns: 200 },
    );
  });

  it("fromCentimeters(cm).toMeters() preserva m con 4 decimales", () => {
    fc.assert(
      fc.property(validHeightCmArb, (cm) => {
        const h = Height.fromCentimeters(cm);
        const m = h.toMeters();
        expect(m).toBeCloseTo(cm / 100, 4);
      }),
    );
  });

  it("roundtrip cm → m → cm preserva el valor", () => {
    fc.assert(
      fc.property(validHeightCmArb, (cm) => {
        const h1 = Height.fromCentimeters(cm);
        const m = h1.toMeters();
        const h2 = Height.fromMeters(m);
        expect(h2.toCentimeters()).toBe(h1.toCentimeters());
      }),
    );
  });

  it("cualquier cm fuera de [50, 250] lanza", () => {
    const outOfRange = fc.oneof(
      fc.double({ min: -1000, max: 49.9, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 250.1, max: 10000, noNaN: true, noDefaultInfinity: true }),
    );
    fc.assert(
      fc.property(outOfRange, (bad) => {
        expect(() => Height.fromCentimeters(bad)).toThrow();
      }),
    );
  });

  it("cualquier m fuera de [0.5, 2.5] lanza", () => {
    const outOfRange = fc.oneof(
      fc.double({ min: 0, max: 0.49, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 2.51, max: 10, noNaN: true, noDefaultInfinity: true }),
    );
    fc.assert(
      fc.property(outOfRange, (bad) => {
        expect(() => Height.fromMeters(bad)).toThrow();
      }),
    );
  });
});

describe("Circumference — property tests", () => {
  it("fromCm(cm).toCm() preserva cualquier cm válido", () => {
    fc.assert(
      fc.property(validCircumferenceCmArb, (cm) => {
        const c = Circumference.fromCm(cm);
        expect(c.toCm()).toBe(cm);
      }),
      { numRuns: 200 },
    );
  });

  it("fromCm es reflexivo", () => {
    fc.assert(
      fc.property(validCircumferenceCmArb, (cm) => {
        const a = Circumference.fromCm(cm);
        const b = Circumference.fromCm(cm);
        expect(a.equals(b)).toBe(true);
      }),
    );
  });

  it("cualquier cm fuera de [5, 300] lanza", () => {
    const outOfRange = fc.oneof(
      fc.double({ min: -1000, max: 4.9, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 300.1, max: 10000, noNaN: true, noDefaultInfinity: true }),
    );
    fc.assert(
      fc.property(outOfRange, (bad) => {
        expect(() => Circumference.fromCm(bad)).toThrow();
      }),
    );
  });
});

describe("Skinfold — property tests", () => {
  it("fromMm(mm).toMm() preserva cualquier mm válido (incluyendo 0)", () => {
    fc.assert(
      fc.property(validSkinfoldMmArb, (mm) => {
        const s = Skinfold.fromMm(mm);
        expect(s.toMm()).toBe(mm);
      }),
      { numRuns: 200 },
    );
  });

  it("fromMm acepta exactamente 0 (no negativo)", () => {
    expect(() => Skinfold.fromMm(0)).not.toThrow();
  });

  it("cualquier mm fuera de [0, 80] lanza", () => {
    const outOfRange = fc.oneof(
      fc.double({ min: -1000, max: -0.01, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 80.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
    );
    fc.assert(
      fc.property(outOfRange, (bad) => {
        expect(() => Skinfold.fromMm(bad)).toThrow();
      }),
    );
  });
});
