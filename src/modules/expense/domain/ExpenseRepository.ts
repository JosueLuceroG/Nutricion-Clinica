import type { Expense } from "./Expense";
import type { ExpenseId } from "./ExpenseId";
import type { ExpenseCategory } from "./ExpenseCategory";

export interface ExpenseQuery {
  category?: ExpenseCategory;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface ExpenseRepository {
  save(expense: Expense): Promise<void>;
  findById(id: ExpenseId): Promise<Expense | null>;
  findAll(query?: ExpenseQuery): Promise<Expense[]>;
  count(query?: ExpenseQuery): Promise<number>;
  delete(id: ExpenseId, soft?: boolean): Promise<void>;
}
