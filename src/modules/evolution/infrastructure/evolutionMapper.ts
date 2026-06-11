import type { EvolutionRecordProps } from "../domain/EvolutionRecord";
import type { EvolutionIndicatorProps } from "../domain/EvolutionIndicator";
import type { TemporalComparisonProps } from "../domain/TemporalComparison";
import type { StagnationAlertProps } from "../domain/StagnationAlert";

// Evolution Record
export interface EvolutionRecordRow {
  id: string;
  patient_id: string;
  consultation_id: string;
  professional_id: string;
  changes_since_last_consultation: string;
  intercurrent_events: string;
  perceived_compliance: number;
  barriers_identified: string;
  facilitators_identified: string;
  patient_satisfaction: number;
  next_appointment: string | null;
  next_consultation_plan: string;
  requires_referral: number;
  referral_specialties: string;
  snapshot_before_id: string | null;
  snapshot_after_id: string | null;
  created_at: number;
  updated_at: number;
}

export function recordToRow(p: EvolutionRecordProps): EvolutionRecordRow {
  return {
    id: p.id,
    patient_id: p.patientId,
    consultation_id: p.consultationId,
    professional_id: p.professionalId,
    changes_since_last_consultation: p.changesSinceLastConsultation,
    intercurrent_events: p.intercurrentEvents,
    perceived_compliance: p.perceivedCompliance,
    barriers_identified: p.barriersIdentified,
    facilitators_identified: p.facilitatorsIdentified,
    patient_satisfaction: p.patientSatisfaction,
    next_appointment: p.nextAppointment ?? null,
    next_consultation_plan: p.nextConsultationPlan,
    requires_referral: p.requiresReferral ? 1 : 0,
    referral_specialties: JSON.stringify(p.referralSpecialties),
    snapshot_before_id: p.snapshotBeforeId ?? null,
    snapshot_after_id: p.snapshotAfterId ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function rowToRecord(row: EvolutionRecordRow): EvolutionRecordProps {
  return {
    id: row.id,
    patientId: row.patient_id,
    consultationId: row.consultation_id,
    professionalId: row.professional_id,
    changesSinceLastConsultation: row.changes_since_last_consultation,
    intercurrentEvents: row.intercurrent_events,
    perceivedCompliance: row.perceived_compliance,
    barriersIdentified: row.barriers_identified,
    facilitatorsIdentified: row.facilitators_identified,
    patientSatisfaction: row.patient_satisfaction,
    nextAppointment: row.next_appointment ?? undefined,
    nextConsultationPlan: row.next_consultation_plan,
    requiresReferral: row.requires_referral === 1,
    referralSpecialties: JSON.parse(row.referral_specialties || "[]"),
    snapshotBeforeId: row.snapshot_before_id ?? undefined,
    snapshotAfterId: row.snapshot_after_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Evolution Indicator
export interface EvolutionIndicatorRow {
  id: string;
  patient_id: string;
  variable: string;
  initial_consultation_id: string;
  current_consultation_id: string;
  initial_value: number;
  current_value: number;
  absolute_change: number;
  percent_change: number;
  monthly_percent_change: number | null;
  goal_id: string | null;
  target_value: number | null;
  distance_to_target: number | null;
  progress_percent: number | null;
  status: string;
  calculated_at: number;
}

export function indicatorToRow(p: EvolutionIndicatorProps): EvolutionIndicatorRow {
  return {
    id: p.id,
    patient_id: p.patientId,
    variable: p.variable,
    initial_consultation_id: p.initialConsultationId,
    current_consultation_id: p.currentConsultationId,
    initial_value: p.initialValue,
    current_value: p.currentValue,
    absolute_change: p.absoluteChange,
    percent_change: p.percentChange,
    monthly_percent_change: p.monthlyPercentChange ?? null,
    goal_id: p.goalId ?? null,
    target_value: p.targetValue ?? null,
    distance_to_target: p.distanceToTarget ?? null,
    progress_percent: p.progressPercent ?? null,
    status: p.status,
    calculated_at: p.calculatedAt,
  };
}

export function rowToIndicator(row: EvolutionIndicatorRow): EvolutionIndicatorProps {
  return {
    id: row.id,
    patientId: row.patient_id,
    variable: row.variable as EvolutionIndicatorProps["variable"],
    initialConsultationId: row.initial_consultation_id,
    currentConsultationId: row.current_consultation_id,
    initialValue: row.initial_value,
    currentValue: row.current_value,
    absoluteChange: row.absolute_change,
    percentChange: row.percent_change,
    monthlyPercentChange: row.monthly_percent_change ?? undefined,
    goalId: row.goal_id ?? undefined,
    targetValue: row.target_value ?? undefined,
    distanceToTarget: row.distance_to_target ?? undefined,
    progressPercent: row.progress_percent ?? undefined,
    status: row.status as EvolutionIndicatorProps["status"],
    calculatedAt: row.calculated_at,
  };
}

// Temporal Comparison
export interface TemporalComparisonRow {
  id: string;
  patient_id: string;
  current_consultation_id: string;
  compared_consultation_id: string;
  differences_json: string;
  summary: string;
  calculated_at: number;
}

export function comparisonToRow(p: TemporalComparisonProps): TemporalComparisonRow {
  return {
    id: p.id,
    patient_id: p.patientId,
    current_consultation_id: p.currentConsultationId,
    compared_consultation_id: p.comparedConsultationId,
    differences_json: p.differencesJson,
    summary: p.summary,
    calculated_at: p.calculatedAt,
  };
}

export function rowToComparison(row: TemporalComparisonRow): TemporalComparisonProps {
  return {
    id: row.id,
    patientId: row.patient_id,
    currentConsultationId: row.current_consultation_id,
    comparedConsultationId: row.compared_consultation_id,
    differencesJson: row.differences_json,
    summary: row.summary,
    calculatedAt: row.calculated_at,
  };
}

// Stagnation Alert
export interface StagnationAlertRow {
  id: string;
  patient_id: string;
  variable: string;
  period_weeks: number;
  severity: string;
  generated_at: number;
  action_taken: string;
  notes: string;
  resolved_at: number | null;
}

export function alertToRow(p: StagnationAlertProps): StagnationAlertRow {
  return {
    id: p.id,
    patient_id: p.patientId,
    variable: p.variable,
    period_weeks: p.periodWeeks,
    severity: p.severity,
    generated_at: p.generatedAt,
    action_taken: p.actionTaken,
    notes: p.notes,
    resolved_at: p.resolvedAt ?? null,
  };
}

export function rowToAlert(row: StagnationAlertRow): StagnationAlertProps {
  return {
    id: row.id,
    patientId: row.patient_id,
    variable: row.variable as StagnationAlertProps["variable"],
    periodWeeks: row.period_weeks,
    severity: row.severity as StagnationAlertProps["severity"],
    generatedAt: row.generated_at,
    actionTaken: row.action_taken,
    notes: row.notes,
    resolvedAt: row.resolved_at ?? undefined,
  };
}
