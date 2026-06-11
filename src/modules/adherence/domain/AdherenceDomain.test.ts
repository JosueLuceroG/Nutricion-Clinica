import { describe, it, expect } from "vitest";
import { AdherenceIdSchema, createAdherenceId, adherenceIdFrom, adherenceIdFromUnsafe } from "./AdherenceId";
import { AdherenceSourceSchema, AdherenceSourceLabel, AdherenceTendencySchema, AdherenceTendencyLabel, BarrierTypeSchema, BarrierTypeLabel } from "./AdherenceTypes";
import { AdherenceIndexSchema, AdherenceIndex, calculateAdherenceIndex } from "./AdherenceIndex";
import { AdherenceRecordSchema, AdherenceRecord } from "./AdherenceRecord";
import { BarrierEventSchema, BarrierEvent } from "./BarrierEvent";
import { AdherenceNotFoundError } from "./AdherenceRepository";

describe("AdherenceId", () => {
  it("genera un UUID válido", () => {
    const id = createAdherenceId();
    expect(AdherenceIdSchema.safeParse(id).success).toBe(true);
  });

  it("from acepta un UUID válido", () => {
    const uuid = crypto.randomUUID();
    const id = adherenceIdFrom(uuid);
    expect(id).toBe(uuid);
  });

  it("from rechaza un UUID inválido", () => {
    expect(() => adherenceIdFrom("no-es-uuid")).toThrow();
  });

  it("fromUnsafe no valida", () => {
    const id = adherenceIdFromUnsafe("cualquier-cosa");
    expect(id).toBe("cualquier-cosa");
  });

  it("dos IDs con el mismo valor son iguales", () => {
    const uuid = crypto.randomUUID();
    const a = adherenceIdFrom(uuid);
    const b = adherenceIdFrom(uuid);
    expect(a === b).toBe(true);
  });
});

