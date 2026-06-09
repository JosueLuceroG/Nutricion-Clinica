import { z } from "zod";
import { MealSlotSchema } from "@modules/mealplan/domain/MealSlot";
import { FoodExchangeSchema } from "@modules/mealplan/domain/MealPlan";

export const MenuDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(31),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meals: z.array(z.object({
    slot: MealSlotSchema,
    exchanges: z.array(FoodExchangeSchema),
    targetKcal: z.number().min(0).default(0),
  })),
  notes: z.string().max(500).default(""),
});
export type MenuDay = z.infer<typeof MenuDaySchema>;

export const WeeklyPlanSchema = z.object({
  id: WeeklyPlanIdSchema,
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(["daily", "weekly", "biweekly", "monthly"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetKcal: z.number().min(0).default(0),
  targetProteinPct: z.number().min(0).max(100).default(20),
  targetFatPct: z.number().min(0).max(100).default(25),
  targetCarbPct: z.number().min(0).max(100).default(55),
  targetFiberG: z.number().min(0).default(25),
  timesPerDay: z.number().int().min(3).max(6).default(5),
  restrictions: z.array(z.string()).default([]),
  days: z.array(MenuDaySchema).default([]),
  status: z.enum(["draft", "active", "completed", "cancelled"]),
  professionalId: z.string().uuid(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type WeeklyPlanProps = z.infer<typeof WeeklyPlanSchema>;

import { WeeklyPlanIdSchema, type WeeklyPlanId } from "./WeeklyPlanId";

export class WeeklyPlan {
  private constructor(private readonly props: WeeklyPlanProps) {}

  get id(): WeeklyPlanId { return this.props.id as WeeklyPlanId; }
  get patientId(): string { return this.props.patientId; }
  get consultationId(): string | undefined { return this.props.consultationId; }
  get name(): string { return this.props.name; }
  get type(): string { return this.props.type; }
  get startDate(): string { return this.props.startDate; }
  get endDate(): string { return this.props.endDate; }
  get targetKcal(): number { return this.props.targetKcal; }
  get targetProteinPct(): number { return this.props.targetProteinPct; }
  get targetFatPct(): number { return this.props.targetFatPct; }
  get targetCarbPct(): number { return this.props.targetCarbPct; }
  get targetFiberG(): number { return this.props.targetFiberG; }
  get timesPerDay(): number { return this.props.timesPerDay; }
  get restrictions(): readonly string[] { return this.props.restrictions; }
  get days(): readonly MenuDay[] { return this.props.days; }
  get status(): string { return this.props.status; }
  get professionalId(): string { return this.props.professionalId; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): WeeklyPlanProps { return { ...this.props }; }

  static create(props: Omit<WeeklyPlanProps, "createdAt" | "updatedAt" | "status"> & { status?: WeeklyPlanProps["status"] }): WeeklyPlan {
    return new WeeklyPlan({
      ...props,
      status: props.status ?? "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: WeeklyPlanProps): WeeklyPlan {
    return new WeeklyPlan(props);
  }

  with(updates: Partial<WeeklyPlanProps>): WeeklyPlan {
    return WeeklyPlan.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }
}
