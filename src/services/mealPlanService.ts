import { DexieMealPlanRepository } from "@modules/mealplan/infrastructure/DexieMealPlanRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreateMealPlanUseCase,
  UpdateMealPlanMealsUseCase,
  UpdateMealPlanNotesUseCase,
  TransitionMealPlanStatusUseCase,
  GetMealPlanUseCase,
  ListMealPlansUseCase,
  DeleteMealPlanUseCase,
} from "@modules/mealplan/application/mealPlanUseCases";
import type { MealPlanRepository } from "@modules/mealplan/domain/MealPlanRepository";

const repository: MealPlanRepository = new DexieMealPlanRepository(db);

export const mealPlanService = {
  create: new CreateMealPlanUseCase(repository),
  updateMeals: new UpdateMealPlanMealsUseCase(repository),
  updateNotes: new UpdateMealPlanNotesUseCase(repository),
  transition: new TransitionMealPlanStatusUseCase(repository),
  get: new GetMealPlanUseCase(repository),
  list: new ListMealPlansUseCase(repository),
  delete: new DeleteMealPlanUseCase(repository),
};

export type MealPlanService = typeof mealPlanService;
