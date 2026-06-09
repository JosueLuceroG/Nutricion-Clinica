import { z } from "zod";
import { GoalIdSchema, type GoalId } from "./GoalId";
import {
  GoalTypeSchema, type GoalType,
  GoalStatusSchema, type GoalStatus,
  GoalPrioritySchema, type GoalPriority,
  GoalSourceSchema, type GoalSource,
  SuccessCriterionSchema, type SuccessCriterion,
} from "./GoalTypes";

export const GoalSchema = z.object({
  id: GoalIdSchema,
  patientId: z.string().uuid(),
  consultationOriginId: z.string().uuid().optional(),
  type: GoalTypeSchema,
  variable: z.string().min(1).max(100),
  initialValue: z.number(),
  initialValueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetValue: z.number(),
  unit: z.string().max(50).default(""),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closeDate: z.string().optional(),
  status: GoalStatusSchema,
  criterion: SuccessCriterionSchema,
  criterionDetail: z.string().max(500).default(""),
  priority: GoalPrioritySchema,
  source: GoalSourceSchema,
  reason: z.string().max(1000).default(""),
  actionPlan: z.string().max(2000).default(""),
  trackingMetrics: z.array(z.string()).default([]),
  alerts: z.array(z.string()).default([]),
  professionalId: z.string().uuid(),
  notes: z.string().max(2000).default(""),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type GoalProps = z.infer<typeof GoalSchema>;

export const GoalEvaluationSchema = z.object({
  id: z.string().uuid(),
  goalId: GoalIdSchema,
  consultationId: z.string().uuid(),
  currentValue: z.number(),
  absoluteChange: z.number(),
  percentChange: z.number(),
  distanceToTarget: z.number(),
  progressPercent: z.number().min(0).max(200),
  calculatedStatus: z.string(),
  monthlyVelocity: z.number().optional(),
  projectedDate: z.string().optional(),
  alert: z.string().max(500).default(""),
  calculatedAt: z.number().int().positive(),
});
export type GoalEvaluationProps = z.infer<typeof GoalEvaluationSchema>;

export class GoalEvaluation {
  private constructor(private readonly props: GoalEvaluationProps) {}

  get id(): string { return this.props.id; }
  get goalId(): GoalId { return this.props.goalId as GoalId; }
  get consultationId(): string { return this.props.consultationId; }
  get currentValue(): number { return this.props.currentValue; }
  get absoluteChange(): number { return this.props.absoluteChange; }
  get percentChange(): number { return this.props.percentChange; }
  get distanceToTarget(): number { return this.props.distanceToTarget; }
  get progressPercent(): number { return this.props.progressPercent; }
  get calculatedStatus(): string { return this.props.calculatedStatus; }
  get monthlyVelocity(): number | undefined { return this.props.monthlyVelocity; }
  get projectedDate(): string | undefined { return this.props.projectedDate; }
  get alert(): string { return this.props.alert; }
  get calculatedAt(): number { return this.props.calculatedAt; }

  toProps(): GoalEvaluationProps {
    return { ...this.props };
  }

  static create(props: Omit<GoalEvaluationProps, "calculatedAt"> & { calculatedAt?: number }): GoalEvaluation {
    return new GoalEvaluation({
      ...props,
      calculatedAt: props.calculatedAt ?? Date.now(),
    });
  }

  static reconstitute(props: GoalEvaluationProps): GoalEvaluation {
    return new GoalEvaluation(props);
  }

  static calculate(goal: Goal, currentValue: number, consultationId: string, monthsElapsed: number): GoalEvaluation {
    const absoluteChange = currentValue - goal.initialValue;
    const percentChange = goal.initialValue !== 0 ? (absoluteChange / Math.abs(goal.initialValue)) * 100 : 0;
    const distanceToTarget = goal.targetValue - currentValue;
    const totalChangeNeeded = goal.targetValue - goal.initialValue;
    const progressPercent = totalChangeNeeded !== 0
      ? Math.min(200, Math.max(0, (absoluteChange / totalChangeNeeded) * 100))
      : currentValue >= goal.targetValue ? 100 : 0;

    const monthlyVelocity = monthsElapsed > 0 ? absoluteChange / monthsElapsed : undefined;

    let projectedDate: string | undefined;
    if (monthlyVelocity !== undefined && monthlyVelocity !== 0) {
      const remainingSteps = distanceToTarget / monthlyVelocity;
      if (remainingSteps > 0 && isFinite(remainingSteps)) {
        const target = new Date();
        target.setMonth(target.getMonth() + Math.ceil(remainingSteps));
        projectedDate = target.toISOString().slice(0, 10);
      }
    }

    let calculatedStatus: string;
    if (progressPercent >= 100) {
      calculatedStatus = currentValue >= goal.targetValue ? "logrado" : "superado";
    } else if (monthlyVelocity !== undefined && monthlyVelocity > 0) {
      calculatedStatus = "en_ritmo";
    } else if (monthlyVelocity !== undefined && monthlyVelocity < 0 && Math.abs(monthlyVelocity) > Math.abs(distanceToTarget) / 3) {
      calculatedStatus = "en_retroceso";
    } else {
      calculatedStatus = "en_progreso";
    }

    const id = crypto.randomUUID();
    const startMs = new Date(goal.startDate).getTime();
    const targetMs = new Date(goal.targetDate).getTime();
    const totalMonths = targetMs > startMs ? (targetMs - startMs) / (1000 * 60 * 60 * 24 * 30.44) : 0;
    const evalAlert = progressPercent < 25 && monthsElapsed > totalMonths ? "Progreso insuficiente, se requiere revisión" : "";

    return GoalEvaluation.create({
      id,
      goalId: goal.id,
      consultationId,
      currentValue,
      absoluteChange: Math.round(absoluteChange * 100) / 100,
      percentChange: Math.round(percentChange * 100) / 100,
      distanceToTarget: Math.round(distanceToTarget * 100) / 100,
      progressPercent: Math.round(progressPercent * 100) / 100,
      calculatedStatus,
      monthlyVelocity: monthlyVelocity !== undefined ? Math.round(monthlyVelocity * 100) / 100 : undefined,
      projectedDate,
      alert: evalAlert,
    });
  }
}

export class Goal {
  private constructor(private readonly props: GoalProps) {}

  get id(): GoalId { return this.props.id as GoalId; }
  get patientId(): string { return this.props.patientId; }
  get consultationOriginId(): string | undefined { return this.props.consultationOriginId; }
  get type(): GoalType { return this.props.type; }
  get variable(): string { return this.props.variable; }
  get initialValue(): number { return this.props.initialValue; }
  get initialValueDate(): string { return this.props.initialValueDate; }
  get targetValue(): number { return this.props.targetValue; }
  get unit(): string { return this.props.unit; }
  get startDate(): string { return this.props.startDate; }
  get targetDate(): string { return this.props.targetDate; }
  get closeDate(): string | undefined { return this.props.closeDate; }
  get status(): GoalStatus { return this.props.status; }
  get criterion(): SuccessCriterion { return this.props.criterion; }
  get criterionDetail(): string { return this.props.criterionDetail; }
  get priority(): GoalPriority { return this.props.priority; }
  get source(): GoalSource { return this.props.source; }
  get reason(): string { return this.props.reason; }
  get actionPlan(): string { return this.props.actionPlan; }
  get trackingMetrics(): readonly string[] { return this.props.trackingMetrics; }
  get alerts(): readonly string[] { return this.props.alerts; }
  get professionalId(): string { return this.props.professionalId; }
  get notes(): string { return this.props.notes; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): GoalProps {
    return { ...this.props, trackingMetrics: [...this.props.trackingMetrics], alerts: [...this.props.alerts] };
  }

  static create(props: Omit<GoalProps, "createdAt" | "updatedAt" | "status"> & { status?: GoalStatus }): Goal {
    return new Goal({
      ...props,
      status: props.status ?? "activo",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: GoalProps): Goal {
    return new Goal(props);
  }

  with(updates: Partial<GoalProps>): Goal {
    return Goal.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }

  pause(): Goal {
    return this.with({ status: "en_pausa" });
  }

  markAchieved(): Goal {
    return this.with({ status: "logrado", closeDate: new Date().toISOString().slice(0, 10) });
  }

  markNotAchieved(): Goal {
    return this.with({ status: "no_logrado", closeDate: new Date().toISOString().slice(0, 10) });
  }

  abandon(): Goal {
    return this.with({ status: "abandonado", closeDate: new Date().toISOString().slice(0, 10) });
  }
}
