import {
  Patient,
  type PatientCreate,
  type PatientUpdate,
  type PatientQuery,
  type PatientRepository,
  PatientNotFoundError,
} from "../domain/PatientRepository";
import type { PatientId } from "../domain/PatientId";

export interface LinkedCounts {
  consultations: number;
  mealPlans: number;
  labPanels: number;
  anthropometry: number;
}

/**
 * Puerto para inspeccionar entidades vinculadas a un paciente.
 * Lo expone el container de dependencias (patientService) y lo consume
 * CascadeDeletePatientUseCase + la UI para mostrar el modal de
 * confirmación con conteos antes de borrar.
 */
export interface LinkedEntitiesInspector {
  countForPatient(patientId: PatientId): Promise<LinkedCounts>;
}

/**
 * Puerto para soft-delete en cascada. Mantiene aislado el caso de uso
 * de los detalles de Dexie: las implementaciones viven en la capa de
 * infraestructura (cascadingPatientDeletor.ts).
 */
export interface CascadingPatientDeletor {
  softDeleteCascade(patientId: PatientId): Promise<void>;
}

export class CreatePatientUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(input: PatientCreate): Promise<Patient> {
    const patient = Patient.create(input);
    await this.repo.save(patient);
    return patient;
  }
}

export class UpdatePatientUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(id: PatientId, updates: PatientUpdate): Promise<Patient> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new PatientNotFoundError(id);
    }
    const updated = existing.with(updates);
    await this.repo.save(updated);
    return updated;
  }
}

export class GetPatientUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(id: PatientId): Promise<Patient> {
    const patient = await this.repo.findById(id);
    if (!patient) {
      throw new PatientNotFoundError(id);
    }
    return patient;
  }
}

export class ListPatientsUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(
    query?: PatientQuery,
  ): Promise<{ items: Patient[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return { items, total };
  }
}

/**
 * Vista de "papelera": devuelve los pacientes soft-deleted. El UI los
 * muestra en una pestaña separada con opción de Restaurar.
 */
export class ListDeletedPatientsUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(
    query: { limit?: number; offset?: number } = {},
  ): Promise<{ items: Patient[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findDeleted(query),
      this.repo.countDeleted(),
    ]);
    return { items, total };
  }
}

export class CountLinkedEntitiesUseCase {
  constructor(private readonly inspector: LinkedEntitiesInspector) {}

  async execute(patientId: PatientId): Promise<LinkedCounts> {
    return this.inspector.countForPatient(patientId);
  }
}

export class DeletePatientUseCase {
  /**
   * Soft-delete simple (sin cascada). Usado por el flujo legacy; el
   * flujo recomendado es `CascadeDeletePatientUseCase` que pregunta
   * antes al usuario qué hacer con sus entidades vinculadas.
   */
  constructor(private readonly repo: PatientRepository) {}

  async execute(id: PatientId, soft = true): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new PatientNotFoundError(id);
    }
    await this.repo.delete(id, soft);
  }
}

export class ArchivePatientUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(id: PatientId): Promise<Patient> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new PatientNotFoundError(id);
    }
    const archived = existing.with({ status: "archived" });
    await this.repo.save(archived);
    return archived;
  }
}

/**
 * Restaura un paciente soft-deleted (con `deletedAt` no nulo) a estado
 * activo. Limpia `deletedAt` y vuelve `status` a "active".
 *
 * La fila permanece en la lista activa después de restaurar. El sync
 * engine empujará la actualización al servidor como un `update` normal;
 * el server (con `applyUpdate` modificado) detectará el cambio en
 * `deleted_at` y revivirá la fila correspondiente.
 */
export class RestorePatientUseCase {
  constructor(private readonly repo: PatientRepository) {}

  async execute(id: PatientId): Promise<Patient> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new PatientNotFoundError(id);
    }
    if (existing.deletedAt === null) {
      // Ya está activo: idempotente, devolvemos el mismo paciente.
      return existing;
    }
    const restored = Patient.reconstitute({
      id: existing.id,
      firstName: existing.firstName,
      lastName: existing.lastName,
      secondLastName: existing.secondLastName,
      birthDate: existing.birthDate,
      sex: existing.sex,
      gender: existing.gender,
      maritalStatus: existing.maritalStatus,
      occupation: existing.occupation,
      education: existing.education,
      email: existing.email,
      phone: existing.phone,
      secondaryPhone: existing.secondaryPhone,
      whatsappEnabled: existing.whatsappEnabled,
      emergencyContactName: existing.emergencyContactName,
      emergencyContactRelationship: existing.emergencyContactRelationship,
      emergencyContactPhone: existing.emergencyContactPhone,
      recordStatus: existing.recordStatus,
      recordOpenedAt: existing.recordOpenedAt,
      generalNotes: existing.generalNotes,
      consentimientoInformadoId: existing.consentimientoInformadoId,
      fechaFirmaConsentimiento: existing.fechaFirmaConsentimiento,
      versionPoliticaPrivacidad: existing.versionPoliticaPrivacidad,
      clinicalTags: existing.clinicalTags,
      claveInterna: existing.claveInterna,
      birthPlace: existing.birthPlace,
      address: existing.address,
      nationality: existing.nationality,
      idType: existing.idType,
      idNumber: existing.idNumber,
      dischargeReason: existing.dischargeReason,
      responsibleProfessionalId: existing.responsibleProfessionalId,
      externalRecordNumber: existing.externalRecordNumber,
      admissionReason: existing.admissionReason,
      photoUrl: existing.photoUrl,
      status: "active",
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    await this.repo.save(restored);
    return restored;
  }
}

/**
 * Soft-delete en cascada: marca el paciente + todas sus consultas +
 * planes + laboratorios + antropometrias como deleted. Cada cambio
 * se persiste por separado para que el SyncEnqueuer encole cada fila
 * individualmente y el push las borre en el servidor también.
 */
export class CascadeDeletePatientUseCase {
  constructor(
    private readonly repo: PatientRepository,
    private readonly cascade: CascadingPatientDeletor,
  ) {}

  async execute(patientId: PatientId): Promise<void> {
    const existing = await this.repo.findById(patientId);
    if (!existing) {
      throw new PatientNotFoundError(patientId);
    }
    // 1) cascade primero: cada tabla soft-deletea sus filas por patient_id
    // 2) después el paciente, así si el cascade falla no queda el paciente
    //    sin sus entidades vinculadas (estado inconsistente).
    await this.cascade.softDeleteCascade(patientId);
    await this.repo.delete(patientId, true);
  }
}
