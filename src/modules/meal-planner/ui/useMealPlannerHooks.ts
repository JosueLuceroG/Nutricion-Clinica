import * as React from "react";
import { mealPlannerService } from "@services/mealPlannerService";
import type { WeeklyPlan } from "../domain/WeeklyPlan";
import type { MealPlannerFormInput } from "../application/mealPlannerFormSchema";

export function useWeeklyPlans() {
  const [plans, setPlans] = React.useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await mealPlannerService.listAll();
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { plans, loading, refresh };
}

export function useCreateWeeklyPlan() {
  const [creating, setCreating] = React.useState(false);

  const create = React.useCallback(async (input: MealPlannerFormInput) => {
    setCreating(true);
    try {
      return await mealPlannerService.createPlan(input);
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating };
}
