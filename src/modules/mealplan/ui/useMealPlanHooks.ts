import * as React from "react";
import { mealPlanService } from "@services/mealPlanService";
import type { MealPlan } from "@modules/mealplan/domain/MealPlan";
import type { MealPlanId } from "@modules/mealplan/domain/MealPlanId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { MealPlanQuery } from "@modules/mealplan/domain/MealPlanRepository";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

export function useMealPlans(query: MealPlanQuery = {}) {
  const [state, setState] = React.useState<AsyncState<{ items: MealPlan[]; total: number }>>(
    initial,
  );

  const stableQuery = JSON.stringify(query);

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    mealPlanService.list
      .execute(query)
      .then((result) => {
        if (!cancelled) setState({ data: result, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            data: null,
            error: err instanceof Error ? err : new Error(String(err)),
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableQuery]);

  const reload = React.useCallback(() => {
    const parsed = JSON.parse(stableQuery) as MealPlanQuery;
    setState((s) => ({ ...s, loading: true, error: null }));
    mealPlanService.list
      .execute(parsed)
      .then((result) => setState({ data: result, error: null, loading: false }))
      .catch((err) =>
        setState({
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        }),
      );
  }, [stableQuery]);

  return { ...state, reload };
}

export function usePatientMealPlans(patientId: PatientId | null) {
  const [state, setState] = React.useState<AsyncState<{ items: MealPlan[]; total: number }>>(
    initial,
  );

  const patientIdStr = patientId?.toString();

  const load = React.useCallback(() => {
    if (!patientId) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    mealPlanService.list
      .execute({ patientId })
      .then((result) => setState({ data: result, error: null, loading: false }))
      .catch((err) =>
        setState({
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        }),
      );
  }, [patientId]);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientIdStr]);

  return { ...state, reload: load };
}

export function useMealPlan(id: MealPlanId | null) {
  const [state, setState] = React.useState<AsyncState<MealPlan>>(initial);

  const idStr = id?.toString();

  React.useEffect(() => {
    if (!idStr || !id) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    mealPlanService.get
      .execute(id)
      .then((p) => {
        if (!cancelled) setState({ data: p, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            data: null,
            error: err instanceof Error ? err : new Error(String(err)),
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStr]);

  const reload = React.useCallback(() => {
    if (!id) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    mealPlanService.get
      .execute(id)
      .then((p) => setState({ data: p, error: null, loading: false }))
      .catch((err) =>
        setState({
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        }),
      );
  }, [id]);

  return { ...state, reload };
}
