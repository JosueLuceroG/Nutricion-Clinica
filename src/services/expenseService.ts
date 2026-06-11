import { DexieExpenseRepository } from "@modules/expense/infrastructure/DexieExpenseRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreateExpenseUseCase,
  UpdateExpenseUseCase,
  ListExpensesUseCase,
  GetExpenseUseCase,
  DeleteExpenseUseCase,
} from "@modules/expense/application/expenseUseCases";

const repository = new DexieExpenseRepository(db);

export const expenseService = {
  create: new CreateExpenseUseCase(repository),
  update: new UpdateExpenseUseCase(repository),
  list: new ListExpensesUseCase(repository),
  get: new GetExpenseUseCase(repository),
  delete: new DeleteExpenseUseCase(repository),
};

export type ExpenseService = typeof expenseService;
