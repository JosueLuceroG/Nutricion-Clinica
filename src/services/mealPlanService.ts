import { DexieMealPlanRepository } from "@modules/mealplan/infrastructure/DexieMealPlanRepository";
import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
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
import type { ConsultationRepository } from "@modules/consultation/domain/ConsultationRepository";

const repository: MealPlanRepository = new DexieMealPlanRepository(db);
const consultationRepository: ConsultationRepository = new DexieConsultationRepository(db);

export const mealPlanService = {
  create: new CreateMealPlanUseCase(repository, consultationRepository),
  updateMeals: new UpdateMealPlanMealsUseCase(repository),
  updateNotes: new UpdateMealPlanNotesUseCase(repository),
  transition: new TransitionMealPlanStatusUseCase(repository),
  get: new GetMealPlanUseCase(repository),
  list: new ListMealPlansUseCase(repository),
  delete: new DeleteMealPlanUseCase(repository),
};

export type MealPlanService = typeof mealPlanService;
