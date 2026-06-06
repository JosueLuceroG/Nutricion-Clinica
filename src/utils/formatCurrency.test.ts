import { describe, expect, it } from "vitest";
import { formatCurrency } from "./formatCurrency";

describe("formatCurrency", () => {
  it("formatea un número positivo con dos decimales", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formatea cero como $0.00", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formatea números negativos", () => {
    expect(formatCurrency(-500)).toBe("-$500.00");
  });

  it("redondea a 2 decimales", () => {
    expect(formatCurrency(99.999)).toBe("$100.00");
  });

  it("devuelve guion para NaN", () => {
    expect(formatCurrency(NaN)).toBe("—");
  });

  it("devuelve guion para Infinity", () => {
    expect(formatCurrency(Infinity)).toBe("—");
    expect(formatCurrency(-Infinity)).toBe("—");
  });

  it("acepta currency distinta", () => {
    const result = formatCurrency(100, "USD", "en-US");
    expect(result).toContain("100");
    expect(result).toContain(".");
  });

  it("acepta locale distinto", () => {
    const result = formatCurrency(1234.56, "MXN", "en-US");
    expect(result).toContain("1,234.56");
  });

  it("usa fallback manual si el currency es inválido", () => {
    const result = formatCurrency(250, "INVALID_FAKE_CURRENCY");
    expect(result).toBe("$250.00");
  });
});
