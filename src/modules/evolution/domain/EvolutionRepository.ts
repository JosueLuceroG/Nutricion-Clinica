import type {
  EvolutionRecord,
  EvolutionRecordProps,
} from "./EvolutionRecord";
import type {
  EvolutionIndicator,
  EvolutionIndicatorProps,
} from "./EvolutionIndicator";
import type {
  TemporalComparison,
  TemporalComparisonProps,
} from "./TemporalComparison";
import type {
  StagnationAlert,
  StagnationAlertProps,
} from "./StagnationAlert";

export class EvolutionRecordNotFoundError extends Error {
  constructor(id: string) {
    super(`EvolutionRecord no encontrado: ${id}`);
    this.name = "EvolutionRecordNotFoundError";
  }
}

export class EvolutionIndicatorNotFoundError extends Error {
  constructor(id: string) {
    super(`EvolutionIndicator no encontrado: ${id}`);
    this.name = "EvolutionIndicatorNotFoundError";
  }
}

export class StagnationAlertNotFoundError extends Error {
  constructor(id: string) {
    super(`StagnationAlert no encontrado: ${id}`);
    this.name = "StagnationAlertNotFoundError";
  }
}

export interface EvolutionRepository {
  // Evolution Records
  createRecord(props: EvolutionRecordProps): Promise<EvolutionRecord>;
  updateRecord(id: string, props: Partial<EvolutionRecordProps>): Promise<EvolutionRecord>;
  findRecordById(id: string): Promise<EvolutionRecord | null>;
  findRecordsByPatient(patientId: string): Promise<EvolutionRecord[]>;
  findRecordsByConsultation(consultationId: string): Promise<EvolutionRecord | null>;

  // Evolution Indicators
  createIndicator(props: EvolutionIndicatorProps): Promise<EvolutionIndicator>;
  findIndicatorsByPatient(patientId: string): Promise<EvolutionIndicator[]>;
  findIndicatorsByConsultation(consultationId: string): Promise<EvolutionIndicator[]>;
  findLatestIndicator(patientId: string, variable: string): Promise<EvolutionIndicator | null>;

  // Temporal Comparisons
  createComparison(props: TemporalComparisonProps): Promise<TemporalComparison>;
  findComparisonsByPatient(patientId: string): Promise<TemporalComparison[]>;
  findComparisonBetween(consultationA: string, consultationB: string): Promise<TemporalComparison | null>;

  // Stagnation Alerts
  createStagnationAlert(props: StagnationAlertProps): Promise<StagnationAlert>;
  updateStagnationAlert(id: string, props: Partial<StagnationAlertProps>): Promise<StagnationAlert>;
  findActiveAlertsByPatient(patientId: string): Promise<StagnationAlert[]>;
  resolveAlert(id: string): Promise<void>;
}
