import { z } from "zod";
import {
  GoalTypeSchema,
  GoalPrioritySchema,
  GoalSourceSchema,
  SuccessCriterionSchema,
} from "../domain/GoalTypes";

export const GoalFormSchema = z.object({
  patientId: z.string().uuid(),
  type: GoalTypeSchema,
  variable: z.string().min(1, "Variable requerida"),
  initialValue: z.number(),
  initialValueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetValue: z.number(),
  unit: z.string().max(50).default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  criterion: SuccessCriterionSchema,
  criterionDetail: z.string().max(500).default(""),
  priority: GoalPrioritySchema,
  source: GoalSourceSchema,
  reason: z.string().max(1000).default(""),
  actionPlan: z.string().max(2000).default(""),
  trackingMetrics: z.array(z.string()).default([]),
  notes: z.string().max(2000).default(""),
});
export type GoalFormInput = z.infer<typeof GoalFormSchema>;
