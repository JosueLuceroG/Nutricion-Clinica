import { describe, it, expect } from "vitest";
import { GoalIdSchema, createGoalId, goalIdFrom, goalIdFromUnsafe } from "./GoalId";
import {
  GoalTypeSchema, GoalTypeLabel,
  GoalStatusSchema, GoalStatusLabel,
  GoalPrioritySchema, GoalPriorityLabel,
  GoalSourceSchema, GoalSourceLabel,
  SuccessCriterionSchema, SuccessCriterionLabel,
} from "./GoalTypes";
import { GoalSchema, Goal, GoalEvaluation } from "./Goal";
import { GoalNotFoundError } from "./GoalRepository";

describe("GoalId", () => {
  it("genera un UUID válido", () => {
    const id = createGoalId();
    expect(GoalIdSchema.safeParse(id).success).toBe(true);
  });

  it("from acepta un UUID válido", () => {
    const uuid = crypto.randomUUID();
    const id = goalIdFrom(uuid);
    expect(id).toBe(uuid);
  });

  it("from rechaza un UUID inválido", () => {
    expect(() => goalIdFrom("no-es-uuid")).toThrow();
  });

  it("fromUnsafe no valida", () => {
    const id = goalIdFromUnsafe("cualquier-valor");
    expect(id).toBe("cualquier-valor");
  });
});

