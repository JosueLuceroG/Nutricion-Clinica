import * as React from "react";
import { patientService } from "@services/patientService";
import type { Patient } from "@modules/patient/domain/Patient";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { PatientQuery } from "@modules/patient/domain/PatientRepository";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** true si el paciente existe en Dexie pero está soft-deleted (deletedAt != null). */
  deleted?: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

export function usePatients(query: PatientQuery = {}) {
  const [state, setState] = React.useState<AsyncState<{ items: Patient[]; total: number }>>(
    initial,
  );

  const stableQuery = JSON.stringify(query);

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    patientService.list
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
    const parsed = JSON.parse(stableQuery) as PatientQuery;
    setState((s) => ({ ...s, loading: true, error: null }));
    patientService.list
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

export function usePatient(id: PatientId | null) {
  const [state, setState] = React.useState<AsyncState<Patient>>(initial);

  const idStr = id?.toString();

  React.useEffect(() => {
    if (!idStr || !id) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    patientService.get
      .execute(id)
      .then((patient) => {
        if (cancelled) return;
        if (!patient) {
          setState({ data: null, error: null, loading: false });
          return;
        }
        // Detección de soft-delete: el paciente existe en Dexie pero tiene
        // deletedAt seteado. Devolvemos `deleted: true` y `data: null` para
        // que la UI muestre el estado "Eliminado" en vez de los datos viejos.
        if (patient.deletedAt !== null) {
          setState({ data: null, error: null, loading: false, deleted: true });
          return;
        }
        setState({ data: patient, error: null, loading: false });
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
    patientService.get
      .execute(id)
      .then((patient) => {
        if (!patient) {
          setState({ data: null, error: null, loading: false });
          return;
        }
        if (patient.deletedAt !== null) {
          setState({ data: null, error: null, loading: false, deleted: true });
          return;
        }
        setState({ data: patient, error: null, loading: false });
      })
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
