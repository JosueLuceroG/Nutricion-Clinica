import { MealPlan, type MealPlanCreate, type PlanMeal } from "../domain/MealPlan";
import type { MealPlanId } from "../domain/MealPlanId";
import type { MealPlanStatus } from "../domain/MealPlanStatus";
import {
  type MealPlanQuery,
  type MealPlanRepository,
  MealPlanNotFoundError,
} from "../domain/MealPlanRepository";
import { canTransitionMealPlan } from "../domain/MealPlanStatus";

export class CreateMealPlanUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(input: MealPlanCreate): Promise<MealPlan> {
    const plan = MealPlan.create(input);
    await this.repo.save(plan);
    return plan;
  }
}

export class UpdateMealPlanMealsUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(id: MealPlanId, meals: PlanMeal[]): Promise<MealPlan> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new MealPlanNotFoundError(id);
    const updated = existing.withMeals(meals);
    if (updated === existing) return existing;
    await this.repo.save(updated);
    return updated;
  }
}

export class UpdateMealPlanNotesUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(id: MealPlanId, notes: string | null): Promise<MealPlan> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new MealPlanNotFoundError(id);
    const updated = existing.withNotes(notes);
    if (updated === existing) return existing;
    await this.repo.save(updated);
    return updated;
  }
}

export class TransitionMealPlanStatusUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(id: MealPlanId, to: MealPlanStatus): Promise<MealPlan> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new MealPlanNotFoundError(id);
    if (!canTransitionMealPlan(existing.status, to)) {
      throw new Error(`Transición no permitida: ${existing.status} → ${to}`);
    }
    const updated = existing.withStatus(to);
    if (updated === existing) return existing;
    await this.repo.save(updated);
    return updated;
  }
}

export class GetMealPlanUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(id: MealPlanId): Promise<MealPlan> {
    const found = await this.repo.findById(id);
    if (!found) throw new MealPlanNotFoundError(id);
    return found;
  }
}

export class ListMealPlansUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(query?: MealPlanQuery): Promise<{ items: MealPlan[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return { items, total };
  }
}

export class DeleteMealPlanUseCase {
  constructor(private readonly repo: MealPlanRepository) {}

  async execute(id: MealPlanId, soft = true): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new MealPlanNotFoundError(id);
    await this.repo.delete(id, soft);
  }
}
