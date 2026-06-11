import type { Expense } from "../domain/Expense";
import type { ExpenseId } from "../domain/ExpenseId";
import type { ExpenseQuery, ExpenseRepository } from "../domain/ExpenseRepository";
import { expenseDomainToRow, expenseRowToDomain } from "./expenseMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async save(expense: Expense): Promise<void> {
    const row = expenseDomainToRow(expense);
    await this.db.expenses.put(row);
  }

  async findById(id: ExpenseId): Promise<Expense | null> {
    const row = await this.db.expenses.get(id.toString());
    if (!row) return null;
    return expenseRowToDomain(row);
  }

  async findAll(query?: ExpenseQuery): Promise<Expense[]> {
    let rows = await this.db.expenses.toArray();

    if (query?.category) {
      rows = rows.filter((r) => r.category === query.category);
    }
    if (query?.from) {
      const fromMs = query.from.getTime();
      rows = rows.filter((r) => new Date(r.expense_date).getTime() >= fromMs);
    }
    if (query?.to) {
      const toMs = query.to.getTime();
      rows = rows.filter((r) => new Date(r.expense_date).getTime() <= toMs);
    }

    rows.sort((a, b) => {
      const da = new Date(b.expense_date).getTime();
      const db_ = new Date(a.expense_date).getTime();
      return da - db_;
    });

    if (query?.offset) {
      rows = rows.slice(query.offset);
    }
    if (query?.limit) {
      rows = rows.slice(0, query.limit);
    }

    return rows.map(expenseRowToDomain);
  }

  async count(query?: ExpenseQuery): Promise<number> {
    const items = await this.findAll(query);
    return items.length;
  }

  async delete(id: ExpenseId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.findById(id);
      if (!existing) return;
      const deleted = existing.softDelete();
      await this.save(deleted);
    } else {
      await this.db.expenses.delete(id.toString());
    }
  }
}
