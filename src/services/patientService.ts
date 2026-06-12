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
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

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
const createPatient = new CreatePatientUseCase(repository);
const updatePatient = new UpdatePatientUseCase(repository);
const deletePatient = new DeletePatientUseCase(repository);
const deletePatientCascade = new CascadeDeletePatientUseCase(repository, cascade);
const archivePatient = new ArchivePatientUseCase(repository);
const restorePatient = new RestorePatientUseCase(repository);

export const patientService = {
  create: {
    async execute(input: Parameters<typeof createPatient.execute>[0]): ReturnType<typeof createPatient.execute> {
      const patient = await createPatient.execute(input);
      const patientId = patient.id.toString();
      await recordClinicalAudit({ module: "patients", action: "create", resourceType: "patient", resourceId: patientId, patientId });
      return patient;
    },
  },
  update: {
    async execute(id: Parameters<typeof updatePatient.execute>[0], updates: Parameters<typeof updatePatient.execute>[1]): ReturnType<typeof updatePatient.execute> {
      const patient = await updatePatient.execute(id, updates);
      const patientId = patient.id.toString();
      await recordClinicalAudit({ module: "patients", action: "update", resourceType: "patient", resourceId: patientId, patientId });
      return patient;
    },
  },
  get: new GetPatientUseCase(repository),
  list: new ListPatientsUseCase(repository),
  /** Soft-delete simple (sin cascada). Conservado por retro-compatibilidad. */
  delete: {
    async execute(id: Parameters<typeof deletePatient.execute>[0], soft = true): ReturnType<typeof deletePatient.execute> {
      await deletePatient.execute(id, soft);
      const patientId = id.toString();
      await recordClinicalAudit({ module: "patients", action: soft ? "soft_delete" : "remove", resourceType: "patient", resourceId: patientId, patientId });
    },
  },
  /** Soft-delete en cascada. Borra paciente + consultas + planes + labs + antropometrias. */
  deleteCascade: {
    async execute(patientIdInput: Parameters<typeof deletePatientCascade.execute>[0]): ReturnType<typeof deletePatientCascade.execute> {
      await deletePatientCascade.execute(patientIdInput);
      const patientId = patientIdInput.toString();
      await recordClinicalAudit({ module: "patients", action: "soft_delete", resourceType: "patient", resourceId: patientId, patientId, justification: "cascade" });
    },
  },
  /** Cuenta entidades vinculadas a un paciente (para el modal de confirmación). */
  countLinked: new CountLinkedEntitiesUseCase(inspector),
  archive: {
    async execute(id: Parameters<typeof archivePatient.execute>[0]): ReturnType<typeof archivePatient.execute> {
      const patient = await archivePatient.execute(id);
      const patientId = patient.id.toString();
      await recordClinicalAudit({ module: "patients", action: "soft_delete", resourceType: "patient", resourceId: patientId, patientId, justification: "archive" });
      return patient;
    },
  },
  /** Restaura un paciente soft-deleted a estado activo. */
  restore: {
    async execute(id: Parameters<typeof restorePatient.execute>[0]): ReturnType<typeof restorePatient.execute> {
      const patient = await restorePatient.execute(id);
      const patientId = patient.id.toString();
      await recordClinicalAudit({ module: "patients", action: "update", resourceType: "patient", resourceId: patientId, patientId, justification: "restore" });
      return patient;
    },
  },
  /** Lista los pacientes soft-deleted (papelera). */
  listDeleted: new ListDeletedPatientsUseCase(repository),
};

export type PatientService = typeof patientService;
