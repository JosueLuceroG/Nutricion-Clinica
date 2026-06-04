import type { PatientRepository, PatientQuery } from "../domain/PatientRepository";
import type { Patient } from "../domain/Patient";
import type { PatientId } from "../domain/PatientId";
import type { PatientRow } from "./patientMapper";
import { patientRowToDomain, patientDomainToRow } from "./patientMapper";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { Collection } from "dexie";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class DexiePatientRepository implements PatientRepository {
  constructor(private readonly dbInstance: NutriClinicaDB = new NutriClinicaDB()) {}

  async save(patient: Patient): Promise<void> {
    const row = patientDomainToRow(patient);
    await this.dbInstance.patients.put(row);
  }

  async findById(id: PatientId): Promise<Patient | null> {
    const row = await this.dbInstance.patients.get(id.toString());
    if (!row) return null;
    return patientRowToDomain(row);
  }

  async findAll(query: PatientQuery = {}): Promise<Patient[]> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;

    const rows = await this.applyFilters(this.dbInstance.patients.orderBy("last_name"), query)
      .filter((row: PatientRow) => row.deleted_at === null)
      .offset(offset)
      .limit(limit)
      .toArray();

    return rows.map(patientRowToDomain);
  }

  async count(query: PatientQuery = {}): Promise<number> {
    return this.applyFilters(this.dbInstance.patients.toCollection(), query)
      .filter((row: PatientRow) => row.deleted_at === null)
      .count();
  }

  async delete(id: PatientId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.dbInstance.patients.get(id.toString());
      if (!existing) return;
      const domain = patientRowToDomain(existing);
      const deleted = domain.softDelete();
      await this.dbInstance.patients.put(patientDomainToRow(deleted));
    } else {
      await this.dbInstance.patients.delete(id.toString());
    }
  }

  private applyFilters(
    source: Collection<PatientRow, string>,
    query: PatientQuery,
  ): Collection<PatientRow, string> {
    let collection: Collection<PatientRow, string> = source;
    if (query.status) {
      const status = query.status;
      collection = source.filter((row: PatientRow) => row.status === status);
    }
    if (query.sex) {
      const sex = query.sex;
      collection = source.filter((row: PatientRow) => row.sex === sex);
    }
    if (query.search) {
      const needle = query.search.toLowerCase().trim();
      collection = source.filter(
        (row: PatientRow) =>
          row.first_name.toLowerCase().includes(needle) ||
          row.last_name.toLowerCase().includes(needle) ||
          (row.second_last_name !== null && row.second_last_name.toLowerCase().includes(needle)) ||
          (row.email !== null && row.email.toLowerCase().includes(needle)),
      );
    }
    return collection;
  }
}
