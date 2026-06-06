import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Archive, Trash2, AlertTriangle } from "lucide-react";
import type { LinkedCounts } from "../application/patientUseCases";

/**
 * Modal de confirmación para eliminación de paciente con entidades
 * vinculadas. Muestra conteos y ofrece 2 acciones irreversibles:
 *
 *  - **Archivar** (preserva el historial, oculta del dashboard).
 *  - **Eliminar todo** (cascade soft-delete de paciente + consultas +
 *    planes + laboratorios + antropometrias).
 *
 * Si la cancelación o la propia confirmación necesita esperar a la
 * acción, `busy` desactiva todos los botones y muestra el spinner.
 */
export interface CascadeDeletePatientDialogProps {
  open: boolean;
  patientName: string;
  counts: LinkedCounts | null;
  loading: boolean;
  busy: boolean;
  onCancel: () => void;
  onArchive: () => void | Promise<void>;
  onDeleteAll: () => void | Promise<void>;
}

function totalCounts(counts: LinkedCounts | null): number {
  if (!counts) return 0;
  return counts.consultations + counts.mealPlans + counts.labPanels + counts.anthropometry;
}

export function CascadeDeletePatientDialog({
  open,
  patientName,
  counts,
  loading,
  busy,
  onCancel,
  onArchive,
  onDeleteAll,
}: CascadeDeletePatientDialogProps) {
  const total = totalCounts(counts);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="cascade-delete-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            Eliminar paciente
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{patientName}</span> tiene entidades
            vinculadas. Decide qué hacer con su historial clínico.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          {loading ? (
            <p className="text-muted-foreground">Contando entidades vinculadas…</p>
          ) : counts ? (
            <ul className="space-y-1">
              <li>• {counts.consultations} consulta{counts.consultations === 1 ? "" : "s"}</li>
              <li>• {counts.mealPlans} plan{counts.mealPlans === 1 ? "" : "es"} alimenticio{counts.mealPlans === 1 ? "" : "s"}</li>
              <li>• {counts.labPanels} panel{counts.labPanels === 1 ? "" : "es"} de laboratorio</li>
              <li>• {counts.anthropometry} registro{counts.anthropometry === 1 ? "" : "s"} de antropometría</li>
              <li className="pt-1 font-medium text-amber-900 dark:text-amber-200">
                Total: {total} entidad{total === 1 ? "" : "es"}
              </li>
            </ul>
          ) : (
            <p className="text-muted-foreground">No se pudo contar las entidades vinculadas.</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Archivar preserva el historial clínico (el paciente y sus entidades quedan ocultos
          del panel). Eliminar todo borra lógicamente el paciente y todas sus entidades; el
          cambio se sincroniza con el servidor.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={onArchive}
            disabled={busy || loading}
            data-testid="cascade-archive"
          >
            <Archive className="mr-2 h-4 w-4" aria-hidden />
            Archivar
          </Button>
          <Button
            variant="destructive"
            onClick={onDeleteAll}
            disabled={busy || loading}
            data-testid="cascade-delete-all"
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Eliminar todo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
