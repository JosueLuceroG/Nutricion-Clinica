import type { Consultation } from "./Consultation";
import type { ConsultationId } from "./ConsultationId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { ConsultationStatus } from "./ConsultationStatus";

export interface ConsultationQuery {
  patientId?: PatientId;
  status?: ConsultationStatus | ConsultationStatus[];
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface ConsultationRepository {
  save(consultation: Consultation): Promise<void>;
  findById(id: ConsultationId): Promise<Consultation | null>;
  findAll(query?: ConsultationQuery): Promise<Consultation[]>;
  count(query?: ConsultationQuery): Promise<number>;
  delete(id: ConsultationId, soft?: boolean): Promise<void>;
  nextConsultationNumber(patientId: PatientId): Promise<number>;
}

export class ConsultationNotFoundError extends Error {
  constructor(public readonly id: ConsultationId) {
    super(`Consulta no encontrada: ${id.toString()}`);
    this.name = "ConsultationNotFoundError";
  }
}
