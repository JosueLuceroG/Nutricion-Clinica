import { db } from "@services/db/dexieSchema";
import { DexieGoalRepository } from "@modules/goals/infrastructure/DexieGoalRepository";
import {
  createGoalUC, updateGoalUC, listGoalsByPatientUC, listAllGoalsUC,
  getGoalByIdUC, deleteGoalUC, pauseGoalUC, achieveGoalUC,
  abandonGoalUC, listGoalsByStatusUC,
} from "@modules/goals/application/goalUseCases";
import type { GoalId } from "@modules/goals/domain/GoalId";
import type { Goal } from "@modules/goals/domain/Goal";
import type { GoalFormInput } from "@modules/goals/application/goalFormSchema";
import type { GoalStatus } from "@modules/goals/domain/GoalTypes";

const repository = new DexieGoalRepository(db);

export const goalService = {
  create: (input: GoalFormInput, professionalId: string): Promise<Goal> =>
    createGoalUC(repository, input, professionalId),
  update: (id: GoalId, input: Partial<GoalFormInput>): Promise<Goal> =>
    updateGoalUC(repository, id, input),
  listByPatient: (patientId: string): Promise<Goal[]> =>
    listGoalsByPatientUC(repository, patientId),
  listAll: (): Promise<Goal[]> => listAllGoalsUC(repository),
  getById: (id: GoalId): Promise<Goal | null> => getGoalByIdUC(repository, id),
  delete: (id: GoalId): Promise<void> => deleteGoalUC(repository, id),
  pause: (id: GoalId): Promise<Goal> => pauseGoalUC(repository, id),
  achieve: (id: GoalId): Promise<Goal> => achieveGoalUC(repository, id),
  abandon: (id: GoalId): Promise<Goal> => abandonGoalUC(repository, id),
  listByStatus: (status: GoalStatus): Promise<Goal[]> =>
    listGoalsByStatusUC(repository, status),
};

export type GoalService = typeof goalService;
