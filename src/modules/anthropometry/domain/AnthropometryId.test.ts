import { describe, it, expect } from "vitest";
import { AnthropometryId } from "./AnthropometryId";

const VALID_UUID_V7 = "0194f2a0-7b3f-7d00-8000-000000000000";

describe("AnthropometryId", () => {
  it("generate crea un UUIDv7 válido", () => {
    const id = AnthropometryId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generate produce ids distintos cada vez", () => {
    const a = AnthropometryId.generate();
    const b = AnthropometryId.generate();
    expect(a.value).not.toBe(b.value);
  });

  it("from acepta UUIDv7 válido", () => {
    const id = AnthropometryId.from(VALID_UUID_V7);
    expect(id.value).toBe(VALID_UUID_V7);
  });

  it("from rechaza UUID que no es v7", () => {
    expect(() => AnthropometryId.from("not-a-uuid")).toThrow(/AnthropometryId/);
  });

  it("from rechaza UUID v4", () => {
    expect(() => AnthropometryId.from("550e8400-e29b-41d4-a716-446655440000")).toThrow();
  });

  it("from rechaza string vacío", () => {
    expect(() => AnthropometryId.from("")).toThrow();
  });

  it("fromUnsafe no valida el formato", () => {
    const id = AnthropometryId.fromUnsafe("cualquier-valor");
    expect(id.value).toBe("cualquier-valor");
  });

  it("equals retorna true para mismo valor", () => {
    const a = AnthropometryId.from(VALID_UUID_V7);
    const b = AnthropometryId.from(VALID_UUID_V7);
    expect(a.equals(b)).toBe(true);
  });

  it("equals retorna false para valores distintos", () => {
    const a = AnthropometryId.generate();
    const b = AnthropometryId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it("toString devuelve el valor", () => {
    const id = AnthropometryId.from(VALID_UUID_V7);
    expect(id.toString()).toBe(VALID_UUID_V7);
  });
});
