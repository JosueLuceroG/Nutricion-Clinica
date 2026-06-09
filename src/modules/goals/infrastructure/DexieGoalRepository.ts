import type { Goal } from "../domain/Goal";
import type { GoalId } from "../domain/GoalId";
import type { GoalRepository } from "../domain/GoalRepository";
import type { GoalStatus } from "../domain/GoalTypes";
import { goalToRow, rowToGoal } from "./goalMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieGoalRepository implements GoalRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async save(goal: Goal): Promise<void> {
    const row = goalToRow(goal);
    await this.db.goals.put(row);
  }

  async findById(id: GoalId): Promise<Goal | null> {
    const row = await this.db.goals.get(id);
    return row ? rowToGoal(row) : null;
  }

  async findByPatient(patientId: string): Promise<Goal[]> {
    const rows = await this.db.goals.where("patient_id").equals(patientId).toArray();
    return rows.map(rowToGoal);
  }

  async findByStatus(status: GoalStatus): Promise<Goal[]> {
    const rows = await this.db.goals.where("status").equals(status).toArray();
    return rows.map(rowToGoal);
  }

  async findAll(): Promise<Goal[]> {
    const rows = await this.db.goals.toArray();
    return rows.map(rowToGoal);
  }

  async delete(id: GoalId): Promise<void> {
    await this.db.goals.delete(id);
  }
}
