import { Goal, type GoalProps } from "../domain/Goal";
import { createGoalId, type GoalId } from "../domain/GoalId";
import type { GoalRepository } from "../domain/GoalRepository";
import type { GoalFormInput } from "./goalFormSchema";
import type { GoalStatus } from "../domain/GoalTypes";

export const createGoalUC = async (
  repo: GoalRepository,
  input: GoalFormInput,
  professionalId: string,
): Promise<Goal> => {
  const goal = Goal.create({
    id: createGoalId(),
    patientId: input.patientId,
    type: input.type,
    variable: input.variable,
    initialValue: input.initialValue,
    initialValueDate: input.initialValueDate,
    targetValue: input.targetValue,
    unit: input.unit,
    startDate: input.startDate,
    targetDate: input.targetDate,
    criterion: input.criterion,
    criterionDetail: input.criterionDetail,
    priority: input.priority,
    source: input.source,
    reason: input.reason,
    actionPlan: input.actionPlan,
    trackingMetrics: input.trackingMetrics,
    alerts: [],
    professionalId,
    notes: input.notes,
  });
  await repo.save(goal);
  return goal;
};

export const updateGoalUC = async (
  repo: GoalRepository,
  id: GoalId,
  input: Partial<GoalFormInput>,
): Promise<Goal> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Objetivo no encontrado: ${id}`);
  const updated = existing.with({
    type: input.type ?? existing.type,
    variable: input.variable ?? existing.variable,
    initialValue: input.initialValue ?? existing.initialValue,
    targetValue: input.targetValue ?? existing.targetValue,
    unit: input.unit ?? existing.unit,
    targetDate: input.targetDate ?? existing.targetDate,
    criterion: input.criterion ?? existing.criterion,
    criterionDetail: input.criterionDetail ?? existing.criterionDetail,
    priority: input.priority ?? existing.priority,
    source: input.source ?? existing.source,
    reason: input.reason ?? existing.reason,
    actionPlan: input.actionPlan ?? existing.actionPlan,
    trackingMetrics: input.trackingMetrics ?? existing.trackingMetrics,
    notes: input.notes ?? existing.notes,
  } as Partial<GoalProps>);
  await repo.save(updated);
  return updated;
};

export const listGoalsByPatientUC = async (
  repo: GoalRepository,
  patientId: string,
): Promise<Goal[]> => {
  return repo.findByPatient(patientId);
};

export const listAllGoalsUC = async (repo: GoalRepository): Promise<Goal[]> => {
  return repo.findAll();
};

export const getGoalByIdUC = async (
  repo: GoalRepository,
  id: GoalId,
): Promise<Goal | null> => {
  return repo.findById(id);
};

export const deleteGoalUC = async (
  repo: GoalRepository,
  id: GoalId,
): Promise<void> => {
  await repo.delete(id);
};

export const pauseGoalUC = async (
  repo: GoalRepository,
  id: GoalId,
): Promise<Goal> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Objetivo no encontrado: ${id}`);
  const paused = existing.pause();
  await repo.save(paused);
  return paused;
};

export const achieveGoalUC = async (
  repo: GoalRepository,
  id: GoalId,
): Promise<Goal> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Objetivo no encontrado: ${id}`);
  const achieved = existing.markAchieved();
  await repo.save(achieved);
  return achieved;
};

export const abandonGoalUC = async (
  repo: GoalRepository,
  id: GoalId,
): Promise<Goal> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Objetivo no encontrado: ${id}`);
  const abandoned = existing.abandon();
  await repo.save(abandoned);
  return abandoned;
};

export const listGoalsByStatusUC = async (
  repo: GoalRepository,
  status: GoalStatus,
): Promise<Goal[]> => {
  return repo.findByStatus(status);
};
