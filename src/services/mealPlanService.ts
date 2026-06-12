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
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository: MealPlanRepository = new DexieMealPlanRepository(db);
const consultationRepository: ConsultationRepository = new DexieConsultationRepository(db);
const createMealPlan = new CreateMealPlanUseCase(repository, consultationRepository);
const updateMealPlanMeals = new UpdateMealPlanMealsUseCase(repository);
const updateMealPlanNotes = new UpdateMealPlanNotesUseCase(repository);
const transitionMealPlan = new TransitionMealPlanStatusUseCase(repository);
const deleteMealPlan = new DeleteMealPlanUseCase(repository);

export const mealPlanService = {
  create: {
    async execute(input: Parameters<typeof createMealPlan.execute>[0]): ReturnType<typeof createMealPlan.execute> {
      const plan = await createMealPlan.execute(input);
      await recordClinicalAudit({ module: "meal_plans", action: "create", resourceType: "meal_plan", resourceId: plan.id.toString(), patientId: plan.patientId.toString() });
      return plan;
    },
  },
  updateMeals: {
    async execute(id: Parameters<typeof updateMealPlanMeals.execute>[0], meals: Parameters<typeof updateMealPlanMeals.execute>[1]): ReturnType<typeof updateMealPlanMeals.execute> {
      const plan = await updateMealPlanMeals.execute(id, meals);
      await recordClinicalAudit({ module: "meal_plans", action: "update", resourceType: "meal_plan", resourceId: plan.id.toString(), patientId: plan.patientId.toString(), justification: "meals" });
      return plan;
    },
  },
  updateNotes: {
    async execute(id: Parameters<typeof updateMealPlanNotes.execute>[0], notes: Parameters<typeof updateMealPlanNotes.execute>[1]): ReturnType<typeof updateMealPlanNotes.execute> {
      const plan = await updateMealPlanNotes.execute(id, notes);
      await recordClinicalAudit({ module: "meal_plans", action: "update", resourceType: "meal_plan", resourceId: plan.id.toString(), patientId: plan.patientId.toString(), justification: "notes" });
      return plan;
    },
  },
  transition: {
    async execute(id: Parameters<typeof transitionMealPlan.execute>[0], to: Parameters<typeof transitionMealPlan.execute>[1]): ReturnType<typeof transitionMealPlan.execute> {
      const plan = await transitionMealPlan.execute(id, to);
      await recordClinicalAudit({ module: "meal_plans", action: "update", resourceType: "meal_plan", resourceId: plan.id.toString(), patientId: plan.patientId.toString(), justification: `status:${to}` });
      return plan;
    },
  },
  get: new GetMealPlanUseCase(repository),
  list: new ListMealPlansUseCase(repository),
  delete: {
    async execute(id: Parameters<typeof deleteMealPlan.execute>[0], soft = true): ReturnType<typeof deleteMealPlan.execute> {
      const existing = await repository.findById(id);
      await deleteMealPlan.execute(id, soft);
      await recordClinicalAudit({ module: "meal_plans", action: soft ? "soft_delete" : "remove", resourceType: "meal_plan", resourceId: id.toString(), patientId: existing?.patientId.toString() ?? null });
    },
  },
};

export type MealPlanService = typeof mealPlanService;
