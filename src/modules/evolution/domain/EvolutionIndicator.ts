import { z } from "zod";
import {
  EvolutionVariableSchema, type EvolutionVariable,
  IndicatorStatusSchema, type IndicatorStatus,
} from "./EvolutionTypes";

export const EvolutionIndicatorSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  variable: EvolutionVariableSchema,
  initialConsultationId: z.string().uuid(),
  currentConsultationId: z.string().uuid(),
  initialValue: z.number(),
  currentValue: z.number(),
  absoluteChange: z.number(),
  percentChange: z.number(),
  monthlyPercentChange: z.number().optional(),
  goalId: z.string().uuid().optional(),
  targetValue: z.number().optional(),
  distanceToTarget: z.number().optional(),
  progressPercent: z.number().min(0).max(200).optional(),
  status: IndicatorStatusSchema,
  calculatedAt: z.number().int().positive(),
});
export type EvolutionIndicatorProps = z.infer<typeof EvolutionIndicatorSchema>;

export class EvolutionIndicator {
  constructor(public readonly props: EvolutionIndicatorProps) {}

  get id(): string { return this.props.id; }
  get variable(): EvolutionVariable { return this.props.variable; }
  get status(): IndicatorStatus { return this.props.status; }
  get progressPercent(): number | undefined { return this.props.progressPercent; }
}
