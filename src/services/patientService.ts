import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreatePatientUseCase,
  UpdatePatientUseCase,
  GetPatientUseCase,
  ListPatientsUseCase,
  DeletePatientUseCase,
  ArchivePatientUseCase,
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

export const patientService = {
  create: new CreatePatientUseCase(repository),
  update: new UpdatePatientUseCase(repository),
  get: new GetPatientUseCase(repository),
  list: new ListPatientsUseCase(repository),
  delete: new DeletePatientUseCase(repository),
  archive: new ArchivePatientUseCase(repository),
};

export type PatientService = typeof patientService;
