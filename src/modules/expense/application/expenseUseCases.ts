import { Expense, type ExpenseCreate } from "../domain/Expense";
import type { ExpenseId } from "../domain/ExpenseId";
import type { ExpenseCategory } from "../domain/ExpenseCategory";
import type { ExpenseRepository } from "../domain/ExpenseRepository";

export class CreateExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(input: ExpenseCreate): Promise<Expense> {
    const expense = Expense.create(input);
    await this.repo.save(expense);
    return expense;
  }
}

export class UpdateExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(
    id: ExpenseId,
    input: Parameters<Expense["withDetails"]>[0],
  ): Promise<Expense> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error("Gasto no encontrado.");
    const updated = existing.withDetails(input);
    await this.repo.save(updated);
    return updated;
  }
}

export class ListExpensesUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(query?: {
    category?: ExpenseCategory;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const items = await this.repo.findAll(query);
    const total = await this.repo.count(query);
    const totalAmount = items.reduce((sum, e) => sum + e.amount, 0);
    return { items, total, totalAmount };
  }
}

export class GetExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(id: ExpenseId): Promise<Expense> {
    const found = await this.repo.findById(id);
    if (!found) throw new Error("Gasto no encontrado.");
    return found;
  }
}

export class DeleteExpenseUseCase {
  constructor(private readonly repo: ExpenseRepository) {}

  async execute(id: ExpenseId, soft = true): Promise<void> {
    await this.repo.delete(id, soft);
  }
}
