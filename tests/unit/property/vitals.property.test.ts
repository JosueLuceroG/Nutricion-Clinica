import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Vitals } from "@modules/consultation/domain/Vitals";

/**
 * Property tests para Vitals (Q-06).
 *
 * Invariantes cubiertos:
 * 1. Roundtrip JSON: toJSON(v) → fromJSON(...) es identidad para v válidas.
 * 2. Válvula de escape: cualquier input todo-null produce isEmpty=true.
 * 3. NaN/Infinity siempre se normalizan a null (no propagan al VO).
 * 4. Cualquier valor fuera de rango (entero o flotante) lanza.
 * 5. from() con todos los campos null equivale a empty().
 */

const validSys = fc.integer({ min: 50, max: 260 });
const validDia = fc.integer({ min: 30, max: 180 });
const validHr = fc.integer({ min: 20, max: 220 });
const validTemp = fc.double({
  min: 30,
  max: 45,
  noNaN: true,
  noDefaultInfinity: true,
});

const validVitalsArb = fc.record({
  systolicMmHg: validSys,
  diastolicMmHg: validDia,
  heartRateBpm: validHr,
  temperatureC: validTemp,
});

const allNullVitalsArb = fc.record({
  systolicMmHg: fc.constant(null),
  diastolicMmHg: fc.constant(null),
  heartRateBpm: fc.constant(null),
  temperatureC: fc.constant(null),
});

const outOfRangeSys = fc.oneof(
  fc.integer({ max: 49 }),
  fc.integer({ min: 261 }),
);
const outOfRangeDia = fc.oneof(
  fc.integer({ max: 29 }),
  fc.integer({ min: 181 }),
);
const outOfRangeHr = fc.oneof(
  fc.integer({ max: 19 }),
  fc.integer({ min: 221 }),
);
const outOfRangeTemp = fc.oneof(
  fc.double({ min: -1000, max: 29.9, noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: 45.1, max: 1000, noNaN: true, noDefaultInfinity: true }),
);

describe("Vitals — property tests", () => {
  it("toJSON → fromJSON es identidad para vitals válidas", () => {
    fc.assert(
      fc.property(validVitalsArb, (input) => {
        const v = Vitals.from(input);
        const restored = Vitals.fromJSON(v.toJSON());
        expect(restored.systolicMmHg).toBe(v.systolicMmHg);
        expect(restored.diastolicMmHg).toBe(v.diastolicMmHg);
        expect(restored.heartRateBpm).toBe(v.heartRateBpm);
        expect(restored.temperatureC).toBe(v.temperatureC);
      }),
      { numRuns: 200 },
    );
  });

  it("todos los campos null producen isEmpty=true", () => {
    fc.assert(
      fc.property(allNullVitalsArb, (input) => {
        const v = Vitals.from(input);
        expect(v.isEmpty).toBe(true);
      }),
    );
  });

  it("from() con todos los campos null equivale a empty()", () => {
    fc.assert(
      fc.property(allNullVitalsArb, (input) => {
        const v = Vitals.from(input);
        const e = Vitals.empty();
        expect(v.systolicMmHg).toBe(e.systolicMmHg);
        expect(v.diastolicMmHg).toBe(e.diastolicMmHg);
        expect(v.heartRateBpm).toBe(e.heartRateBpm);
        expect(v.temperatureC).toBe(e.temperatureC);
      }),
    );
  });

  it("NaN/Infinity en cualquier campo siempre se normaliza a null", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(Number.NaN),
          fc.constant(Number.POSITIVE_INFINITY),
          fc.constant(Number.NEGATIVE_INFINITY),
        ),
        fc.constantFrom("systolicMmHg", "diastolicMmHg", "heartRateBpm", "temperatureC"),
        (badValue, field) => {
          const input = { [field]: badValue } as Parameters<typeof Vitals.from>[0];
          const v = Vitals.from(input);
          expect(v.isEmpty).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("cualquier systolic fuera de [50,260] lanza", () => {
    fc.assert(
      fc.property(outOfRangeSys, (bad) => {
        expect(() => Vitals.from({ systolicMmHg: bad })).toThrow();
      }),
    );
  });

  it("cualquier diastolic fuera de [30,180] lanza", () => {
    fc.assert(
      fc.property(outOfRangeDia, (bad) => {
        expect(() => Vitals.from({ diastolicMmHg: bad })).toThrow();
      }),
    );
  });

  it("cualquier heartRate fuera de [20,220] lanza", () => {
    fc.assert(
      fc.property(outOfRangeHr, (bad) => {
        expect(() => Vitals.from({ heartRateBpm: bad })).toThrow();
      }),
    );
  });

  it("cualquier temperature fuera de [30,45] lanza", () => {
    fc.assert(
      fc.property(outOfRangeTemp, (bad) => {
        expect(() => Vitals.from({ temperatureC: bad })).toThrow();
      }),
    );
  });

  it("enteros dentro de rango se preservan como enteros (no se truncan a 0)", () => {
    fc.assert(
      fc.property(validSys, validDia, validHr, (sys, dia, hr) => {
        const v = Vitals.from({
          systolicMmHg: sys,
          diastolicMmHg: dia,
          heartRateBpm: hr,
        });
        expect(v.systolicMmHg).toBe(sys);
        expect(v.diastolicMmHg).toBe(dia);
        expect(v.heartRateBpm).toBe(hr);
      }),
    );
  });

  it("temperatura se redondea a 1 decimal (no más, no menos)", () => {
    fc.assert(
      fc.property(validTemp, (t) => {
        const v = Vitals.from({ temperatureC: t });
        const stored = v.temperatureC ?? 0;
        const rounded = Math.round(stored * 10) / 10;
        expect(stored).toBeCloseTo(rounded, 10);
        const decimalPart = stored.toString().split(".")[1] ?? "";
        expect(decimalPart.length).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("fromJSON(null/undefined/object vacío) produce VO vacío, nunca lanza", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constant(null), fc.constant(undefined), fc.object()), (junk) => {
        const v = Vitals.fromJSON(junk);
        expect(v.isEmpty).toBe(true);
      }),
    );
  });

  it("campos opcionales (no provistos) se vuelven null", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({} as Record<string, never>),
          fc.constant({ systolicMmHg: undefined }),
          fc.constant({ diastolicMmHg: undefined, heartRateBpm: undefined }),
        ),
        (junk) => {
          const v = Vitals.from(junk as Parameters<typeof Vitals.from>[0]);
          expect(v.systolicMmHg).toBeNull();
          expect(v.diastolicMmHg).toBeNull();
          expect(v.heartRateBpm).toBeNull();
          expect(v.temperatureC).toBeNull();
        },
      ),
    );
  });
});
