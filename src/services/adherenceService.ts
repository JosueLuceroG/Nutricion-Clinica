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
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository = new DexieAdherenceRepository(db);

export const adherenceService = {
  createRecord: async (input: AdherenceFormInput): Promise<AdherenceRecord> => {
    const record = await createAdherenceRecordUC(repository, input);
    await recordClinicalAudit({ module: "adherence", action: "create", resourceType: "adherence_record", resourceId: record.id, patientId: record.patientId });
    return record;
  },
  listByPatient: (patientId: string): Promise<AdherenceRecord[]> =>
    listAdherenceByPatientUC(repository, patientId),
  getById: (id: AdherenceId): Promise<AdherenceRecord | null> =>
    getAdherenceByIdUC(repository, id),
  deleteRecord: async (id: AdherenceId): Promise<void> => {
    const existing = await repository.findRecordById(id);
    await deleteAdherenceRecordUC(repository, id);
    await recordClinicalAudit({ module: "adherence", action: "remove", resourceType: "adherence_record", resourceId: id, patientId: existing?.patientId ?? null });
  },
  calculateIndex: async (patientId: string, start: string, end: string) => {
    const index = await calculateAdherenceIndexUC(repository, patientId, start, end);
    await recordClinicalAudit({ module: "adherence", action: "create", resourceType: "adherence_index", resourceId: index.id, patientId: index.patientId });
    return index;
  },
  createBarrier: async (input: { patientId: string; type: string; description: string; date: string; actionTaken?: string }) => {
    const barrier = await createBarrierEventUC(repository, input);
    await recordClinicalAudit({ module: "adherence", action: "create", resourceType: "barrier_event", resourceId: barrier.id, patientId: barrier.patientId });
    return barrier;
  },
  listBarriers: (patientId: string) =>
    listBarriersByPatientUC(repository, patientId),
};

export type AdherenceService = typeof adherenceService;
