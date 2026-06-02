import { Patient, type PatientCreate, type PatientUpdate, type PatientQuery, type PatientRepository, PatientNotFoundError } from "../domain/PatientRepository";
import type { PatientId } from "../domain/PatientId";

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

  async execute(query?: PatientQuery): Promise<{ items: Patient[]; total: number }> {
    const [items, total] = await Promise.all([
      this.repo.findAll(query),
      this.repo.count(query),
    ]);
    return { items, total };
  }
}

export class DeletePatientUseCase {
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
