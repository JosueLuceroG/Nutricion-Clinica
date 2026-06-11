import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieExpenseRepository } from "./DexieExpenseRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Expense } from "../domain/Expense";
import { ExpenseId } from "../domain/ExpenseId";
import type { ExpenseCategory } from "../domain/ExpenseCategory";

const makeExpense = (overrides: Partial<{
  fecha: Date;
  concept: string;
  amount: number;
  category: ExpenseCategory;
}> = {}) => {
  return Expense.create({
    fecha: overrides.fecha ?? new Date("2026-06-01"),
    concept: overrides.concept ?? "Compra de insumos",
    amount: overrides.amount ?? 1500,
    category: overrides.category ?? "insumos",
  });
};

describe("DexieExpenseRepository", () => {
  let repo: DexieExpenseRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieExpenseRepository(db);
  });

  it("guarda y recupera un gasto por id", async () => {
    const e = makeExpense();
    await repo.save(e);

    const found = await repo.findById(e.id);
    expect(found).not.toBeNull();
    expect(found?.concept).toBe("Compra de insumos");
    expect(found?.amount).toBe(1500);
    expect(found?.id.equals(e.id)).toBe(true);
  });

  it("retorna null cuando el gasto no existe", async () => {
    const found = await repo.findById(ExpenseId.generate());
    expect(found).toBeNull();
  });

  it("findAll retorna todos los gastos", async () => {
    await repo.save(makeExpense({ concept: "Gasto A" }));
    await repo.save(makeExpense({ concept: "Gasto B" }));
    await repo.save(makeExpense({ concept: "Gasto C" }));

    const all = await repo.findAll();
    expect(all).toHaveLength(3);
  });

  it("filtra por categoría", async () => {
    await repo.save(makeExpense({ category: "insumos", concept: "Insumos" }));
    await repo.save(makeExpense({ category: "equipo", concept: "Equipo" }));
    await repo.save(makeExpense({ category: "nomina", concept: "Nómina" }));

    const results = await repo.findAll({ category: "equipo" });
    expect(results).toHaveLength(1);
    expect(results[0]?.concept).toBe("Equipo");
  });

  it("filtra por rango de fechas (from/to)", async () => {
    await repo.save(makeExpense({ fecha: new Date("2026-06-01"), concept: "Junio" }));
    await repo.save(makeExpense({ fecha: new Date("2026-07-15"), concept: "Julio" }));
    await repo.save(makeExpense({ fecha: new Date("2026-08-20"), concept: "Agosto" }));

    const results = await repo.findAll({
      from: new Date("2026-07-01"),
      to: new Date("2026-08-01"),
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.concept).toBe("Julio");
  });

  it("pagina resultados (limit/offset)", async () => {
    for (let i = 0; i < 10; i++) {
      await repo.save(makeExpense({ concept: `Gasto ${i}`, amount: 100 + i }));
    }

    const first = await repo.findAll({ limit: 3, offset: 0 });
    const second = await repo.findAll({ limit: 3, offset: 3 });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(first[0]?.id.equals(second[0]?.id ?? ExpenseId.generate())).toBe(false);
  });

  it("count retorna el número total de gastos", async () => {
    await repo.save(makeExpense({ concept: "AA" }));
    await repo.save(makeExpense({ concept: "BB" }));
    expect(await repo.count()).toBe(2);
  });

  it("soft delete marca deletedAt", async () => {
    const e = makeExpense();
    await repo.save(e);
    await repo.delete(e.id, true);

    const found = await repo.findById(e.id);
    expect(found).not.toBeNull();
    expect(found?.deletedAt).not.toBeNull();
  });

  it("hard delete elimina definitivamente", async () => {
    const e = makeExpense();
    await repo.save(e);
    await repo.delete(e.id, false);

    const found = await repo.findById(e.id);
    expect(found).toBeNull();
  });

  it("save actualiza un gasto existente", async () => {
    const e = makeExpense({ amount: 500 });
    await repo.save(e);

    const updated = e.withDetails({ amount: 800 });
    await repo.save(updated);

    const found = await repo.findById(e.id);
    expect(found?.amount).toBe(800);
  });

  it("count respeta filtro de categoría", async () => {
    await repo.save(makeExpense({ category: "insumos" }));
    await repo.save(makeExpense({ category: "equipo" }));
    await repo.save(makeExpense({ category: "insumos", concept: "Más insumos" }));

    expect(await repo.count({ category: "insumos" })).toBe(2);
    expect(await repo.count({ category: "equipo" })).toBe(1);
  });
});
