import { AdherenceRecord } from "../domain/AdherenceRecord";
import { AdherenceIndex, calculateAdherenceIndex } from "../domain/AdherenceIndex";
import { BarrierEvent } from "../domain/BarrierEvent";
import { createAdherenceId, type AdherenceId } from "../domain/AdherenceId";
import type { AdherenceRepository } from "../domain/AdherenceRepository";
import type { AdherenceFormInput } from "./adherenceFormSchema";

export const createAdherenceRecordUC = async (
  repo: AdherenceRepository,
  input: AdherenceFormInput,
): Promise<AdherenceRecord> => {
  const record = AdherenceRecord.create({
    id: createAdherenceId(),
    patientId: input.patientId,
    date: input.date,
    consultationId: input.consultationId,
    source: input.source,
    adherenceMenu: input.adherenceMenu,
    adherenceWater: input.adherenceWater,
    adherenceActivity: input.adherenceActivity,
    adherenceSupplements: input.adherenceSupplements,
    adherenceSleep: input.adherenceSleep,
    hungerAvg: input.hungerAvg,
    satietyAvg: input.satietyAvg,
    moodAvg: input.moodAvg,
    energyAvg: input.energyAvg,
    intercurrentEvents: input.intercurrentEvents,
    barriers: input.barriers,
    facilitators: input.facilitators,
    mealsLogged: input.mealsLogged,
    notes: input.notes,
  });
  await repo.saveRecord(record);
  return record;
};

export const listAdherenceByPatientUC = async (
  repo: AdherenceRepository,
  patientId: string,
): Promise<AdherenceRecord[]> => {
  return repo.findRecordsByPatient(patientId);
};

export const getAdherenceByIdUC = async (
  repo: AdherenceRepository,
  id: AdherenceId,
): Promise<AdherenceRecord | null> => {
  return repo.findRecordById(id);
};

export const deleteAdherenceRecordUC = async (
  repo: AdherenceRepository,
  id: AdherenceId,
): Promise<void> => {
  await repo.deleteRecord(id);
};

export const calculateAdherenceIndexUC = async (
  repo: AdherenceRepository,
  patientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<AdherenceIndex> => {
  const records = await repo.findRecordsByPatientAndRange(patientId, periodStart, periodEnd);
  const scores = calculateAdherenceIndex(records);
  const index = AdherenceIndex.create({
    patientId,
    periodStart,
    periodEnd,
    ...scores,
  });
  await repo.saveIndex(index);
  return index;
};

export const createBarrierEventUC = async (
  repo: AdherenceRepository,
  input: { patientId: string; type: string; description: string; date: string; actionTaken?: string },
): Promise<BarrierEvent> => {
  const barrier = BarrierEvent.create({
    patientId: input.patientId,
    type: input.type as BarrierEvent["type"],
    description: input.description,
    date: input.date,
    actionTaken: input.actionTaken ?? "",
  });
  await repo.saveBarrier(barrier);
  return barrier;
};

export const listBarriersByPatientUC = async (
  repo: AdherenceRepository,
  patientId: string,
): Promise<BarrierEvent[]> => {
  return repo.findBarriersByPatient(patientId);
};
