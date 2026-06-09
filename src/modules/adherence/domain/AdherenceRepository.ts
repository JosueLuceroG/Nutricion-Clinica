import type { AdherenceRecord, AdherenceRecordProps } from "./AdherenceRecord";
import type { AdherenceId } from "./AdherenceId";
import type { BarrierEvent, BarrierEventProps } from "./BarrierEvent";
import type { AdherenceIndex, AdherenceIndexProps } from "./AdherenceIndex";

export interface AdherenceRepository {
  saveRecord(record: AdherenceRecord): Promise<void>;
  findRecordById(id: AdherenceId): Promise<AdherenceRecord | null>;
  findRecordsByPatient(patientId: string): Promise<AdherenceRecord[]>;
  findRecordsByPatientAndRange(patientId: string, start: string, end: string): Promise<AdherenceRecord[]>;
  deleteRecord(id: AdherenceId): Promise<void>;

  saveIndex(index: AdherenceIndex): Promise<void>;
  findIndexesByPatient(patientId: string): Promise<AdherenceIndex[]>;

  saveBarrier(barrier: BarrierEvent): Promise<void>;
  findBarriersByPatient(patientId: string): Promise<BarrierEvent[]>;
  deleteBarrier(id: string): Promise<void>;
}

export class AdherenceNotFoundError extends Error {
  constructor(public readonly id: AdherenceId) {
    super(`Registro de adherencia no encontrado: ${id}`);
    this.name = "AdherenceNotFoundError";
  }
}

export type { AdherenceRecord, AdherenceRecordProps, AdherenceId };
export type { BarrierEvent, BarrierEventProps };
export type { AdherenceIndex, AdherenceIndexProps };
