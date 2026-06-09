import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
            {t("patient.cascade_delete_title")}
          </DialogTitle>
          <DialogDescription>
            {t("patient.cascade_dialog_desc", { name: patientName })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          {loading ? (
            <p className="text-muted-foreground">{t("patient.counting_linked_entities")}</p>
          ) : counts ? (
            <ul className="space-y-1">
              <li>• {t("patient.linked_consultations", { count: counts.consultations })}</li>
              <li>• {t("patient.linked_meal_plans", { count: counts.mealPlans })}</li>
              <li>• {t("patient.linked_lab_panels", { count: counts.labPanels })}</li>
              <li>• {t("patient.linked_anthropometry", { count: counts.anthropometry })}</li>
              <li className="pt-1 font-medium text-amber-900 dark:text-amber-200">
                {t("patient.linked_total", { count: total })}
              </li>
            </ul>
          ) : (
            <p className="text-muted-foreground">{t("patient.count_linked_error")}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("patient.cascade_explanation")}
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="secondary"
            onClick={onArchive}
            disabled={busy || loading}
            data-testid="cascade-archive"
          >
            <Archive className="mr-2 h-4 w-4" aria-hidden />
            {t("common.archive")}
          </Button>
          <Button
            variant="destructive"
            onClick={onDeleteAll}
            disabled={busy || loading}
            data-testid="cascade-delete-all"
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            {t("patient.delete_all")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
