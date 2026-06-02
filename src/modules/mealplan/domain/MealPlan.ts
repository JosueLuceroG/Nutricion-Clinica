import { z } from "zod";
import { FoodIdSchema, type FoodId } from "@modules/smae/domain";
import { MealPlanId } from "./MealPlanId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { MealSlotSchema, MEAL_SLOT_ORDER, type MealSlot } from "./MealSlot";
import type { MealPlanStatus } from "./MealPlanStatus";

/**
 * Equivalente de un alimento en un tiempo de comida.
 *  - foodId: alimento del catálogo
 *  - count: número de equivalentes/raciones de ese alimento
 */
export const FoodExchangeSchema = z.object({
  foodId: FoodIdSchema,
  count: z.coerce.number().positive("Debe ser positivo").max(20, "Máximo 20 raciones"),
});

export type FoodExchange = z.infer<typeof FoodExchangeSchema>;

/**
 * Un tiempo de comida con su lista de equivalentes.
 */
export const PlanMealSchema = z.object({
  slot: MealSlotSchema,
  exchanges: z.array(FoodExchangeSchema).max(50, "Máximo 50 alimentos por tiempo"),
});

export type PlanMeal = z.infer<typeof PlanMealSchema>;

export interface MealPlanProps {
  id: MealPlanId;
  patientId: PatientId;
  consultationId: ConsultationId | null;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  kcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  meals: PlanMeal[];
  notes: string | null;
  status: MealPlanStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MealPlanCreate {
  id?: MealPlanId;
  patientId: PatientId;
  consultationId?: ConsultationId | null;
  name: string;
  description?: string | null;
  startDate: Date;
  endDate?: Date | null;
  kcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  meals: PlanMeal[];
  notes?: string | null;
  status?: MealPlanStatus;
}

/**
 * Plan alimentario. Snapshot inmutable una vez activo.
 * Almacena los tiempos de comida como un array de {slot, exchanges[]},
 * garantizando siempre los 5 slots estándar (vacíos si no aplica).
 */
export class MealPlan {
  private constructor(private readonly props: MealPlanProps) {}

  get id(): MealPlanId {
    return this.props.id;
  }
  get patientId(): PatientId {
    return this.props.patientId;
  }
  get consultationId(): ConsultationId | null {
    return this.props.consultationId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get startDate(): Date {
    return this.props.startDate;
  }
  get endDate(): Date | null {
    return this.props.endDate;
  }
  get kcalTarget(): number {
    return this.props.kcalTarget;
  }
  get proteinTargetG(): number {
    return this.props.proteinTargetG;
  }
  get carbsTargetG(): number {
    return this.props.carbsTargetG;
  }
  get fatTargetG(): number {
    return this.props.fatTargetG;
  }
  get meals(): ReadonlyArray<PlanMeal> {
    return this.props.meals;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get status(): MealPlanStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get isActive(): boolean {
    return this.props.status === "active";
  }
  get isCompleted(): boolean {
    return this.props.status === "completed";
  }

  getMeal(slot: MealSlot): PlanMeal | undefined {
    return this.props.meals.find((m) => m.slot === slot);
  }

  withMeals(meals: PlanMeal[]): MealPlan {
    if (this.isCompleted) {
      throw new Error("Un plan completado no puede modificarse.");
    }
    return MealPlan.reconstitute({ ...this.props, meals, updatedAt: new Date() });
  }

  withStatus(status: MealPlanStatus, now: Date = new Date()): MealPlan {
    if (this.props.status === status) return this;
    if (this.isCompleted) {
      throw new Error("Un plan completado no puede cambiar de estado.");
    }
    return MealPlan.reconstitute({ ...this.props, status, updatedAt: now });
  }

  withNotes(notes: string | null): MealPlan {
    if (this.isCompleted) {
      throw new Error("Un plan completado no puede modificarse.");
    }
    return MealPlan.reconstitute({ ...this.props, notes, updatedAt: new Date() });
  }

  withTargets(targets: { kcal?: number; proteinG?: number; carbsG?: number; fatG?: number }): MealPlan {
    if (this.isCompleted) {
      throw new Error("Un plan completado no puede modificarse.");
    }
    return MealPlan.reconstitute({
      ...this.props,
      kcalTarget: targets.kcal ?? this.props.kcalTarget,
      proteinTargetG: targets.proteinG ?? this.props.proteinTargetG,
      carbsTargetG: targets.carbsG ?? this.props.carbsTargetG,
      fatTargetG: targets.fatG ?? this.props.fatTargetG,
      updatedAt: new Date(),
    });
  }

  withEndDate(endDate: Date | null): MealPlan {
    if (this.isCompleted) {
      throw new Error("Un plan completado no puede modificarse.");
    }
    if (endDate && endDate.getTime() < this.props.startDate.getTime()) {
      throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
    }
    return MealPlan.reconstitute({ ...this.props, endDate, updatedAt: new Date() });
  }

  softDelete(now: Date = new Date()): MealPlan {
    if (this.props.deletedAt) return this;
    return MealPlan.reconstitute({ ...this.props, deletedAt: now, updatedAt: now });
  }

  toProps(): MealPlanProps {
    return { ...this.props };
  }

  static create(input: MealPlanCreate): MealPlan {
    MealPlan.validateName(input.name);
    MealPlan.validateTargets(input);
    if (input.endDate && input.endDate.getTime() < input.startDate.getTime()) {
      throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
    }
    const meals = MEAL_SLOT_ORDER.map((slot) => {
      return input.meals.find((m) => m.slot === slot) ?? { slot, exchanges: [] };
    });
    return new MealPlan({
      id: input.id ?? MealPlanId.generate(),
      patientId: input.patientId,
      consultationId: input.consultationId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() ? input.description.trim() : null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      kcalTarget: input.kcalTarget,
      proteinTargetG: input.proteinTargetG,
      carbsTargetG: input.carbsTargetG,
      fatTargetG: input.fatTargetG,
      meals,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      status: input.status ?? "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  static reconstitute(props: MealPlanProps): MealPlan {
    return new MealPlan({ ...props });
  }

  private static validateName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length < 3) throw new Error("El nombre debe tener al menos 3 caracteres.");
    if (trimmed.length > 200) throw new Error("El nombre no puede exceder 200 caracteres.");
  }

  private static validateTargets(t: {
    kcalTarget: number;
    proteinTargetG: number;
    carbsTargetG: number;
    fatTargetG: number;
  }): void {
    if (t.kcalTarget < 800 || t.kcalTarget > 5000) {
      throw new Error("Objetivo calórico fuera de rango (800-5000 kcal).");
    }
    if (t.proteinTargetG < 0 || t.proteinTargetG > 400) {
      throw new Error("Proteína objetivo fuera de rango (0-400 g).");
    }
    if (t.carbsTargetG < 0 || t.carbsTargetG > 600) {
      throw new Error("Carbohidratos objetivo fuera de rango (0-600 g).");
    }
    if (t.fatTargetG < 0 || t.fatTargetG > 300) {
      throw new Error("Grasa objetivo fuera de rango (0-300 g).");
    }
  }
}

export type { FoodId };
