/**
 * React hooks para el módulo SMAE. Encapsulan async state y mutations
 * sobre el `smaeService`. Patrón compatible con usePatientHooks.
 */
import * as React from "react";
import { smaeService } from "@services/smaeService";
import {
  type Food,
  type FoodId,
  type FoodSearchOptions,
  type FindByEquivalenciaOptions,
  type FoodGroup,
} from "@modules/smae/domain";
import type {
  SmaeCustomFoodCreateInput,
  SmaeCustomFoodUpdateInput,
} from "@modules/smae/application/smaeUseCases";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

export interface UseSmaeFoodsQuery {
  q?: string;
  group?: FoodGroup | null;
  customOnly?: boolean;
}

export function useSmaeFoods(query: UseSmaeFoodsQuery = {}) {
  const [state, setState] = React.useState<AsyncState<Food[]>>(initial);
  const [debouncedQ, setDebouncedQ] = React.useState(query.q ?? "");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.q ?? ""), 200);
    return () => clearTimeout(t);
  }, [query.q]);

  const stableKey = JSON.stringify({ q: debouncedQ, group: query.group, customOnly: query.customOnly });

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const opts: FoodSearchOptions = {
      query: debouncedQ || undefined,
      group: query.group ?? undefined,
      customOnly: query.customOnly,
    };
    smaeService
      .search(opts)
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
  }, [stableKey]);

  return state;
}

export function useFindByEquivalencia(
  targetKcal: number,
  toleranceKcal: number,
  opts: FindByEquivalenciaOptions = {},
) {
  const [state, setState] = React.useState<AsyncState<Food[]>>(initial);
  const key = JSON.stringify({ targetKcal, toleranceKcal, opts });
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    smaeService
      .findByEquivalencia(targetKcal, toleranceKcal, opts)
      .then((r) => {
        if (!cancelled) setState({ data: r, error: null, loading: false });
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
  }, [key]);
  return state;
}

export function useAddCustomFood() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const add = React.useCallback(async (input: SmaeCustomFoodCreateInput): Promise<Food | null> => {
    setLoading(true);
    setError(null);
    try {
      const food = await smaeService.addCustom(input);
      return food;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { add, loading, error };
}

export function useUpdateCustomFood() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const update = React.useCallback(
    async (id: FoodId, input: SmaeCustomFoodUpdateInput): Promise<Food | null> => {
      setLoading(true);
      setError(null);
      try {
        const food = await smaeService.updateCustom(id, input);
        return food;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { update, loading, error };
}

export function useRemoveCustomFood() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const remove = React.useCallback(async (id: FoodId): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await smaeService.removeCustom(id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading, error };
}