describe("GoalTypes", () => {
  it("tiene labels para todos los tipos de objetivo", () => {
    const values = GoalTypeSchema.options;
    for (const v of values) {
      expect(GoalTypeLabel[v]).toBeDefined();
      expect(GoalTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los estados", () => {
    const values = GoalStatusSchema.options;
    for (const v of values) {
      expect(GoalStatusLabel[v]).toBeDefined();
      expect(GoalStatusLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todas las prioridades", () => {
    const values = GoalPrioritySchema.options;
    for (const v of values) {
      expect(GoalPriorityLabel[v]).toBeDefined();
      expect(GoalPriorityLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todas las fuentes", () => {
    const values = GoalSourceSchema.options;
    for (const v of values) {
      expect(GoalSourceLabel[v]).toBeDefined();
      expect(GoalSourceLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los criterios de éxito", () => {
    const values = SuccessCriterionSchema.options;
    for (const v of values) {
      expect(SuccessCriterionLabel[v]).toBeDefined();
      expect(SuccessCriterionLabel[v].length).toBeGreaterThan(0);
    }
  });
});

describe("Goal", () => {
  const validProps = () => ({
    id: createGoalId(),
    patientId: crypto.randomUUID(),
    type: "antropometrico" as const,
    variable: "Peso corporal",
    initialValue: 80,
    initialValueDate: "2026-01-01",
    targetValue: 70,
    unit: "kg",
    startDate: "2026-01-01",
    targetDate: "2026-06-30",
    status: "activo" as const,
    criterion: "numerico" as const,
    criterionDetail: "Reducción de 10 kg",
    priority: "alta" as const,
    source: "clinica" as const,
    reason: "Sobrepeso",
    actionPlan: "Dieta hipocalórica",
    trackingMetrics: [],
    alerts: [],
    professionalId: crypto.randomUUID(),
    notes: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it("acepta props válidos en el schema", () => {
    const result = GoalSchema.safeParse(validProps());
    expect(result.success).toBe(true);
  });

  it("rechaza type inválido", () => {
    const result = GoalSchema.safeParse({ ...validProps(), type: "inexistente" });
    expect(result.success).toBe(false);
  });

  it("rechaza status inválido", () => {
    const result = GoalSchema.safeParse({ ...validProps(), status: "invalido" });
    expect(result.success).toBe(false);
  });

  it("rechaza variable vacía", () => {
    const result = GoalSchema.safeParse({ ...validProps(), variable: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza date con formato inválido", () => {
    const result = GoalSchema.safeParse({ ...validProps(), startDate: "01-01-2026" });
    expect(result.success).toBe(false);
  });

  it("aplica defaults para campos opcionales", () => {
    const result = GoalSchema.parse({
      ...validProps(),
      unit: undefined,
      criterionDetail: undefined,
    });
    expect(result.unit).toBe("");
    expect(result.criterionDetail).toBe("");
  });

  it("create asigna status activo por defecto", () => {
    const goal = Goal.create({
      id: createGoalId().toString(),
      patientId: crypto.randomUUID(),
      type: "bioquimico",
      variable: "Glucosa",
      initialValue: 120,
      initialValueDate: "2026-01-01",
      targetValue: 100,
      startDate: "2026-01-01",
      targetDate: "2026-03-31",
      criterion: "numerico",
      priority: "alta",
      source: "clinica",
      unit: "",
      criterionDetail: "",
      reason: "",
      actionPlan: "",
      trackingMetrics: [],
      alerts: [],
      professionalId: crypto.randomUUID(),
      notes: "",
    });
    expect(goal.status).toBe("activo");
    expect(goal.createdAt).toBeGreaterThan(0);
    expect(goal.updatedAt).toBeGreaterThan(0);
  });

  it("create acepta status explícito", () => {
    const goal = Goal.create({
      id: createGoalId().toString(),
      patientId: crypto.randomUUID(),
      type: "conductual",
      variable: "Ejercicio",
      initialValue: 0,
      initialValueDate: "2026-01-01",
      targetValue: 5,
      startDate: "2026-01-01",
      targetDate: "2026-03-01",
      criterion: "numerico",
      priority: "media",
      source: "ambos",
      unit: "",
      criterionDetail: "",
      reason: "",
      actionPlan: "",
      trackingMetrics: [],
      alerts: [],
      professionalId: crypto.randomUUID(),
      notes: "",
      status: "en_pausa",
    });
    expect(goal.status).toBe("en_pausa");
  });

  it("reconstitute restaura desde props", () => {
    const props = validProps();
    const goal = Goal.reconstitute(props);
    expect(goal.id).toBe(props.id);
    expect(goal.variable).toBe("Peso corporal");
    expect(goal.initialValue).toBe(80);
    expect(goal.targetValue).toBe(70);
  });

  it("toProps devuelve copia de las props", () => {
    const original = Goal.reconstitute(validProps());
    const props = original.toProps();
    expect(props.id).toBe(original.id);
    expect(props.initialValue).toBe(80);
  });

  it("pause cambia estado a en_pausa", () => {
    const goal = Goal.reconstitute(validProps());
    const paused = goal.pause();
    expect(paused.status).toBe("en_pausa");
  });

  it("markAchieved cambia estado a logrado y asigna closeDate", () => {
    const goal = Goal.reconstitute(validProps());
    const achieved = goal.markAchieved();
    expect(achieved.status).toBe("logrado");
    expect(achieved.closeDate).toBeTruthy();
  });

  it("markNotAchieved cambia estado a no_logrado y asigna closeDate", () => {
    const goal = Goal.reconstitute(validProps());
    const failed = goal.markNotAchieved();
    expect(failed.status).toBe("no_logrado");
    expect(failed.closeDate).toBeTruthy();
  });

  it("abandon cambia estado a abandonado y asigna closeDate", () => {
    const goal = Goal.reconstitute(validProps());
    const abandoned = goal.abandon();
    expect(abandoned.status).toBe("abandonado");
    expect(abandoned.closeDate).toBeTruthy();
  });

  it("with actualiza campos y updatedAt", () => {
    const goal = Goal.reconstitute({ ...validProps(), updatedAt: 1 });
    const updated = goal.with({ notes: "Nota actualizada", priority: "baja" });
    expect(updated.notes).toBe("Nota actualizada");
    expect(updated.priority).toBe("baja");
    expect(updated.updatedAt).toBeGreaterThan(goal.updatedAt);
  });
});

describe("GoalEvaluation.calculate", () => {
  const makeGoal = () =>
    Goal.reconstitute({
      id: createGoalId(),
      patientId: crypto.randomUUID(),
      type: "antropometrico",
      variable: "Peso",
      initialValue: 80,
      initialValueDate: "2025-12-01",
      targetValue: 70,
      unit: "kg",
      startDate: "2026-01-01",
      targetDate: "2026-06-30",
      status: "activo",
      criterion: "numerico",
      criterionDetail: "",
      priority: "alta",
      source: "clinica",
      reason: "",
      actionPlan: "",
      trackingMetrics: [],
      alerts: [],
      professionalId: crypto.randomUUID(),
      notes: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

  it("calcula cambios absolutos y porcentuales", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 75, crypto.randomUUID(), 2);
    expect(eval_.currentValue).toBe(75);
    expect(eval_.absoluteChange).toBe(-5);
    expect(eval_.percentChange).toBe(-6.25);
  });

  it("calcula progressPercent correctamente cuando hay avance", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 75, crypto.randomUUID(), 2);
    expect(eval_.progressPercent).toBe(50);
  });

  it("calcula progressPercent como 100 cuando se logra la meta", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 70, crypto.randomUUID(), 2);
    expect(eval_.progressPercent).toBe(100);
  });

  it("asigna calculatedStatus logrado cuando progressPercent >= 100 y currentValue >= target", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 70, crypto.randomUUID(), 2);
    expect(eval_.calculatedStatus).toBe("logrado");
  });

  it("asigna calculatedStatus en_ritmo cuando monthlyVelocity > 0", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 85, crypto.randomUUID(), 2);
    expect(eval_.calculatedStatus).toBe("en_ritmo");
  });

  it("asigna calculatedStatus en_progreso por defecto", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 79, crypto.randomUUID(), 2);
    expect(eval_.calculatedStatus).toBe("en_progreso");
  });

  it("genera alerta cuando progressPercent < 25 y ha pasado más tiempo del planeado", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 79, crypto.randomUUID(), 12);
    expect(eval_.alert).toContain("insuficiente");
  });

  it("calcula monthlyVelocity", () => {
    const goal = makeGoal();
    const eval_ = GoalEvaluation.calculate(goal, 75, crypto.randomUUID(), 2);
    expect(eval_.monthlyVelocity).toBe(-2.5);
  });
});

describe("GoalRepository - error classes", () => {
  it("GoalNotFoundError tiene el mensaje correcto", () => {
    const id = createGoalId();
    const error = new GoalNotFoundError(id);
    expect(error.message).toContain(id);
    expect(error.name).toBe("GoalNotFoundError");
    expect(error.id).toBe(id);
    expect(error).toBeInstanceOf(Error);
  });
});
