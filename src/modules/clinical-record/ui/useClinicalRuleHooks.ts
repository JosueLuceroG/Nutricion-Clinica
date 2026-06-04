import * as React from "react";
import { clinicalRuleService } from "@services/clinicalRuleService";

export function useBlockedFoods(patientId: string | null) {
  const [data, setData] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const load = React.useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await clinicalRuleService.getBlockedFoodIds(patientId);
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

interface FoodWarning {
  foodId: string;
  intoleranceFood: string;
  severity: string;
}

export function useFoodWarnings(patientId: string | null) {
  const [data, setData] = React.useState<FoodWarning[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const load = React.useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await clinicalRuleService.getFoodWarnings(patientId);
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
