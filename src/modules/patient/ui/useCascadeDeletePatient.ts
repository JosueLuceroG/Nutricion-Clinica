import * as React from "react";
import { patientService } from "@services/patientService";
import type { LinkedCounts } from "../application/patientUseCases";
import type { PatientId } from "../domain/PatientId";

export type DeletePatientOutcome = "archived" | "deleted" | "cancelled" | "error";

export interface UseCascadeDeletePatientOptions {
  /**
   * Callback tras la finalización exitosa (sea archive o cascade-delete).
   * Útil para navegar a la lista o invalidar queries externas.
   */
  onComplete?: (outcome: Exclude<DeletePatientOutcome, "cancelled" | "error">) => void;
  onError?: (error: unknown) => void;
}

export interface UseCascadeDeletePatientReturn {
  dialogOpen: boolean;
  loadingCounts: boolean;
  busy: boolean;
  counts: LinkedCounts | null;
  errorMessage: string | null;
  requestDelete: (patientId: PatientId) => Promise<void>;
  cancel: () => void;
  archive: () => Promise<void>;
  deleteAll: () => Promise<void>;
}

/**
 * Orquesta el flujo de eliminación de un paciente:
 *
 *  1) `requestDelete(id)` — consulta el conteo de entidades vinculadas.
 *     - Si `total === 0`: ejecuta `patientService.delete` directamente.
 *     - Si `total > 0`: abre el modal `CascadeDeletePatientDialog`.
 *  2) El modal expone dos acciones:
 *     - `archive` — preserva el historial.
 *     - `deleteAll` — cascade soft-delete.
 *  3) `cancel` cierra el modal sin hacer nada.
 *
 * Mantiene el estado de carga separado (`loadingCounts` vs `busy`) para
 * que la UI distinga "contando" de "eliminando" y deshabilite lo
 * apropiado.
 */
export function useCascadeDeletePatient(
  options: UseCascadeDeletePatientOptions = {},
): UseCascadeDeletePatientReturn {
  const { onComplete, onError } = options;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loadingCounts, setLoadingCounts] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [counts, setCounts] = React.useState<LinkedCounts | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const pendingPatientId = React.useRef<PatientId | null>(null);

  const runSafe = React.useCallback(
    async (work: () => Promise<unknown>, success?: () => void) => {
      setBusy(true);
      setErrorMessage(null);
      try {
        await work();
        success?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Operación fallida";
        setErrorMessage(message);
        onError?.(err);
      } finally {
        setBusy(false);
      }
    },
    [onError],
  );

  const requestDelete = React.useCallback(
    async (patientId: PatientId) => {
      pendingPatientId.current = patientId;
      setCounts(null);
      setErrorMessage(null);
      setLoadingCounts(true);
      try {
        const c = await patientService.countLinked.execute(patientId);
        setCounts(c);
        const total = c.consultations + c.mealPlans + c.labPanels + c.anthropometry;
        if (total === 0) {
          await runSafe(
            () => patientService.delete.execute(patientId, true),
            () => onComplete?.("deleted"),
          );
        } else {
          setDialogOpen(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo contar entidades";
        setErrorMessage(message);
        onError?.(err);
      } finally {
        setLoadingCounts(false);
      }
    },
    [onComplete, onError, runSafe],
  );

  const cancel = React.useCallback(() => {
    if (busy) return;
    setDialogOpen(false);
    pendingPatientId.current = null;
  }, [busy]);

  const archive = React.useCallback(async () => {
    const id = pendingPatientId.current;
    if (!id) return;
    await runSafe(
      () => patientService.archive.execute(id),
      () => {
        setDialogOpen(false);
        pendingPatientId.current = null;
        onComplete?.("archived");
      },
    );
  }, [onComplete, runSafe]);

  const deleteAll = React.useCallback(async () => {
    const id = pendingPatientId.current;
    if (!id) return;
    await runSafe(
      () => patientService.deleteCascade.execute(id),
      () => {
        setDialogOpen(false);
        pendingPatientId.current = null;
        onComplete?.("deleted");
      },
    );
  }, [onComplete, runSafe]);

  return {
    dialogOpen,
    loadingCounts,
    busy,
    counts,
    errorMessage,
    requestDelete,
    cancel,
    archive,
    deleteAll,
  };
}
