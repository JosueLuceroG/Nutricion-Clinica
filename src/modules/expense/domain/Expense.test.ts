import { describe, it, expect } from "vitest";
import { Expense } from "./Expense";
import { ExpenseId } from "./ExpenseId";
import { EXPENSE_CATEGORIES, isExpenseCategory, EXPENSE_CATEGORY_LABELS } from "./ExpenseCategory";

describe("ExpenseId", () => {
  it("generates a unique id", () => {
    const a = ExpenseId.generate();
    const b = ExpenseId.generate();
    expect(a.value).not.toBe(b.value);
  });

  it("fromUnsafe returns the same value", () => {
    const id = ExpenseId.fromUnsafe("test-123");
    expect(id.toString()).toBe("test-123");
  });

  it("equals compares by value", () => {
    const a = ExpenseId.fromUnsafe("x");
    const b = ExpenseId.fromUnsafe("x");
    const c = ExpenseId.fromUnsafe("y");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe("ExpenseCategory", () => {
  it("includes all expected categories", () => {
    expect(EXPENSE_CATEGORIES).toContain("insumos");
    expect(EXPENSE_CATEGORIES).toContain("equipo");
    expect(EXPENSE_CATEGORIES).toContain("nomina");
    expect(EXPENSE_CATEGORIES).toContain("otro");
  });

  it("isExpenseCategory validates correctly", () => {
    expect(isExpenseCategory("insumos")).toBe(true);
    expect(isExpenseCategory("invalid")).toBe(false);
    expect(isExpenseCategory(undefined)).toBe(false);
  });

  it("has labels for all categories", () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(EXPENSE_CATEGORY_LABELS[cat]).toBeDefined();
      expect(EXPENSE_CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });
});

describe("Expense", () => {
  const validInput = {
    fecha: new Date("2026-06-01"),
    concept: "Compra de insumos",
    amount: 1500,
    category: "insumos" as const,
  };

  it("creates an expense with valid input", () => {
    const e = Expense.create(validInput);
    expect(e.id).toBeInstanceOf(ExpenseId);
    expect(e.fecha).toEqual(validInput.fecha);
    expect(e.concept).toBe("Compra de insumos");
    expect(e.amount).toBe(1500);
    expect(e.currency).toBe("MXN");
    expect(e.category).toBe("insumos");
    expect(e.notes).toBeNull();
    expect(e.sucursalId).toBeNull();
    expect(e.deletedAt).toBeNull();
    expect(e.createdAt).toBeInstanceOf(Date);
    expect(e.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects negative amount", () => {
    expect(() => Expense.create({ ...validInput, amount: -1 })).toThrow(">= 0");
  });

  it("rejects non-finite amount", () => {
    expect(() => Expense.create({ ...validInput, amount: NaN })).toThrow(">= 0");
  });

  it("rejects empty concept", () => {
    expect(() => Expense.create({ ...validInput, concept: "" })).toThrow("2 caracteres");
  });

  it("rejects short concept", () => {
    expect(() => Expense.create({ ...validInput, concept: "A" })).toThrow("2 caracteres");
  });

  it("trims concept whitespace", () => {
    const e = Expense.create({ ...validInput, concept: "  Insumos  " });
    expect(e.concept).toBe("Insumos");
  });

  it("truncates long concept to 200 chars", () => {
    const long = "A".repeat(300);
    const e = Expense.create({ ...validInput, concept: long });
    expect(e.concept.length).toBe(200);
  });

  it("accepts optional fields", () => {
    const e = Expense.create({
      ...validInput,
      currency: "USD",
      notes: "Nota opcional",
      sucursalId: "suc-1",
    });
    expect(e.currency).toBe("USD");
    expect(e.notes).toBe("Nota opcional");
    expect(e.sucursalId).toBe("suc-1");
  });

  it("reconstitutes from props", () => {
    const original = Expense.create(validInput);
    const props = original.toProps();
    const restored = Expense.reconstitute(props);
    expect(restored.id.equals(original.id)).toBe(true);
    expect(restored.amount).toBe(original.amount);
    expect(restored.concept).toBe(original.concept);
  });

  describe("withDetails", () => {
    it("updates fields", () => {
      const e = Expense.create(validInput);
      const updated = e.withDetails({ amount: 2000, notes: "Actualizado" });
      expect(updated.amount).toBe(2000);
      expect(updated.notes).toBe("Actualizado");
      expect(updated.concept).toBe(e.concept);
    });

    it("throws on deleted expense", () => {
      const e = Expense.create(validInput).softDelete();
      expect(() => e.withDetails({ amount: 100 })).toThrow("eliminado");
    });
  });

  describe("softDelete", () => {
    it("marks as deleted", () => {
      const e = Expense.create(validInput);
      const deleted = e.softDelete(new Date("2026-07-01"));
      expect(deleted.deletedAt).toBeInstanceOf(Date);
    });

    it("idempotent when already deleted", () => {
      const e = Expense.create(validInput).softDelete();
      const again = e.softDelete();
      expect(again.deletedAt).toEqual(e.deletedAt);
    });
  });
});
