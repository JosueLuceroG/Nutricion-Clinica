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
import {
  requireActiveSucursalId,
  rowMatchesSucursal,
  withSucursalScope,
} from "@services/tenancy/sucursalScope";

export class DexieAdherenceRepository implements AdherenceRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async saveRecord(record: AdherenceRecord): Promise<void> {
    const row = adherenceRecordToRow(record);
    const sucursalId = requireActiveSucursalId();
    const existing = await this.db.adherence_records.get(row.id).catch(() => null);
    assertOwnedBySucursal(existing, sucursalId, "El registro de adherencia");
    await this.db.adherence_records.put(withSucursalScope(row, sucursalId));
  }

  async findRecordById(id: AdherenceId): Promise<AdherenceRecord | null> {
    const row = await this.db.adherence_records.get(id);
    return row && !row.deleted_at && rowMatchesSucursal(row, requireActiveSucursalId())
      ? rowToAdherenceRecord(row)
      : null;
  }

  async findRecordsByPatient(patientId: string): Promise<AdherenceRecord[]> {
    const rows = await this.db.adherence_records.where("patient_id").equals(patientId).toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => !row.deleted_at && rowMatchesSucursal(row, sucursalId))
      .map(rowToAdherenceRecord);
  }

  async findRecordsByPatientAndRange(patientId: string, start: string, end: string): Promise<AdherenceRecord[]> {
    const rows = await this.db.adherence_records
      .where("[patient_id+date]")
      .between([patientId, start], [patientId, end], true, true)
      .toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => !row.deleted_at && rowMatchesSucursal(row, sucursalId))
      .map(rowToAdherenceRecord);
  }

  async deleteRecord(id: AdherenceId): Promise<void> {
    const row = await this.db.adherence_records.get(id);
    if (row && rowMatchesSucursal(row, requireActiveSucursalId())) {
      await this.db.adherence_records.delete(id);
    }
  }

  async saveIndex(index: AdherenceIndex): Promise<void> {
    const row = adherenceIndexToRow(index);
    const sucursalId = requireActiveSucursalId();
    const existing = await this.db.adherence_indexes.get(row.id).catch(() => null);
    assertOwnedBySucursal(existing, sucursalId, "El índice de adherencia");
    await this.db.adherence_indexes.put(withSucursalScope(row, sucursalId));
  }

  async findIndexesByPatient(patientId: string): Promise<AdherenceIndex[]> {
    const rows = await this.db.adherence_indexes.where("patient_id").equals(patientId).toArray();
    const sucursalId = requireActiveSucursalId();
    return rows.filter((row) => rowMatchesSucursal(row, sucursalId)).map(rowToAdherenceIndex);
  }

  async saveBarrier(barrier: BarrierEvent): Promise<void> {
    const row = barrierEventToRow(barrier);
    const sucursalId = requireActiveSucursalId();
    const existing = await this.db.adherence_barriers.get(row.id).catch(() => null);
    assertOwnedBySucursal(existing, sucursalId, "La barrera de adherencia");
    await this.db.adherence_barriers.put(withSucursalScope(row, sucursalId));
  }

  async findBarriersByPatient(patientId: string): Promise<BarrierEvent[]> {
    const rows = await this.db.adherence_barriers.where("patient_id").equals(patientId).toArray();
    const sucursalId = requireActiveSucursalId();
    return rows
      .filter((row) => rowMatchesSucursal(row, sucursalId))
      .map(rowToBarrierEvent);
  }

  async deleteBarrier(id: string): Promise<void> {
    const row = await this.db.adherence_barriers.get(id);
    if (row && rowMatchesSucursal(row, requireActiveSucursalId())) {
      await this.db.adherence_barriers.delete(id);
    }
  }
}

function assertOwnedBySucursal(
  row: { sucursal_id?: string | null } | null | undefined,
  sucursalId: string,
  label: string,
): void {
  if (row && !rowMatchesSucursal(row, sucursalId)) {
    throw new Error(`${label} pertenece a otra sucursal`);
  }
}
