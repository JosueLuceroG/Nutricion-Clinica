import type { MealPlan } from "./MealPlan";
import type { MealPlanId } from "./MealPlanId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { MealPlanStatus } from "./MealPlanStatus";

export interface MealPlanQuery {
  patientId?: PatientId;
  status?: MealPlanStatus | MealPlanStatus[];
  from?: Date;
  to?: Date;
  sucursalId?: string;
  limit?: number;
  offset?: number;
}

export interface MealPlanRepository {
  save(plan: MealPlan): Promise<void>;
  findById(id: MealPlanId): Promise<MealPlan | null>;
  findAll(query?: MealPlanQuery): Promise<MealPlan[]>;
  count(query?: MealPlanQuery): Promise<number>;
  delete(id: MealPlanId, soft?: boolean): Promise<void>;
}

export class MealPlanNotFoundError extends Error {
  constructor(public readonly id: MealPlanId) {
    super(`Plan alimentario no encontrado: ${id.toString()}`);
    this.name = "MealPlanNotFoundError";
  }
}

export class MealPlanRequiresConsultationError extends Error {
  constructor(reason: "missing" | "not-found" | "not-active") {
    const messages: Record<typeof reason, string> = {
      "missing": "RN-PLA-01: El plan alimentario debe asociarse a una consulta activa.",
      "not-found": "RN-PLA-01: La consulta asociada al plan no existe.",
      "not-active": "RN-PLA-01: La consulta asociada al plan debe estar activa (status != completed).",
    };
    super(messages[reason]);
    this.name = "MealPlanRequiresConsultationError";
  }
}
