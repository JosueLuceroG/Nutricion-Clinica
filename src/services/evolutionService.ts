import { db } from "@services/db/dexieSchema";
import { DexieEvolutionRepository } from "@modules/evolution/infrastructure/DexieEvolutionRepository";
import {
  createEvolutionRecordUC,
  updateEvolutionRecordUC,
  findRecordsByPatientUC,
  findRecordByConsultationUC,
  createIndicatorUC,
  findIndicatorsByPatientUC,
  findLatestIndicatorUC,
  calculateIndicatorUC,
  createComparisonUC,
  findComparisonsByPatientUC,
  createStagnationAlertUC,
  findActiveAlertsByPatientUC,
  resolveAlertUC,
} from "@modules/evolution/application/evolutionUseCases";

const repository = new DexieEvolutionRepository(db);

export const evolutionService = {
  createRecord: (props: Parameters<typeof createEvolutionRecordUC>[1]) =>
    createEvolutionRecordUC(repository, props),
  updateRecord: (id: string, props: Parameters<typeof updateEvolutionRecordUC>[2]) =>
    updateEvolutionRecordUC(repository, id, props),
  findRecordsByPatient: (patientId: string) =>
    findRecordsByPatientUC(repository, patientId),
  findRecordByConsultation: (consultationId: string) =>
    findRecordByConsultationUC(repository, consultationId),

  createIndicator: (props: Parameters<typeof createIndicatorUC>[1]) =>
    createIndicatorUC(repository, props),
  findIndicatorsByPatient: (patientId: string) =>
    findIndicatorsByPatientUC(repository, patientId),
  findLatestIndicator: (patientId: string, variable: string) =>
    findLatestIndicatorUC(repository, patientId, variable),
  calculateIndicator: (props: Parameters<typeof calculateIndicatorUC>[1]) =>
    calculateIndicatorUC(repository, props),

  createComparison: (props: Parameters<typeof createComparisonUC>[1]) =>
    createComparisonUC(repository, props),
  findComparisonsByPatient: (patientId: string) =>
    findComparisonsByPatientUC(repository, patientId),

  createStagnationAlert: (props: Parameters<typeof createStagnationAlertUC>[1]) =>
    createStagnationAlertUC(repository, props),
  findActiveAlertsByPatient: (patientId: string) =>
    findActiveAlertsByPatientUC(repository, patientId),
  resolveAlert: (id: string) =>
    resolveAlertUC(repository, id),
};
