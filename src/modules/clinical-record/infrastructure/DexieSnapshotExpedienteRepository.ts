import type { SnapshotExpedienteRepository } from "../domain/SnapshotExpedienteRepository";
import type { SnapshotExpedienteProps } from "../domain/SnapshotExpediente";
import { snapshotExpedienteRowToProps, snapshotExpedientePropsToRow, type SnapshotExpedienteRow } from "./clinicalRecordMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieSnapshotExpedienteRepository implements SnapshotExpedienteRepository {
  private get table() { return this.db.snapshot_expedientes; }
  constructor(private readonly db: NutriClinicaDB) {}

  async findByConsultaId(consultaId: string): Promise<SnapshotExpedienteProps | null> {
    const row = await this.table.where("consulta_id").equals(consultaId).first();
    return row ? snapshotExpedienteRowToProps(row) : null;
  }

  async findByPatientId(patientId: string): Promise<SnapshotExpedienteProps[]> {
    const rows = await this.table.where("patient_id").equals(patientId).toArray();
    return rows.map(snapshotExpedienteRowToProps);
  }

  async save(snapshot: SnapshotExpedienteProps): Promise<void> {
    await this.table.put(snapshotExpedientePropsToRow(snapshot) as SnapshotExpedienteRow);
  }
}