describe("AdherenceTypes", () => {
  it("tiene labels para todas las fuentes de adherencia", () => {
    const values = AdherenceSourceSchema.options;
    for (const v of values) {
      expect(AdherenceSourceLabel[v]).toBeDefined();
      expect(AdherenceSourceLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todas las tendencias", () => {
    const values = AdherenceTendencySchema.options;
    for (const v of values) {
      expect(AdherenceTendencyLabel[v]).toBeDefined();
      expect(AdherenceTendencyLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los tipos de barrera", () => {
    const values = BarrierTypeSchema.options;
    for (const v of values) {
      expect(BarrierTypeLabel[v]).toBeDefined();
      expect(BarrierTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("exhaustividad: todas las fuentes tienen label", () => {
    expect(Object.keys(AdherenceSourceLabel).sort()).toEqual(
      [...AdherenceSourceSchema.options].sort(),
    );
  });

  it("exhaustividad: todas las tendencias tienen label", () => {
    expect(Object.keys(AdherenceTendencyLabel).sort()).toEqual(
      [...AdherenceTendencySchema.options].sort(),
    );
  });

  it("exhaustividad: todos los tipos de barrera tienen label", () => {
    expect(Object.keys(BarrierTypeLabel).sort()).toEqual(
      [...BarrierTypeSchema.options].sort(),
    );
  });
});

describe("AdherenceIndex", () => {
  const validProps = () => ({
    id: crypto.randomUUID(),
    patientId: crypto.randomUUID(),
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    scoreMenu: 85,
    scoreWater: 70,
    scoreActivity: 60,
    scoreSupplements: 90,
    scoreSleep: 75,
    scoreGlobal: 77,
    tendency: "estable" as const,
    calculatedAt: Date.now(),
  });

  it("acepta props válidos en el schema", () => {
    const result = AdherenceIndexSchema.safeParse(validProps());
    expect(result.success).toBe(true);
  });

  it("rechaza scoreMenu fuera de rango (negativo)", () => {
    const result = AdherenceIndexSchema.safeParse({ ...validProps(), scoreMenu: -1 });
    expect(result.success).toBe(false);
  });

  it("rechaza scoreMenu fuera de rango (>100)", () => {
    const result = AdherenceIndexSchema.safeParse({ ...validProps(), scoreMenu: 101 });
    expect(result.success).toBe(false);
  });

  it("rechaza id que no es UUID", () => {
    const result = AdherenceIndexSchema.safeParse({ ...validProps(), id: "no-uuid" });
    expect(result.success).toBe(false);
  });

  it("rechaza periodStart con formato inválido", () => {
    const result = AdherenceIndexSchema.safeParse({ ...validProps(), periodStart: "01-01-2026" });
    expect(result.success).toBe(false);
  });

  it("rechaza tendency inválida", () => {
    const result = AdherenceIndexSchema.safeParse({ ...validProps(), tendency: "inexistente" });
    expect(result.success).toBe(false);
  });

  it("create asigna id y calculatedAt", () => {
    const index = AdherenceIndex.create({
      patientId: validProps().patientId,
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      scoreMenu: 85, scoreWater: 70, scoreActivity: 60,
      scoreSupplements: 90, scoreSleep: 75, scoreGlobal: 77,
      tendency: "estable",
    });
    expect(index.id).toBeTruthy();
    expect(index.patientId).toBeTruthy();
    expect(index.calculatedAt).toBeGreaterThan(0);
    expect(index.scoreGlobal).toBe(77);
  });

  it("reconstitute restaura desde props", () => {
    const props = validProps();
    const index = AdherenceIndex.reconstitute(props);
    expect(index.id).toBe(props.id);
    expect(index.scoreMenu).toBe(85);
    expect(index.scoreGlobal).toBe(77);
    expect(index.tendency).toBe("estable");
  });

  it("toProps devuelve copia de las props", () => {
    const original = AdherenceIndex.reconstitute(validProps());
    const props = original.toProps();
    expect(props.id).toBe(original.id);
    expect(props.scoreWater).toBe(original.scoreWater);
  });
});

describe("calculateAdherenceIndex", () => {
  it("retorna ceros y estable para lista vacía", () => {
    const result = calculateAdherenceIndex([]);
    expect(result.scoreMenu).toBe(0);
    expect(result.scoreWater).toBe(0);
    expect(result.scoreActivity).toBe(0);
    expect(result.scoreSupplements).toBe(0);
    expect(result.scoreSleep).toBe(0);
    expect(result.scoreGlobal).toBe(0);
    expect(result.tendency).toBe("estable");
  });

  it("calcula promedios correctamente", () => {
    const records = [
      AdherenceRecord.reconstitute({
        id: createAdherenceId(),
        patientId: crypto.randomUUID(),
        date: "2026-01-01",
        source: "consulta",
        adherenceMenu: 100, adherenceWater: 80,
        adherenceActivity: 60, adherenceSupplements: 40, adherenceSleep: 20,
        intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "", notes: "",
        createdAt: Date.now(), updatedAt: Date.now(),
      }),
      AdherenceRecord.reconstitute({
        id: createAdherenceId(),
        patientId: crypto.randomUUID(),
        date: "2026-01-08",
        source: "app",
        adherenceMenu: 80, adherenceWater: 60,
        adherenceActivity: 40, adherenceSupplements: 20, adherenceSleep: 0,
        intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "", notes: "",
        createdAt: Date.now(), updatedAt: Date.now(),
      }),
    ];
    const result = calculateAdherenceIndex(records);
    expect(result.scoreMenu).toBe(90);
    expect(result.scoreWater).toBe(70);
    expect(result.scoreActivity).toBe(50);
    expect(result.scoreSupplements).toBe(30);
    expect(result.scoreSleep).toBe(10);
  });

  it("calcula scoreGlobal ponderado", () => {
    const records = [
      AdherenceRecord.reconstitute({
        id: createAdherenceId(),
        patientId: crypto.randomUUID(),
        date: "2026-01-01",
        source: "consulta",
        adherenceMenu: 100, adherenceWater: 100,
        adherenceActivity: 100, adherenceSupplements: 100, adherenceSleep: 100,
        intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "", notes: "",
        createdAt: Date.now(), updatedAt: Date.now(),
      }),
    ];
    const result = calculateAdherenceIndex(records);
    expect(result.scoreGlobal).toBe(100);
  });
});

describe("AdherenceRecord", () => {
  const validProps = () => ({
    id: createAdherenceId(),
    patientId: crypto.randomUUID(),
    date: "2026-01-15",
    source: "consulta" as const,
    adherenceMenu: 85, adherenceWater: 70,
    adherenceActivity: 60, adherenceSupplements: 90, adherenceSleep: 75,
    intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "", notes: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it("acepta props válidos en el schema", () => {
    const result = AdherenceRecordSchema.safeParse(validProps());
    expect(result.success).toBe(true);
  });

  it("rechaza date con formato inválido", () => {
    const result = AdherenceRecordSchema.safeParse({ ...validProps(), date: "15-01-2026" });
    expect(result.success).toBe(false);
  });

  it("rechaza adherenceMenu > 100", () => {
    const result = AdherenceRecordSchema.safeParse({ ...validProps(), adherenceMenu: 150 });
    expect(result.success).toBe(false);
  });

  it("aplica defaults para campos opcionales", () => {
    const result = AdherenceRecordSchema.parse({
      ...validProps(),
      adherenceMenu: undefined,
      hungerAvg: undefined,
      satietyAvg: undefined,
    });
    expect(result.adherenceMenu).toBe(0);
  });

  it("create asigna createdAt y updatedAt", () => {
    const record = AdherenceRecord.create({
      id: createAdherenceId(),
      patientId: crypto.randomUUID(),
      date: "2026-01-15",
      source: "consulta",
      adherenceMenu: 80, adherenceWater: 70,
      adherenceActivity: 60, adherenceSupplements: 50, adherenceSleep: 40,
      intercurrentEvents: "", barriers: "", facilitators: "", mealsLogged: "", notes: "",
    });
    expect(record.createdAt).toBeGreaterThan(0);
    expect(record.updatedAt).toBeGreaterThan(0);
    expect(record.source).toBe("consulta");
    expect(record.adherenceMenu).toBe(80);
  });

  it("reconstitute restaura desde props", () => {
    const props = validProps();
    const record = AdherenceRecord.reconstitute(props);
    expect(record.id).toBe(props.id);
    expect(record.patientId).toBe(props.patientId);
    expect(record.date).toBe("2026-01-15");
  });

  it("with actualiza campos y updatedAt", () => {
    const record = AdherenceRecord.reconstitute({ ...validProps(), updatedAt: 1 });
    const updated = record.with({ adherenceMenu: 95, notes: "Mejoró" });
    expect(updated.adherenceMenu).toBe(95);
    expect(updated.notes).toBe("Mejoró");
    expect(updated.updatedAt).toBeGreaterThan(record.updatedAt);
  });

  it("toProps devuelve copia de las props", () => {
    const original = AdherenceRecord.reconstitute(validProps());
    const props = original.toProps();
    expect(props.id).toBe(original.id);
    expect(props.adherenceWater).toBe(70);
  });
});

describe("BarrierEvent", () => {
  const validProps = () => ({
    id: crypto.randomUUID(),
    patientId: crypto.randomUUID(),
    type: "tiempo" as const,
    description: "Falta de tiempo para cocinar",
    date: "2026-02-10",
    actionTaken: "",
    createdAt: Date.now(),
  });

  it("acepta props válidos en el schema", () => {
    const result = BarrierEventSchema.safeParse(validProps());
    expect(result.success).toBe(true);
  });

  it("rechaza type inválido", () => {
    const result = BarrierEventSchema.safeParse({ ...validProps(), type: "invalido" });
    expect(result.success).toBe(false);
  });

  it("rechaza description vacía", () => {
    const result = BarrierEventSchema.safeParse({ ...validProps(), description: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza date con formato inválido", () => {
    const result = BarrierEventSchema.safeParse({ ...validProps(), date: "2026/02/10" });
    expect(result.success).toBe(false);
  });

  it("create asigna id y createdAt", () => {
    const event = BarrierEvent.create({
      patientId: crypto.randomUUID(),
      type: "emocional",
      description: "Estrés laboral",
      date: "2026-02-15",
      actionTaken: "",
    });
    expect(event.id).toBeTruthy();
    expect(event.createdAt).toBeGreaterThan(0);
    expect(event.type).toBe("emocional");
    expect(event.description).toBe("Estrés laboral");
  });

  it("reconstitute restaura desde props", () => {
    const props = validProps();
    const event = BarrierEvent.reconstitute(props);
    expect(event.id).toBe(props.id);
    expect(event.type).toBe("tiempo");
    expect(event.date).toBe("2026-02-10");
  });

  it("resolutionDate es opcional", () => {
    const event = BarrierEvent.reconstitute(validProps());
    expect(event.resolutionDate).toBeUndefined();

    const resolved = BarrierEvent.reconstitute({
      ...validProps(),
      resolutionDate: "2026-02-20",
    });
    expect(resolved.resolutionDate).toBe("2026-02-20");
  });
});

describe("AdherenceRepository - error classes", () => {
  it("AdherenceNotFoundError tiene el mensaje correcto", () => {
    const id = createAdherenceId();
    const error = new AdherenceNotFoundError(id);
    expect(error.message).toContain(id);
    expect(error.name).toBe("AdherenceNotFoundError");
    expect(error.id).toBe(id);
    expect(error).toBeInstanceOf(Error);
  });
});
