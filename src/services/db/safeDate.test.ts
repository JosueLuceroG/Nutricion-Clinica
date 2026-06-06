import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { safeDate, toIsoStringSafe, isInvalidDateValue } from "./safeDate";

describe("safeDate", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parsea string ISO válido", () => {
    const d = safeDate("2024-05-15T00:00:00.000Z");
    expect(d).toBeInstanceOf(Date);
    expect((d as Date).toISOString()).toBe("2024-05-15T00:00:00.000Z");
  });

  it("parsea number (timestamp) válido", () => {
    const ts = 1715731200000;
    const d = safeDate(ts);
    expect(d).toBeInstanceOf(Date);
    expect((d as Date).getTime()).toBe(ts);
  });

  it("clona Date válida", () => {
    const original = new Date("2024-05-15");
    const d = safeDate(original);
    expect(d).toBeInstanceOf(Date);
    expect((d as Date).getTime()).toBe(original.getTime());
    expect(d).not.toBe(original);
  });

  it("devuelve fallback new Date() para null", () => {
    const d = safeDate(null);
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN((d as Date).getTime())).toBe(false);
  });

  it("devuelve fallback new Date() para undefined", () => {
    const d = safeDate(undefined);
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN((d as Date).getTime())).toBe(false);
  });

  it("devuelve fallback new Date() para string vacío", () => {
    const d = safeDate("");
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN((d as Date).getTime())).toBe(false);
  });

  it("devuelve fallback new Date() para string inválido", () => {
    const d = safeDate("not a date");
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN((d as Date).getTime())).toBe(false);
  });

  it("devuelve fallback new Date() para Invalid Date", () => {
    const d = safeDate(new Date("invalid"));
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN((d as Date).getTime())).toBe(false);
  });

  it("devuelve fallback explícito null para campos opcionales", () => {
    expect(safeDate(null, null)).toBeNull();
    expect(safeDate(undefined, null)).toBeNull();
    expect(safeDate("", null)).toBeNull();
    expect(safeDate("invalid", null)).toBeNull();
  });

  it("devuelve fallback explícito Date para campos opcionales con default", () => {
    const fb = new Date("2020-01-01");
    expect(safeDate(null, fb)).toBe(fb);
    expect(safeDate("invalid", fb)).toBe(fb);
  });

  it("avisa por consola la primera vez que ve una fecha inválida por key", () => {
    safeDate(null, null, "x.y");
    safeDate("invalid", null, "x.y");
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect((console.warn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("x.y");
  });
});

describe("toIsoStringSafe", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializa Date válida a ISO", () => {
    expect(toIsoStringSafe(new Date("2024-05-15T00:00:00.000Z"))).toBe("2024-05-15T00:00:00.000Z");
  });

  it("devuelve null para null/undefined sin fallback", () => {
    expect(toIsoStringSafe(null)).toBeNull();
    expect(toIsoStringSafe(undefined)).toBeNull();
  });

  it("devuelve null para Invalid Date sin fallback", () => {
    expect(toIsoStringSafe(new Date("invalid"))).toBeNull();
  });

  it("usa fallback string explícito si la fecha es inválida", () => {
    const fb = "2024-01-01T00:00:00.000Z";
    expect(toIsoStringSafe(new Date("invalid"), fb)).toBe(fb);
  });

  it("usa fallback null explícito si se pasa", () => {
    expect(toIsoStringSafe(new Date("invalid"), null)).toBeNull();
    expect(toIsoStringSafe(null, null)).toBeNull();
  });
});

describe("isInvalidDateValue", () => {
  it("detecta null/undefined/empty como inválido", () => {
    expect(isInvalidDateValue(null)).toBe(true);
    expect(isInvalidDateValue(undefined)).toBe(true);
    expect(isInvalidDateValue("")).toBe(true);
  });

  it("detecta Invalid Date como inválido", () => {
    expect(isInvalidDateValue(new Date("invalid"))).toBe(true);
  });

  it("acepta string ISO parseable", () => {
    expect(isInvalidDateValue("2024-05-15")).toBe(false);
    expect(isInvalidDateValue("2024-05-15T00:00:00.000Z")).toBe(false);
  });

  it("acepta Date válida", () => {
    expect(isInvalidDateValue(new Date())).toBe(false);
  });

  it("rechaza strings no parseables", () => {
    expect(isInvalidDateValue("not a date")).toBe(true);
    expect(isInvalidDateValue("2024-13-45")).toBe(true);
  });

  it("rechaza tipos raros", () => {
    expect(isInvalidDateValue({})).toBe(true);
    expect(isInvalidDateValue(42)).toBe(false);
  });
});
