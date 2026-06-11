import { describe, it, expect, beforeEach } from "vitest";
import { Expense } from "../domain/Expense";
import { ExpenseId } from "../domain/ExpenseId";
import type { ExpenseRepository, ExpenseQuery } from "../domain/ExpenseRepository";
import {
  CreateExpenseUseCase,
  UpdateExpenseUseCase,
  ListExpensesUseCase,
  GetExpenseUseCase,
  DeleteExpenseUseCase,
} from "./expenseUseCases";

class InMemoryExpenseRepo implements ExpenseRepository {
  private store = new Map<string, Expense>();

  async save(expense: Expense): Promise<void> {
    this.store.set(expense.id.toString(), expense);
  }

  async findById(id: ExpenseId): Promise<Expense | null> {
    return this.store.get(id.toString()) ?? null;
  }

  async findAll(query?: ExpenseQuery): Promise<Expense[]> {
    let items = Array.from(this.store.values()).filter((e) => !e.deletedAt);
    if (query?.category) items = items.filter((e) => e.category === query.category);
    if (query?.from) items = items.filter((e) => e.fecha >= query.from!);
    if (query?.to) items = items.filter((e) => e.fecha <= query.to!);
    items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    if (query?.offset) items = items.slice(query.offset);
    if (query?.limit) items = items.slice(0, query.limit);
    return items;
  }

  async count(query?: ExpenseQuery): Promise<number> {
    const items = await this.findAll(query);
    return items.length;
  }

  async delete(id: ExpenseId, soft = true): Promise<void> {
    if (soft) {
      const e = this.store.get(id.toString());
      if (e) this.store.set(id.toString(), e.softDelete());
    } else {
      this.store.delete(id.toString());
    }
  }
}

describe("CreateExpenseUseCase", () => {
  let repo: InMemoryExpenseRepo;
  let useCase: CreateExpenseUseCase;

  beforeEach(() => {
    repo = new InMemoryExpenseRepo();
    useCase = new CreateExpenseUseCase(repo);
  });

  it("creates and persists an expense", async () => {
    const expense = await useCase.execute({
      fecha: new Date("2026-06-01"),
      concept: "Compra de insumos",
      amount: 1500,
      category: "insumos",
    });
    expect(expense.id).toBeInstanceOf(ExpenseId);
    expect(expense.amount).toBe(1500);

    const found = await repo.findById(expense.id);
    expect(found).not.toBeNull();
    expect(found!.amount).toBe(1500);
  });
});

describe("UpdateExpenseUseCase", () => {
  let repo: InMemoryExpenseRepo;
  let useCase: UpdateExpenseUseCase;

  beforeEach(() => {
    repo = new InMemoryExpenseRepo();
    useCase = new UpdateExpenseUseCase(repo);
  });

  it("updates an existing expense", async () => {
    const created = await new CreateExpenseUseCase(repo).execute({
      fecha: new Date("2026-06-01"),
      concept: "Compra",
      amount: 1000,
      category: "insumos",
    });
    const updated = await useCase.execute(created.id, { amount: 2000, notes: "Actualizado" });
    expect(updated.amount).toBe(2000);
    expect(updated.notes).toBe("Actualizado");
  });

  it("throws on non-existent expense", async () => {
    await expect(useCase.execute(ExpenseId.generate(), { amount: 100 })).rejects.toThrow("no encontrado");
  });
});

describe("ListExpensesUseCase", () => {
  let repo: InMemoryExpenseRepo;

  beforeEach(async () => {
    repo = new InMemoryExpenseRepo();
    const create = new CreateExpenseUseCase(repo);
    await create.execute({ fecha: new Date("2026-01-01"), concept: "Enero", amount: 100, category: "servicios" });
    await create.execute({ fecha: new Date("2026-02-01"), concept: "Febrero", amount: 200, category: "insumos" });
    await create.execute({ fecha: new Date("2026-03-01"), concept: "Marzo", amount: 300, category: "insumos" });
  });

  it("lists all non-deleted expenses", async () => {
    const useCase = new ListExpensesUseCase(repo);
    const result = await useCase.execute();
    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.totalAmount).toBe(600);
  });

  it("filters by category", async () => {
    const useCase = new ListExpensesUseCase(repo);
    const result = await useCase.execute({ category: "insumos" });
    expect(result.items).toHaveLength(2);
    expect(result.totalAmount).toBe(500);
  });

  it("filters by date range", async () => {
    const useCase = new ListExpensesUseCase(repo);
    const result = await useCase.execute({ from: new Date("2026-02-01"), to: new Date("2026-02-28") });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBe(200);
  });

  it("supports pagination", async () => {
    const useCase = new ListExpensesUseCase(repo);
    const result = await useCase.execute({ limit: 2, offset: 1 });
    expect(result.items).toHaveLength(2);
  });
});

describe("GetExpenseUseCase", () => {
  it("finds an expense by id", async () => {
    const repo = new InMemoryExpenseRepo();
    const created = await new CreateExpenseUseCase(repo).execute({
      fecha: new Date(), concept: "Test", amount: 500, category: "otro",
    });
    const found = await new GetExpenseUseCase(repo).execute(created.id);
    expect(found.amount).toBe(500);
  });

  it("throws when not found", async () => {
    await expect(new GetExpenseUseCase(new InMemoryExpenseRepo()).execute(ExpenseId.generate())).rejects.toThrow("no encontrado");
  });
});

describe("DeleteExpenseUseCase", () => {
  it("soft-deletes an expense", async () => {
    const repo = new InMemoryExpenseRepo();
    const created = await new CreateExpenseUseCase(repo).execute({
      fecha: new Date(), concept: "Test", amount: 100, category: "otro",
    });
    await new DeleteExpenseUseCase(repo).execute(created.id);
    const all = await repo.findAll();
    expect(all).toHaveLength(0);
  });
});
