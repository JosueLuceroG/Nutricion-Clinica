import type { EvolutionRepository } from "../domain/EvolutionRepository";
import type { EvolutionRecordProps } from "../domain/EvolutionRecord";
import type { EvolutionIndicatorProps } from "../domain/EvolutionIndicator";
import type { TemporalComparisonProps } from "../domain/TemporalComparison";
import type { StagnationAlertProps } from "../domain/StagnationAlert";

export function createEvolutionRecordUC(
  repo: EvolutionRepository,
  props: EvolutionRecordProps,
) {
  return repo.createRecord(props);
}

export function updateEvolutionRecordUC(
  repo: EvolutionRepository,
  id: string,
  props: Partial<EvolutionRecordProps>,
) {
  return repo.updateRecord(id, props);
}

export function findRecordsByPatientUC(
  repo: EvolutionRepository,
  patientId: string,
) {
  return repo.findRecordsByPatient(patientId);
}

export function findRecordByConsultationUC(
  repo: EvolutionRepository,
  consultationId: string,
) {
  return repo.findRecordsByConsultation(consultationId);
}

export function createIndicatorUC(
  repo: EvolutionRepository,
  props: EvolutionIndicatorProps,
) {
  return repo.createIndicator(props);
}

export function findIndicatorsByPatientUC(
  repo: EvolutionRepository,
  patientId: string,
) {
  return repo.findIndicatorsByPatient(patientId);
}

export function findLatestIndicatorUC(
  repo: EvolutionRepository,
  patientId: string,
  variable: string,
) {
  return repo.findLatestIndicator(patientId, variable);
}

export function calculateIndicatorUC(
  repo: EvolutionRepository,
  props: EvolutionIndicatorProps,
) {
  const absoluteChange = props.currentValue - props.initialValue;
  const percentChange = props.initialValue !== 0
    ? Math.round((absoluteChange / props.initialValue) * 10000) / 100
    : 0;

  let status: string = "en_progreso";
  if (props.targetValue !== undefined) {
    const distance = Math.abs(props.targetValue - props.currentValue);
    const totalDistance = Math.abs(props.targetValue - props.initialValue);
    const progress = totalDistance > 0
      ? Math.round((1 - distance / totalDistance) * 100)
      : 0;
    if (progress >= 100) status = "logrado";
    else if (progress >= 125) status = "superado";
    else if (progress < 0) status = "en_retroceso";

    return repo.createIndicator({
      ...props,
      absoluteChange,
      percentChange,
      distanceToTarget: distance,
      progressPercent: Math.min(200, Math.max(0, progress)),
      status: status as EvolutionIndicatorProps["status"],
      calculatedAt: Date.now(),
    });
  }

  return repo.createIndicator({
    ...props,
    absoluteChange,
    percentChange,
    status: "en_progreso",
    calculatedAt: Date.now(),
  });
}

export function createComparisonUC(
  repo: EvolutionRepository,
  props: TemporalComparisonProps,
) {
  return repo.createComparison(props);
}

export function findComparisonsByPatientUC(
  repo: EvolutionRepository,
  patientId: string,
) {
  return repo.findComparisonsByPatient(patientId);
}

export function createStagnationAlertUC(
  repo: EvolutionRepository,
  props: StagnationAlertProps,
) {
  return repo.createStagnationAlert(props);
}

export function findActiveAlertsByPatientUC(
  repo: EvolutionRepository,
  patientId: string,
) {
  return repo.findActiveAlertsByPatient(patientId);
}

export function resolveAlertUC(
  repo: EvolutionRepository,
  id: string,
) {
  return repo.resolveAlert(id);
}
