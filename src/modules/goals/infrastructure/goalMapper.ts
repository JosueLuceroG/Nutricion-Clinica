import { Goal, type GoalProps } from "../domain/Goal";
import type { GoalId } from "../domain/GoalId";

export interface GoalRow {
  id: string;
  patient_id: string;
  consultation_origin_id: string | null;
  type: string;
  variable: string;
  initial_value: number;
  initial_value_date: string;
  target_value: number;
  unit: string;
  start_date: string;
  target_date: string;
  close_date: string | null;
  status: string;
  criterion: string;
  criterion_detail: string;
  priority: string;
  source: string;
  reason: string;
  action_plan: string;
  tracking_metrics: string;
  alerts: string;
  professional_id: string;
  notes: string;
  created_at: number;
  updated_at: number;
}

export function goalToRow(goal: Goal): GoalRow {
  const p = goal.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    consultation_origin_id: p.consultationOriginId ?? null,
    type: p.type,
    variable: p.variable,
    initial_value: p.initialValue,
    initial_value_date: p.initialValueDate,
    target_value: p.targetValue,
    unit: p.unit,
    start_date: p.startDate,
    target_date: p.targetDate,
    close_date: p.closeDate ?? null,
    status: p.status,
    criterion: p.criterion,
    criterion_detail: p.criterionDetail,
    priority: p.priority,
    source: p.source,
    reason: p.reason,
    action_plan: p.actionPlan,
    tracking_metrics: JSON.stringify(p.trackingMetrics),
    alerts: JSON.stringify(p.alerts),
    professional_id: p.professionalId,
    notes: p.notes,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function rowToGoal(row: GoalRow): Goal {
  return Goal.reconstitute({
    id: row.id as GoalId,
    patientId: row.patient_id,
    consultationOriginId: row.consultation_origin_id ?? undefined,
    type: row.type as GoalProps["type"],
    variable: row.variable,
    initialValue: row.initial_value,
    initialValueDate: row.initial_value_date,
    targetValue: row.target_value,
    unit: row.unit,
    startDate: row.start_date,
    targetDate: row.target_date,
    closeDate: row.close_date ?? undefined,
    status: row.status as GoalProps["status"],
    criterion: row.criterion as GoalProps["criterion"],
    criterionDetail: row.criterion_detail,
    priority: row.priority as GoalProps["priority"],
    source: row.source as GoalProps["source"],
    reason: row.reason,
    actionPlan: row.action_plan,
    trackingMetrics: JSON.parse(row.tracking_metrics) as string[],
    alerts: JSON.parse(row.alerts) as string[],
    professionalId: row.professional_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
