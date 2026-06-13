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
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository = new DexieGoalRepository(db);

export const goalService = {
  create: async (input: GoalFormInput, professionalId: string): Promise<Goal> => {
    const goal = await createGoalUC(repository, input, professionalId);
    await recordClinicalAudit({ module: "goals", action: "create", resourceType: "goal", resourceId: goal.id, patientId: goal.patientId });
    return goal;
  },
  update: async (id: GoalId, input: Partial<GoalFormInput>): Promise<Goal> => {
    const goal = await updateGoalUC(repository, id, input);
    await recordClinicalAudit({ module: "goals", action: "update", resourceType: "goal", resourceId: goal.id, patientId: goal.patientId });
    return goal;
  },
  listByPatient: (patientId: string): Promise<Goal[]> =>
    listGoalsByPatientUC(repository, patientId),
  listAll: (): Promise<Goal[]> => listAllGoalsUC(repository),
  getById: (id: GoalId): Promise<Goal | null> => getGoalByIdUC(repository, id),
  delete: async (id: GoalId): Promise<void> => {
    const existing = await repository.findById(id);
    await deleteGoalUC(repository, id);
    await recordClinicalAudit({ module: "goals", action: "remove", resourceType: "goal", resourceId: id, patientId: existing?.patientId ?? null });
  },
  pause: async (id: GoalId): Promise<Goal> => {
    const goal = await pauseGoalUC(repository, id);
    await recordClinicalAudit({ module: "goals", action: "update", resourceType: "goal", resourceId: goal.id, patientId: goal.patientId, justification: "status:en_pausa" });
    return goal;
  },
  achieve: async (id: GoalId): Promise<Goal> => {
    const goal = await achieveGoalUC(repository, id);
    await recordClinicalAudit({ module: "goals", action: "update", resourceType: "goal", resourceId: goal.id, patientId: goal.patientId, justification: "status:logrado" });
    return goal;
  },
  abandon: async (id: GoalId): Promise<Goal> => {
    const goal = await abandonGoalUC(repository, id);
    await recordClinicalAudit({ module: "goals", action: "update", resourceType: "goal", resourceId: goal.id, patientId: goal.patientId, justification: "status:abandonado" });
    return goal;
  },
  listByStatus: (status: GoalStatus): Promise<Goal[]> =>
    listGoalsByStatusUC(repository, status),
};

export type GoalService = typeof goalService;
