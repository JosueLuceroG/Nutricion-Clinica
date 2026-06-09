import type { LabPanel } from "../domain/LabPanel";
import type { LabPanelId } from "../domain/LabPanelId";
import type { LabPanelQuery, LabPanelRepository } from "../domain/LabPanelRepository";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { LabPanelRow } from "./labPanelMapper";
import { labPanelRowToDomain, labPanelDomainToRow } from "./labPanelMapper";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { Collection } from "dexie";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class DexieLabPanelRepository implements LabPanelRepository {
  constructor(private readonly dbInstance: NutriClinicaDB = new NutriClinicaDB()) {}

  async save(panel: LabPanel): Promise<void> {
    const row = labPanelDomainToRow(panel);
    await this.dbInstance.lab_panels.put(row);
  }

  async findById(id: LabPanelId): Promise<LabPanel | null> {
    const row = await this.dbInstance.lab_panels.get(id.toString());
    if (!row) return null;
    return labPanelRowToDomain(row);
  }

  async findAll(query: LabPanelQuery = {}): Promise<LabPanel[]> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;

    const rows = await this.applyFilters(
      this.dbInstance.lab_panels.orderBy("[patient_id+taken_at]").reverse(),
      query,
    )
      .filter((row: LabPanelRow) => row.deleted_at === null)
      .offset(offset)
      .limit(limit)
      .toArray();

    return rows.map(labPanelRowToDomain);
  }

  async count(query: LabPanelQuery = {}): Promise<number> {
    return this.applyFilters(this.dbInstance.lab_panels.toCollection(), query)
      .filter((row: LabPanelRow) => row.deleted_at === null)
      .count();
  }

  async delete(id: LabPanelId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.dbInstance.lab_panels.get(id.toString());
      if (!existing) return;
      const domain = labPanelRowToDomain(existing);
      const deleted = domain.softDelete();
      await this.dbInstance.lab_panels.put(labPanelDomainToRow(deleted));
    } else {
      await this.dbInstance.lab_panels.delete(id.toString());
    }
  }

  private applyFilters(
    source: Collection<LabPanelRow, string>,
    query: LabPanelQuery,
  ): Collection<LabPanelRow, string> {
    let collection: Collection<LabPanelRow, string> = source;
    if (query.patientId) {
      const pid = query.patientId.toString();
      collection = collection.filter((row: LabPanelRow) => row.patient_id === pid);
    }
    if (query.from) {
      const fromIso = query.from.toISOString();
      collection = collection.filter((row: LabPanelRow) => row.taken_at >= fromIso);
    }
    if (query.to) {
      const toIso = query.to.toISOString();
      collection = collection.filter((row: LabPanelRow) => row.taken_at <= toIso);
    }
    return collection;
  }
}

export type { LabPanelRow, PatientId };
