import * as React from "react";
import { consultationService } from "@services/consultationService";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { ConsultationQuery } from "@modules/consultation/domain/ConsultationRepository";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

export function useConsultations(query: ConsultationQuery = {}) {
  const [state, setState] = React.useState<AsyncState<{ items: Consultation[]; total: number }>>(
    initial,
  );

  const stableQuery = JSON.stringify(query);

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    consultationService.list
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
    const parsed = JSON.parse(stableQuery) as ConsultationQuery;
    setState((s) => ({ ...s, loading: true, error: null }));
    consultationService.list
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

export function usePatientConsultations(patientId: PatientId | null) {
  const [state, setState] = React.useState<AsyncState<{ items: Consultation[]; total: number }>>(
    initial,
  );

  const patientIdStr = patientId?.toString();

  const load = React.useCallback(() => {
    if (!patientId) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    consultationService.list
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

export function useConsultation(id: ConsultationId | null) {
  const [state, setState] = React.useState<AsyncState<Consultation>>(initial);

  const idStr = id?.toString();

  React.useEffect(() => {
    if (!idStr || !id) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    consultationService.get
      .execute(id)
      .then((c) => {
        if (!cancelled) setState({ data: c, error: null, loading: false });
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
    consultationService.get
      .execute(id)
      .then((c) => setState({ data: c, error: null, loading: false }))
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
