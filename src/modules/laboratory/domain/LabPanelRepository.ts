import type { LabPanel } from "./LabPanel";
import type { LabPanelId } from "./LabPanelId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export interface LabPanelQuery {
  patientId?: PatientId;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface LabPanelRepository {
  save(panel: LabPanel): Promise<void>;
  findById(id: LabPanelId): Promise<LabPanel | null>;
  findAll(query?: LabPanelQuery): Promise<LabPanel[]>;
  count(query?: LabPanelQuery): Promise<number>;
  delete(id: LabPanelId, soft?: boolean): Promise<void>;
}

export class LabPanelNotFoundError extends Error {
  constructor(public readonly id: LabPanelId) {
    super(`Panel de laboratorio no encontrado: ${id.toString()}`);
    this.name = "LabPanelNotFoundError";
  }
}
