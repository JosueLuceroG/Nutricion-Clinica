import type { SnapshotExpedienteProps } from "./SnapshotExpediente";

export interface SnapshotExpedienteRepository {
  findByConsultaId(consultaId: string): Promise<SnapshotExpedienteProps | null>;
  findByPatientId(patientId: string): Promise<SnapshotExpedienteProps[]>;
  save(snapshot: SnapshotExpedienteProps): Promise<void>;
}
