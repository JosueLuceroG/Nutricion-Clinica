import type { Consultation } from "../domain/Consultation";
import type { ConsultationId } from "../domain/ConsultationId";
import type { ConsultationStatus } from "../domain/ConsultationStatus";
import type {
  ConsultationQuery,
  ConsultationRepository,
} from "../domain/ConsultationRepository";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { ConsultationRow } from "./consultationMapper";
import { consultationRowToDomain, consultationDomainToRow } from "./consultationMapper";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { Collection } from "dexie";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class DexieConsultationRepository implements ConsultationRepository {
  constructor(private readonly dbInstance: NutriClinicaDB = new NutriClinicaDB()) {}

  async save(consultation: Consultation): Promise<void> {
    const row = consultationDomainToRow(consultation);
    await this.dbInstance.consultations.put(row);
  }

  async findById(id: ConsultationId): Promise<Consultation | null> {
    const row = await this.dbInstance.consultations.get(id.toString());
    if (!row) return null;
    return consultationRowToDomain(row);
  }

  async findAll(query: ConsultationQuery = {}): Promise<Consultation[]> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;

    const rows = await this.applyFilters(
      this.dbInstance.consultations.orderBy("[patient_id+consultation_date]").reverse(),
      query,
    )
      .filter((row: ConsultationRow) => row.deleted_at === null)
      .offset(offset)
      .limit(limit)
      .toArray();

    return rows.map(consultationRowToDomain);
  }

  async count(query: ConsultationQuery = {}): Promise<number> {
    return this.applyFilters(this.dbInstance.consultations.toCollection(), query)
      .filter((row: ConsultationRow) => row.deleted_at === null)
      .count();
  }

  async delete(id: ConsultationId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.dbInstance.consultations.get(id.toString());
      if (!existing) return;
      const domain = consultationRowToDomain(existing);
      const deleted = domain.softDelete();
      await this.dbInstance.consultations.put(consultationDomainToRow(deleted));
    } else {
      await this.dbInstance.consultations.delete(id.toString());
    }
  }

  async nextConsultationNumber(patientId: PatientId): Promise<number> {
    const pid = patientId.toString();
    const maxNumber = await this.dbInstance.consultations
      .where("[patient_id+consultation_date]")
      .between([pid, ""], [pid, "\uffff"])
      .filter((row: ConsultationRow) => row.deleted_at === null)
      .toArray()
      .then((rows) => rows.reduce((max, r) => Math.max(max, r.consultation_number), 0));
    return maxNumber + 1;
  }

  private applyFilters(
    source: Collection<ConsultationRow, string>,
    query: ConsultationQuery,
  ): Collection<ConsultationRow, string> {
    let collection: Collection<ConsultationRow, string> = source;
    if (query.patientId) {
      const pid = query.patientId.toString();
      collection = source.filter((row: ConsultationRow) => row.patient_id === pid);
    }
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      const statusSet = new Set<ConsultationStatus>(statuses);
      collection = source.filter((row: ConsultationRow) => statusSet.has(row.status));
    }
    if (query.from) {
      const fromIso = query.from.toISOString();
      collection = source.filter((row: ConsultationRow) => row.consultation_date >= fromIso);
    }
    if (query.to) {
      const toIso = query.to.toISOString();
      collection = source.filter((row: ConsultationRow) => row.consultation_date <= toIso);
    }
    return collection;
  }
}

export type { ConsultationRow, PatientId };
