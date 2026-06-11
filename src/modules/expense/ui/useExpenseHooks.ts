import { useLiveQuery } from "dexie-react-hooks";
import { db as defaultDb, type NutriClinicaDB } from "@services/db/dexieSchema";
import { expenseRowToDomain } from "../infrastructure/expenseMapper";
import type { ExpenseCategory } from "../domain/ExpenseCategory";

export interface ExpenseFilters {
  category?: ExpenseCategory;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export const useExpenses = (
  filters: ExpenseFilters = {},
  dbInstance: NutriClinicaDB = defaultDb,
) => {
  const { category, from, to, limit } = filters;

  const items = useLiveQuery(
    async () => {
      let rows = await dbInstance.expenses.toArray();

      if (category) {
        rows = rows.filter((r) => r.category === category);
      }
      if (from) {
        const fromMs = from.getTime();
        rows = rows.filter((r) => new Date(r.expense_date).getTime() >= fromMs);
      }
      if (to) {
        const toMs = to.getTime();
        rows = rows.filter((r) => new Date(r.expense_date).getTime() <= toMs);
      }

      rows.sort((a, b) => {
        const da = new Date(b.expense_date).getTime();
        const db_ = new Date(a.expense_date).getTime();
        return da - db_;
      });

      if (limit) {
        rows = rows.slice(0, limit);
      }

      return rows.map(expenseRowToDomain);
    },
    [dbInstance, category, from?.getTime(), to?.getTime(), limit],
    [],
  );

  return items;
};
