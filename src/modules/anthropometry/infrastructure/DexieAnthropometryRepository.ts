import type { Anthropometry } from "../domain/Anthropometry";
import type { AnthropometryId } from "../domain/AnthropometryId";
import type {
  AnthropometryQuery,
  AnthropometryRepository,
} from "../domain/AnthropometryRepository";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { AnthropometryRow } from "./anthropometryMapper";
import { anthropometryRowToDomain, anthropometryDomainToRow } from "./anthropometryMapper";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { Collection } from "dexie";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class DexieAnthropometryRepository implements AnthropometryRepository {
  constructor(private readonly dbInstance: NutriClinicaDB = new NutriClinicaDB()) {}

  async save(measurement: Anthropometry): Promise<void> {
    const row = anthropometryDomainToRow(measurement);
    await this.dbInstance.anthropometry.put(row);
  }

  async findById(id: AnthropometryId): Promise<Anthropometry | null> {
    const row = await this.dbInstance.anthropometry.get(id.toString());
    if (!row) return null;
    return anthropometryRowToDomain(row);
  }

  async findAll(query: AnthropometryQuery = {}): Promise<Anthropometry[]> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;

    const rows = await this.applyFilters(
      this.dbInstance.anthropometry.orderBy("[patient_id+measured_at]").reverse(),
      query,
    )
      .filter((row: AnthropometryRow) => row.deleted_at === null)
      .offset(offset)
      .limit(limit)
      .toArray();

    return rows.map(anthropometryRowToDomain);
  }

  async count(query: AnthropometryQuery = {}): Promise<number> {
    return this.applyFilters(this.dbInstance.anthropometry.toCollection(), query)
      .filter((row: AnthropometryRow) => row.deleted_at === null)
      .count();
  }

  async delete(id: AnthropometryId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.dbInstance.anthropometry.get(id.toString());
      if (!existing) return;
      const domain = anthropometryRowToDomain(existing);
      const deleted = domain.softDelete();
      await this.dbInstance.anthropometry.put(anthropometryDomainToRow(deleted));
    } else {
      await this.dbInstance.anthropometry.delete(id.toString());
    }
  }

  private applyFilters(
    source: Collection<AnthropometryRow, string>,
    query: AnthropometryQuery,
  ): Collection<AnthropometryRow, string> {
    let collection: Collection<AnthropometryRow, string> = source;
    if (query.patientId) {
      const pid = query.patientId.toString();
      collection = source.filter((row: AnthropometryRow) => row.patient_id === pid);
    }
    if (query.from) {
      const fromIso = query.from.toISOString();
      collection = source.filter((row: AnthropometryRow) => row.measured_at >= fromIso);
    }
    if (query.to) {
      const toIso = query.to.toISOString();
      collection = source.filter((row: AnthropometryRow) => row.measured_at <= toIso);
    }
    return collection;
  }
}

export type { AnthropometryRow };
export type { PatientId };
