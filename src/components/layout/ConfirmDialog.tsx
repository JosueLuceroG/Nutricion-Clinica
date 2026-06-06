import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { AlertTriangle } from "lucide-react";

export type ConfirmTone = "danger" | "warning" | "info";

/**
 * Modal de confirmación reutilizable. Reemplaza al `window.confirm()`
 * nativo con un diálogo accesible (Radix) y visualmente consistente.
 *
 * Uso controlado:
 *   const [open, setOpen] = React.useState(false);
 *   const [busy, setBusy] = React.useState(false);
 *   ...
 *   <Button onClick={() => setOpen(true)}>Eliminar</Button>
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="¿Eliminar paciente?"
 *     description="Esta acción se puede revertir. Los datos se conservan en el servidor."
 *     confirmLabel="Eliminar"
 *     tone="danger"
 *     busy={busy}
 *     onConfirm={async () => {
 *       setBusy(true);
 *       try {
 *         await patientService.delete.execute(id, true);
 *         navigate("/pacientes");
 *       } finally {
 *         setBusy(false);
 *       }
 *     }}
 *   />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const confirmVariant: "default" | "destructive" =
    tone === "danger" ? "destructive" : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tone === "danger" && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={busy}
            onClick={async () => {
              try {
                await onConfirm();
              } catch {
                // El consumidor se encarga de mostrar el toast.
                // No cerramos el modal: el usuario puede reintentar o cancelar.
              }
            }}
          >
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
