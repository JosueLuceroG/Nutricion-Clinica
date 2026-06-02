import * as React from "react";
import { labPanelService } from "@services/labPanelService";
import type { LabPanel } from "@modules/laboratory/domain/LabPanel";
import type { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import type { PatientId } from "@modules/patient/domain/PatientId";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

export function usePatientLabPanels(patientId: PatientId | null) {
  const [state, setState] = React.useState<AsyncState<{ items: LabPanel[]; total: number }>>(
    initial,
  );

  const load = React.useCallback(() => {
    if (!patientId) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    labPanelService.list
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
  }, [load]);

  return { ...state, reload: load };
}

export function useLabPanel(id: LabPanelId | null) {
  const [state, setState] = React.useState<AsyncState<LabPanel>>(initial);

  const idStr = id?.toString();

  React.useEffect(() => {
    if (!id) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    labPanelService.get
      .execute(id)
      .then((panel) => {
        if (!cancelled) setState({ data: panel, error: null, loading: false });
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
  }, [idStr, id]);

  const reload = React.useCallback(() => {
    if (!id) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    labPanelService.get
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
