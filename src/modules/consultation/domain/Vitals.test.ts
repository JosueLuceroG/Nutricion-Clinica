import { describe, it, expect } from "vitest";
import { Vitals } from "./Vitals";

describe("Vitals", () => {
  it("crea VO vacío con isEmpty=true", () => {
    const v = Vitals.empty();
    expect(v.systolicMmHg).toBeNull();
    expect(v.diastolicMmHg).toBeNull();
    expect(v.heartRateBpm).toBeNull();
    expect(v.temperatureC).toBeNull();
    expect(v.isEmpty).toBe(true);
  });

  it("from() acepta campos opcionales y descarta nulls", () => {
    const v = Vitals.from({ systolicMmHg: 120, diastolicMmHg: 80 });
    expect(v.systolicMmHg).toBe(120);
    expect(v.diastolicMmHg).toBe(80);
    expect(v.heartRateBpm).toBeNull();
    expect(v.isEmpty).toBe(false);
  });

  it("redondea temperatura a 1 decimal", () => {
    const v = Vitals.from({ temperatureC: 36.567 });
    expect(v.temperatureC).toBe(36.6);
  });

  it("redondea enteros (frecuencia, presión)", () => {
    const v = Vitals.from({ heartRateBpm: 72.7, systolicMmHg: 119.4 });
    expect(v.heartRateBpm).toBe(73);
    expect(v.systolicMmHg).toBe(119);
  });

  it("rechaza valores fuera de rango", () => {
    expect(() => Vitals.from({ systolicMmHg: 30 })).toThrow();
    expect(() => Vitals.from({ heartRateBpm: 300 })).toThrow();
    expect(() => Vitals.from({ temperatureC: 50 })).toThrow();
  });

  it("convierte NaN a null", () => {
    const v = Vitals.from({ systolicMmHg: NaN });
    expect(v.systolicMmHg).toBeNull();
    expect(v.isEmpty).toBe(true);
  });

  it("toJSON/fromJSON roundtrip", () => {
    const original = Vitals.from({ systolicMmHg: 120, diastolicMmHg: 80, heartRateBpm: 72, temperatureC: 36.5 });
    const json = original.toJSON();
    const restored = Vitals.fromJSON(json);
    expect(restored.systolicMmHg).toBe(120);
    expect(restored.diastolicMmHg).toBe(80);
    expect(restored.heartRateBpm).toBe(72);
    expect(restored.temperatureC).toBe(36.5);
  });

  it("fromJSON(null) devuelve VO vacío", () => {
    const v = Vitals.fromJSON(null);
    expect(v.isEmpty).toBe(true);
  });
});
