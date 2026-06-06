import { Patient, type PatientCreate, type PatientUpdate } from "./Patient";
import { PatientId } from "./PatientId";

export interface PatientQuery {
  search?: string;
  status?: Patient["status"];
  sex?: Patient["sex"];
  limit?: number;
  offset?: number;
  /**
   * Por defecto los soft-deleted (`deleted_at != null`) se excluyen.
   * Si `true`, se incluyen en los resultados. Útil para la vista de
   * "papelera" / pacientes eliminados.
   */
  includeDeleted?: boolean;
}

/**
 * Puerto (interfaz) del repositorio de pacientes.
 * Las implementaciones viven en la capa de infraestructura
 * (SQLite vía Tauri, IndexedDB para sync queue, mock para tests, etc.).
 */
export interface PatientRepository {
  save(patient: Patient): Promise<void>;
  findById(id: PatientId): Promise<Patient | null>;
  findAll(query?: PatientQuery): Promise<Patient[]>;
  count(query?: PatientQuery): Promise<number>;
  /**
   * Devuelve solo los pacientes soft-deleted, ordenados por deletedAt desc
   * (más reciente primero). Limit/offset para paginación.
   */
  findDeleted(query?: { limit?: number; offset?: number }): Promise<Patient[]>;
  countDeleted(): Promise<number>;
  delete(id: PatientId, soft?: boolean): Promise<void>;
}

export class PatientNotFoundError extends Error {
  constructor(public readonly id: PatientId) {
    super(`Paciente no encontrado: ${id.toString()}`);
    this.name = "PatientNotFoundError";
  }
}

export class DuplicatePatientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicatePatientError";
  }
}

export { PatientId, Patient, type PatientCreate, type PatientUpdate };
