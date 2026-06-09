import type { Goal, GoalProps } from "./Goal";
import type { GoalId } from "./GoalId";
import type { GoalStatus } from "./GoalTypes";

export interface GoalRepository {
  save(goal: Goal): Promise<void>;
  findById(id: GoalId): Promise<Goal | null>;
  findByPatient(patientId: string): Promise<Goal[]>;
  findByStatus(status: GoalStatus): Promise<Goal[]>;
  findAll(): Promise<Goal[]>;
  delete(id: GoalId): Promise<void>;
}

export class GoalNotFoundError extends Error {
  constructor(public readonly id: GoalId) {
    super(`Objetivo no encontrado: ${id}`);
    this.name = "GoalNotFoundError";
  }
}

export type { Goal, GoalId, GoalProps };
