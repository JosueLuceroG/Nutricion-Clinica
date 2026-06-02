import * as React from "react";
import { anthropometryService } from "@services/anthropometryService";
import type { Anthropometry } from "@modules/anthropometry/domain/Anthropometry";
import type { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import type { PatientId } from "@modules/patient/domain/PatientId";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

export function usePatientMeasurements(patientId: PatientId | null) {
  const [state, setState] = React.useState<AsyncState<{ items: Anthropometry[]; total: number }>>(
    initial,
  );

  const patientIdStr = patientId?.toString();

  const load = React.useCallback(() => {
    if (!patientId) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    anthropometryService.list
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

export function useAnthropometry(id: AnthropometryId | null) {
  const [state, setState] = React.useState<AsyncState<Anthropometry>>(initial);

  const idStr = id?.toString();

  React.useEffect(() => {
    if (!idStr || !id) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    anthropometryService.get
      .execute(id)
      .then((measurement) => {
        if (!cancelled) setState({ data: measurement, error: null, loading: false });
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
    anthropometryService.get
      .execute(id)
      .then((m) => setState({ data: m, error: null, loading: false }))
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
