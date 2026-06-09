import * as React from "react";
import { goalService } from "@services/goalService";
import type { Goal } from "../domain/Goal";
import type { GoalFormInput } from "../application/goalFormSchema";

export function useGoals() {
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await goalService.listAll();
      setGoals(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { goals, loading, refresh };
}

export function useGoalsByPatient(patientId: string) {
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await goalService.listByPatient(patientId);
      setGoals(data);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { goals, loading, refresh };
}

export function useCreateGoal() {
  const [creating, setCreating] = React.useState(false);

  const create = React.useCallback(async (input: GoalFormInput, professionalId: string) => {
    setCreating(true);
    try {
      return await goalService.create(input, professionalId);
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating };
}
