import type { Anthropometry } from "./Anthropometry";
import type { AnthropometryId } from "./AnthropometryId";
import type { PatientId } from "@modules/patient/domain/PatientId";

export interface AnthropometryQuery {
  patientId?: PatientId;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Puerto (interfaz) del repositorio de mediciones antropométricas.
 */
export interface AnthropometryRepository {
  save(measurement: Anthropometry): Promise<void>;
  findById(id: AnthropometryId): Promise<Anthropometry | null>;
  findAll(query?: AnthropometryQuery): Promise<Anthropometry[]>;
  count(query?: AnthropometryQuery): Promise<number>;
  delete(id: AnthropometryId, soft?: boolean): Promise<void>;
}

export class AnthropometryNotFoundError extends Error {
  constructor(public readonly id: AnthropometryId) {
    super(`Medición no encontrada: ${id.toString()}`);
    this.name = "AnthropometryNotFoundError";
  }
}
