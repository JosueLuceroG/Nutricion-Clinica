import { describe, it, expect } from "vitest";
import { BiaDevice, BiaDeviceSchema, BiaReadingSchema } from "./BiaReading";
import type { BiaDeviceProps } from "./BiaReading";

describe("BiaDevice.create", () => {
  it("crea dispositivo con campos básicos", () => {
    const d = BiaDevice.create({
      name: "InBody 770",
      brand: "InBody",
      model: "770",
      type: "multifrecuencia",
      notes: "",
    });
    expect(d.name).toBe("InBody 770");
    expect(d.brand).toBe("InBody");
    expect(d.model).toBe("770");
    expect(d.type).toBe("multifrecuencia");
    expect(d.id).toBeDefined();
    expect(d.createdAt).toBeGreaterThan(0);
  });

  it("crea con solo name y type", () => {
    const d = BiaDevice.create({
      name: "Tester",
      type: "bipolar",
      brand: "",
      model: "",
      notes: "",
    });
    expect(d.name).toBe("Tester");
    expect(d.type).toBe("bipolar");
    expect(d.lastCalibration).toBeUndefined();
  });

  it("asigna lastCalibration cuando se provee", () => {
    const d = BiaDevice.create({
      name: "Tester",
      type: "bipolar",
      brand: "",
      model: "",
      lastCalibration: "2024-01-15",
      notes: "",
    });
    expect(d.lastCalibration).toBe("2024-01-15");
  });

  it("genera UUID como id", () => {
    const d = BiaDevice.create({ name: "X", type: "tetrapolar", brand: "", model: "", notes: "" });
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("BiaDevice.reconstitute", () => {
  it("preserva todas las propiedades", () => {
    const props: BiaDeviceProps = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Seca mBCA 514",
      brand: "Seca",
      model: "mBCA 514",
      type: "segmentario",
      lastCalibration: "2024-03-01",
      notes: "Calibrado",
      createdAt: 1700000000000,
    };
    const d = BiaDevice.reconstitute(props);
    expect(d.id).toBe(props.id);
    expect(d.name).toBe(props.name);
    expect(d.brand).toBe(props.brand);
    expect(d.model).toBe(props.model);
    expect(d.type).toBe(props.type);
    expect(d.lastCalibration).toBe(props.lastCalibration);
    expect(d.notes).toBe(props.notes);
    expect(d.createdAt).toBe(props.createdAt);
  });

  it("toProps() devuelve copia fiel", () => {
    const props: BiaDeviceProps = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Tester",
      type: "bipolar",
      brand: "",
      model: "",
      notes: "",
      createdAt: 1700000000000,
    };
    const d = BiaDevice.reconstitute(props);
    expect(d.toProps()).toEqual(props);
  });
});

describe("BiaDeviceSchema", () => {
  it("acepta valores válidos", () => {
    const result = BiaDeviceSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "InBody 270",
      type: "bipolar",
      createdAt: 1700000000000,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza id que no es UUID", () => {
    const result = BiaDeviceSchema.safeParse({
      id: "no-uuid",
      name: "X",
      type: "bipolar",
      createdAt: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza name vacío", () => {
    const result = BiaDeviceSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
      type: "bipolar",
      createdAt: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza type inválido", () => {
    const result = BiaDeviceSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "X",
      type: "invalid",
      createdAt: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe("BiaReadingSchema", () => {
  it("acepta lectura vacía (todo opcional)", () => {
    const result = BiaReadingSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta valores completos válidos", () => {
    const result = BiaReadingSchema.safeParse({
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      impedance: 500,
      bodyFatPct: 25,
      muscleMassKg: 30,
      boneMassKg: 2.5,
      totalBodyWaterL: 40,
      bmrKcal: 1500,
      visceralFatLevel: 8,
      phaseAngle: 5.5,
      notes: "Buen estado",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza bodyFatPct < 3", () => {
    const result = BiaReadingSchema.safeParse({ bodyFatPct: 2 });
    expect(result.success).toBe(false);
  });

  it("rechaza bodyFatPct > 80", () => {
    const result = BiaReadingSchema.safeParse({ bodyFatPct: 85 });
    expect(result.success).toBe(false);
  });

  it("rechaza impedance no positivo", () => {
    const result = BiaReadingSchema.safeParse({ impedance: 0 });
    expect(result.success).toBe(false);
    const result2 = BiaReadingSchema.safeParse({ impedance: -1 });
    expect(result2.success).toBe(false);
  });

  it("rechaza visceralFatLevel fuera de rango", () => {
    const result = BiaReadingSchema.safeParse({ visceralFatLevel: 0 });
    expect(result.success).toBe(false);
    const result2 = BiaReadingSchema.safeParse({ visceralFatLevel: 21 });
    expect(result2.success).toBe(false);
  });

  it("rechaza phaseAngle fuera de rango", () => {
    const result = BiaReadingSchema.safeParse({ phaseAngle: 0 });
    expect(result.success).toBe(false);
    const result2 = BiaReadingSchema.safeParse({ phaseAngle: 16 });
    expect(result2.success).toBe(false);
  });

  it("establece notes por defecto", () => {
    const result = BiaReadingSchema.parse({});
    expect(result.notes).toBe("");
  });
});
