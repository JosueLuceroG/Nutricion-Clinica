import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PatientId } from "@modules/patient/domain/PatientId";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { MealPlanId } from "@modules/mealplan/domain/MealPlanId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";

/**
 * Property tests para branded IDs (Q-06).
 *
 * Tipos cubiertos: PatientId, ConsultationId, MealPlanId, LabPanelId,
 *                  AnthropometryId.
 *
 * Invariantes:
 * 1. generate() siempre produce un string que pasa from() (UUIDv7 válido).
 * 2. N llamadas a generate() producen N IDs distintos.
 * 3. from(s).toString() === s para cualquier s UUIDv7 válido.
 * 4. from() lanza para cualquier s que NO matchee el regex UUIDv7.
 * 5. fromUnsafe() nunca lanza, ni con strings malformados.
 * 6. equals es reflexivo, simétrico.
 * 7. UUIDv7 ordering: IDs generados en secuencia son lexicográficamente
 *    ordenables por timestamp (los primeros 48 bits son timestamp ms).
 */

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validUuidV7Arb = fc
  .tuple(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc
      .tuple(
        fc.constantFrom("7"),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
      )
      .map(([a, b]) => a + b),
    fc
      .tuple(
        fc.constantFrom("8", "9", "a", "b"),
        fc.hexaString({ minLength: 3, maxLength: 3 }),
      )
      .map(([a, b]) => a + b),
    fc.hexaString({ minLength: 12, maxLength: 12 }),
  )
  .map((parts) => parts.join("-"));

const nonUuidV7Arb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 36 }),
  fc.string({ minLength: 37, maxLength: 100 }),
  fc
    .tuple(
      fc.hexaString({ minLength: 8, maxLength: 8 }),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc
        .tuple(fc.constantFrom("0", "1", "2", "3", "4", "5", "6"), fc.hexaString({ minLength: 3, maxLength: 3 }))
        .map(([a, b]) => a + b),
      fc.hexaString({ minLength: 4, maxLength: 4 }),
      fc.hexaString({ minLength: 12, maxLength: 12 }),
    )
    .map((parts) => parts.join("-")),
);

interface IdConstructor<T> {
  generate(): T;
  from(value: string): T;
  fromUnsafe(value: string): T;
  equals(a: T, b: T): boolean;
  toString(id: T): string;
}

const idFactories: Record<string, IdConstructor<unknown>> = {
  PatientId: {
    generate: () => PatientId.generate(),
    from: (s) => PatientId.from(s),
    fromUnsafe: (s) => PatientId.fromUnsafe(s),
    equals: (a, b) => (a as PatientId).equals(b as PatientId),
    toString: (id) => (id as PatientId).toString(),
  },
  ConsultationId: {
    generate: () => ConsultationId.generate(),
    from: (s) => ConsultationId.from(s),
    fromUnsafe: (s) => ConsultationId.fromUnsafe(s),
    equals: (a, b) => (a as ConsultationId).equals(b as ConsultationId),
    toString: (id) => (id as ConsultationId).toString(),
  },
  MealPlanId: {
    generate: () => MealPlanId.generate(),
    from: (s) => MealPlanId.from(s),
    fromUnsafe: (s) => MealPlanId.fromUnsafe(s),
    equals: (a, b) => (a as MealPlanId).equals(b as MealPlanId),
    toString: (id) => (id as MealPlanId).toString(),
  },
  LabPanelId: {
    generate: () => LabPanelId.generate(),
    from: (s) => LabPanelId.from(s),
    fromUnsafe: (s) => LabPanelId.fromUnsafe(s),
    equals: (a, b) => (a as LabPanelId).equals(b as LabPanelId),
    toString: (id) => (id as LabPanelId).toString(),
  },
  AnthropometryId: {
    generate: () => AnthropometryId.generate(),
    from: (s) => AnthropometryId.from(s),
    fromUnsafe: (s) => AnthropometryId.fromUnsafe(s),
    equals: (a, b) => (a as AnthropometryId).equals(b as AnthropometryId),
    toString: (id) => (id as AnthropometryId).toString(),
  },
};

for (const [name, factory] of Object.entries(idFactories)) {
  describe(`${name} — property tests`, () => {
    it("generate() produce un string que pasa from()", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const id = factory.generate();
          const value = factory.toString(id);
          expect(UUID_V7_REGEX.test(value)).toBe(true);
          expect(() => factory.from(value)).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it("N generate() consecutivos producen N IDs distintos", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 50 }), (n) => {
          const ids = Array.from({ length: n }, () => factory.generate());
          const values = ids.map(factory.toString);
          const unique = new Set(values);
          expect(unique.size).toBe(values.length);
        }),
      );
    });

    it("from(s).toString() preserva cualquier UUIDv7 válido", () => {
      fc.assert(
        fc.property(validUuidV7Arb, (s) => {
          const id = factory.from(s);
          expect(factory.toString(id)).toBe(s);
        }),
        { numRuns: 200 },
      );
    });

    it("from() lanza para cualquier string que no sea UUIDv7", () => {
      fc.assert(
        fc.property(nonUuidV7Arb, (bad) => {
          expect(() => factory.from(bad)).toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it("fromUnsafe() nunca lanza (ni con strings malformados o vacíos)", () => {
      fc.assert(
        fc.property(nonUuidV7Arb, (junk) => {
          expect(() => factory.fromUnsafe(junk)).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it("equals es reflexivo: a.equals(a) === true", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const a = factory.generate();
          expect(factory.equals(a, a)).toBe(true);
        }),
      );
    });

    it("equals es simétrico: a.equals(b) === b.equals(a)", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const a = factory.generate();
          const b = factory.generate();
          expect(factory.equals(a, b)).toBe(factory.equals(b, a));
        }),
      );
    });

    it("equals entre IDs distintos es false", () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const a = factory.generate();
          const b = factory.generate();
          expect(factory.equals(a, b)).toBe(false);
        }),
      );
    });

    it("fromUnsafe y from(s) producen IDs iguales cuando s es válido", () => {
      fc.assert(
        fc.property(validUuidV7Arb, (s) => {
          const a = factory.from(s);
          const b = factory.fromUnsafe(s);
          expect(factory.equals(a, b)).toBe(true);
        }),
      );
    });
  });
}

describe("UUIDv7 — ordenamiento temporal", () => {
  it("el prefijo de timestamp (12 hex chars) es no-decreciente en N generate() consecutivos", () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 50 }), (n) => {
        const ids = Array.from({ length: n }, () => PatientId.generate());
        const timestamps = ids.map((id) => id.toString().slice(0, 12));
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i] >= timestamps[i - 1]).toBe(true);
        }
      }),
      { numRuns: 20 },
    );
  });
});
