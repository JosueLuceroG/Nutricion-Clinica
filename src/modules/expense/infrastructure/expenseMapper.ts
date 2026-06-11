import { Expense, type ExpenseProps } from "../domain/Expense";
import { ExpenseId } from "../domain/ExpenseId";
import { isExpenseCategory } from "../domain/ExpenseCategory";
import { safeDate, toIsoStringSafe } from "@services/db/safeDate";

export interface ExpenseRow {
  id: string;
  expense_date: string;
  concept: string;
  amount: number;
  currency: string;
  category: string;
  notes: string | null;
  sucursal_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const expenseRowToDomain = (row: ExpenseRow): Expense => {
  const props: ExpenseProps = {
    id: ExpenseId.fromUnsafe(row.id),
    fecha: safeDate(row.expense_date, undefined)!,
    concept: row.concept ?? "",
    amount: typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : 0,
    currency: row.currency ?? "MXN",
    category: isExpenseCategory(row.category) ? row.category : "otro",
    notes: row.notes,
    sucursalId: row.sucursal_id,
    createdAt: safeDate(row.created_at, undefined)!,
    updatedAt: safeDate(row.updated_at, undefined)!,
    deletedAt: safeDate(row.deleted_at, null),
  };
  return Expense.reconstitute(props);
};

export const expenseDomainToRow = (e: Expense): ExpenseRow => {
  return {
    id: e.id.toString(),
    expense_date: toIsoStringSafe(e.fecha, new Date().toISOString())!,
    concept: e.concept,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    notes: e.notes,
    sucursal_id: e.sucursalId,
    created_at: toIsoStringSafe(e.createdAt, new Date().toISOString())!,
    updated_at: toIsoStringSafe(e.updatedAt, new Date().toISOString())!,
    deleted_at: toIsoStringSafe(e.deletedAt, null),
  };
};
