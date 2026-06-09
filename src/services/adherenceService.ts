import { db } from "@services/db/dexieSchema";
import { DexieAdherenceRepository } from "@modules/adherence/infrastructure/DexieAdherenceRepository";
import {
  createAdherenceRecordUC, listAdherenceByPatientUC, getAdherenceByIdUC,
  deleteAdherenceRecordUC, calculateAdherenceIndexUC,
  createBarrierEventUC, listBarriersByPatientUC,
} from "@modules/adherence/application/adherenceUseCases";
import type { AdherenceId } from "@modules/adherence/domain/AdherenceId";
import type { AdherenceRecord } from "@modules/adherence/domain/AdherenceRecord";
import type { AdherenceFormInput } from "@modules/adherence/application/adherenceFormSchema";

const repository = new DexieAdherenceRepository(db);

export const adherenceService = {
  createRecord: (input: AdherenceFormInput): Promise<AdherenceRecord> =>
    createAdherenceRecordUC(repository, input),
  listByPatient: (patientId: string): Promise<AdherenceRecord[]> =>
    listAdherenceByPatientUC(repository, patientId),
  getById: (id: AdherenceId): Promise<AdherenceRecord | null> =>
    getAdherenceByIdUC(repository, id),
  deleteRecord: (id: AdherenceId): Promise<void> =>
    deleteAdherenceRecordUC(repository, id),
  calculateIndex: (patientId: string, start: string, end: string) =>
    calculateAdherenceIndexUC(repository, patientId, start, end),
  createBarrier: (input: { patientId: string; type: string; description: string; date: string; actionTaken?: string }) =>
    createBarrierEventUC(repository, input),
  listBarriers: (patientId: string) =>
    listBarriersByPatientUC(repository, patientId),
};

export type AdherenceService = typeof adherenceService;
