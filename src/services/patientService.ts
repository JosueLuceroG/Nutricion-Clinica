import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";
import { DexieCascadingPatientDeletor, DexieLinkedEntitiesInspector } from "@modules/patient/infrastructure/cascadingPatientDeletor";
import { db } from "@services/db/dexieSchema";
import {
  CreatePatientUseCase,
  UpdatePatientUseCase,
  GetPatientUseCase,
  ListPatientsUseCase,
  DeletePatientUseCase,
  ArchivePatientUseCase,
  CascadeDeletePatientUseCase,
  CountLinkedEntitiesUseCase,
  RestorePatientUseCase,
  ListDeletedPatientsUseCase,
} from "@modules/patient/application/patientUseCases";
import type { PatientRepository } from "@modules/patient/domain/PatientRepository";

/**
 * Contenedor de dependencias simple.
 *
 * Mantener en un solo lugar la instanciación de adaptadores y casos de uso
 * facilita el swap a SQLite/Tauri (cambiar `repository` por otro adapter)
 * y los tests (inyectar un mock).
 */
const repository: PatientRepository = new DexiePatientRepository(db);
const cascade = new DexieCascadingPatientDeletor();
const inspector = new DexieLinkedEntitiesInspector();

export const patientService = {
  create: new CreatePatientUseCase(repository),
  update: new UpdatePatientUseCase(repository),
  get: new GetPatientUseCase(repository),
  list: new ListPatientsUseCase(repository),
  /** Soft-delete simple (sin cascada). Conservado por retro-compatibilidad. */
  delete: new DeletePatientUseCase(repository),
  /** Soft-delete en cascada. Borra paciente + consultas + planes + labs + antropometrias. */
  deleteCascade: new CascadeDeletePatientUseCase(repository, cascade),
  /** Cuenta entidades vinculadas a un paciente (para el modal de confirmación). */
  countLinked: new CountLinkedEntitiesUseCase(inspector),
  archive: new ArchivePatientUseCase(repository),
  /** Restaura un paciente soft-deleted a estado activo. */
  restore: new RestorePatientUseCase(repository),
  /** Lista los pacientes soft-deleted (papelera). */
  listDeleted: new ListDeletedPatientsUseCase(repository),
};

export type PatientService = typeof patientService;
