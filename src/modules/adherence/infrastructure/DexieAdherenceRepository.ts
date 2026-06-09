import type { AdherenceRecord } from "../domain/AdherenceRecord";
import type { AdherenceId } from "../domain/AdherenceId";
import type { AdherenceRepository } from "../domain/AdherenceRepository";
import type { AdherenceIndex } from "../domain/AdherenceIndex";
import type { BarrierEvent } from "../domain/BarrierEvent";
import {
  adherenceRecordToRow, rowToAdherenceRecord,
  adherenceIndexToRow, rowToAdherenceIndex,
  barrierEventToRow, rowToBarrierEvent,
} from "./adherenceMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieAdherenceRepository implements AdherenceRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async saveRecord(record: AdherenceRecord): Promise<void> {
    await this.db.adherence_records.put(adherenceRecordToRow(record));
  }

  async findRecordById(id: AdherenceId): Promise<AdherenceRecord | null> {
    const row = await this.db.adherence_records.get(id);
    return row ? rowToAdherenceRecord(row) : null;
  }

  async findRecordsByPatient(patientId: string): Promise<AdherenceRecord[]> {
    const rows = await this.db.adherence_records.where("patient_id").equals(patientId).toArray();
    return rows.map(rowToAdherenceRecord);
  }

  async findRecordsByPatientAndRange(patientId: string, start: string, end: string): Promise<AdherenceRecord[]> {
    const rows = await this.db.adherence_records
      .where("[patient_id+date]")
      .between([patientId, start], [patientId, end], true, true)
      .toArray();
    return rows.map(rowToAdherenceRecord);
  }

  async deleteRecord(id: AdherenceId): Promise<void> {
    await this.db.adherence_records.delete(id);
  }

  async saveIndex(index: AdherenceIndex): Promise<void> {
    await this.db.adherence_indexes.put(adherenceIndexToRow(index));
  }

  async findIndexesByPatient(patientId: string): Promise<AdherenceIndex[]> {
    const rows = await this.db.adherence_indexes.where("patient_id").equals(patientId).toArray();
    return rows.map(rowToAdherenceIndex);
  }

  async saveBarrier(barrier: BarrierEvent): Promise<void> {
    await this.db.adherence_barriers.put(barrierEventToRow(barrier));
  }

  async findBarriersByPatient(patientId: string): Promise<BarrierEvent[]> {
    const rows = await this.db.adherence_barriers.where("patient_id").equals(patientId).toArray();
    return rows.map(rowToBarrierEvent);
  }

  async deleteBarrier(id: string): Promise<void> {
    await this.db.adherence_barriers.delete(id);
  }
}
