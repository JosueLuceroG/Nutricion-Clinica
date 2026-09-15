import type { MealPlan } from "../domain/MealPlan";
import type { MealPlanId } from "../domain/MealPlanId";
import type { MealPlanStatus } from "../domain/MealPlanStatus";
import type { MealPlanQuery, MealPlanRepository } from "../domain/MealPlanRepository";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { MealPlanRow } from "./mealPlanMapper";
import { mealPlanRowToDomain, mealPlanDomainToRow } from "./mealPlanMapper";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { requireActiveSucursalId, rowMatchesSucursal, withSucursalScope } from "@services/tenancy/sucursalScope";
import type { Collection } from "dexie";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export class DexieMealPlanRepository implements MealPlanRepository {
  constructor(private readonly dbInstance: NutriClinicaDB = new NutriClinicaDB()) {}

  async save(plan: MealPlan): Promise<void> {
    const row = mealPlanDomainToRow(plan);
    const sucursalId = requireActiveSucursalId();
    const existing = await this.dbInstance.meal_plans.get(row.id).catch(() => null);
    assertOwnedBySucursal(existing, sucursalId);
    await this.dbInstance.meal_plans.put(withSucursalScope(row, sucursalId));
  }

  async findById(id: MealPlanId): Promise<MealPlan | null> {
    const row = await this.dbInstance.meal_plans.get(id.toString());
    if (!row || row.deleted_at != null ||
      !rowMatchesSucursal(row, requireActiveSucursalId())) return null;
    return mealPlanRowToDomain(row);
  }

  async findAll(query: MealPlanQuery = {}): Promise<MealPlan[]> {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = query.offset ?? 0;

    const rows = await this.applyFilters(
      this.dbInstance.meal_plans.orderBy("[patient_id+start_date]").reverse(),
      query,
    )
      .filter((row: MealPlanRow) => row.deleted_at === null)
      .offset(offset)
      .limit(limit)
      .toArray();

    return rows.map(mealPlanRowToDomain);
  }

  async count(query: MealPlanQuery = {}): Promise<number> {
    return this.applyFilters(this.dbInstance.meal_plans.toCollection(), query)
      .filter((row: MealPlanRow) => row.deleted_at === null)
      .count();
  }

  async delete(id: MealPlanId, soft = true): Promise<void> {
    if (soft) {
      const existing = await this.dbInstance.meal_plans.get(id.toString());
      if (!existing) return;
      const sucursalId = requireActiveSucursalId();
      if (!rowMatchesSucursal(existing, sucursalId)) return;
      const domain = mealPlanRowToDomain(existing);
      const deleted = domain.softDelete();
      await this.dbInstance.meal_plans.put(withSucursalScope(mealPlanDomainToRow(deleted), sucursalId));
    } else {
      const existing = await this.dbInstance.meal_plans.get(id.toString());
      if (existing && rowMatchesSucursal(existing, requireActiveSucursalId())) {
        await this.dbInstance.meal_plans.delete(id.toString());
      }
    }
  }

  private applyFilters(
    source: Collection<MealPlanRow, string>,
    query: MealPlanQuery,
  ): Collection<MealPlanRow, string> {
    let collection: Collection<MealPlanRow, string> = source;
    const activeSucursalId = requireActiveSucursalId();
    collection = collection.filter((row: MealPlanRow) =>
      rowMatchesSucursal(row, activeSucursalId));
    if (query.sucursalId) {
      const sucursalId = query.sucursalId;
      collection = collection.filter((row: MealPlanRow) => rowMatchesSucursal(row, sucursalId));
    }
    if (query.patientId) {
      const pid = query.patientId.toString();
      collection = collection.filter((row: MealPlanRow) => row.patient_id === pid);
    }
    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status];
      const statusSet = new Set<MealPlanStatus>(statuses);
      collection = collection.filter((row: MealPlanRow) => statusSet.has(row.status));
    }
    if (query.from) {
      const fromIso = query.from.toISOString();
      collection = collection.filter((row: MealPlanRow) => row.start_date >= fromIso);
    }
    if (query.to) {
      const toIso = query.to.toISOString();
      collection = collection.filter((row: MealPlanRow) => row.start_date <= toIso);
    }
    return collection;
  }
}

function assertOwnedBySucursal(
  row: MealPlanRow | null | undefined,
  sucursalId: string,
): void {
  if (row && !rowMatchesSucursal(row, sucursalId)) {
    throw new Error("El plan pertenece a otra sucursal");
  }
}

export type { MealPlanRow, PatientId };
