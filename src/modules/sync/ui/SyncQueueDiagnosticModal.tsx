/**
 * Modal de diagnóstico del sync_queue.
 *
 * Se abre clickeando "N pendientes" en la StatusBar. Muestra la cola
 * completa (pending + error) con su `lastError` y permite:
 *   - Reintentar: pone los items en `status='pending'` y dispara sync.
 *   - Limpiar: vacía la cola (los datos en Dexie NO se borran).
 *   - Copiar al portapapeles: para reportar errores sin DevTools.
 */

import * as React from "react";
import { Clipboard, RefreshCw, Trash2, X, AlertCircle, Database, XCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { db } from "@services/db";
import { SyncQueueRepository } from "@services/sync/syncQueueRepository";
import { getSyncEngine } from "@services/sync/syncBootstrap";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { repairCorruptDateRows } from "@services/db/repairCorruptDateRows";
import { cn } from "@utils/cn";

const queue = new SyncQueueRepository(db.sync_queue);

interface QueueItemView {
  id: string;
  entity: string;
  entityId: string;
  op: string;
  status: string;
  retryCount: number;
  lastError: string | null;
  enqueuedAt: string;
  updatedAt: string;
}

export function SyncQueueDiagnosticModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = React.useState<QueueItemView[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const all = await queue.listAll();
      all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setItems(
        all.map((i) => ({
          id: i.id,
          entity: i.entity,
          entityId: i.entityId,
          op: i.op,
          status: i.status,
          retryCount: i.retryCount,
          lastError: i.lastError,
          enqueuedAt: i.enqueuedAt,
          updatedAt: i.updatedAt,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleClearAll = async () => {
    if (!window.confirm("¿Vaciar la cola? Los datos en Dexie NO se borran, solo los items pendientes del push.")) {
      return;
    }
    await db.sync_queue.clear();
    useSyncStore.getState().setPendingChanges(0);
    toast.success("Cola vaciada");
    void refresh();
  };

  const handleRetryAll = async () => {
    const errorItems = items.filter((i) => i.status === "error" || i.status === "conflict");
    for (const it of errorItems) {
      await db.sync_queue.update(it.id, { status: "pending", lastError: null });
    }
    toast.info(`${errorItems.length} item(s) puestos en pending`, {
      description: "Ejecutá \"Sincronizar\" para reintentar.",
    });
    void refresh();
  };

  const handleDiscard = async (itemId: string, entity: string) => {
    await db.sync_queue.delete(itemId);
    toast.success(`${entity} descartado`, {
      description: "El item se eliminó de la cola. La fila en Dexie NO se borró.",
    });
    void refresh();
  };

  const handleCopy = async () => {
    const text = items
      .map(
        (i) =>
          `[${i.status.toUpperCase()}] ${i.entity}#${i.entityId.slice(0, 8)} op=${i.op} retry=${i.retryCount}\n  err: ${i.lastError ?? "(none)"}`,
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "(cola vacía)");
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar", { description: "Seleccioná manualmente y copiá." });
    }
  };

  const handleSyncNow = async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      toast.error("No autenticado");
      return;
    }
    const engine = getSyncEngine(db);
    await engine.sync();
    void refresh();
  };

  const [repairing, setRepairing] = React.useState(false);
  const handleRepairDates = async () => {
    setRepairing(true);
    try {
      const result = await repairCorruptDateRows();
      if (result.repaired === 0) {
        toast.info("Sin fechas corruptas", {
          description: `Escaneadas ${result.scanned} filas en ${Object.keys(result.byTable).length} tablas.`,
        });
      } else {
        const byTable = Object.entries(result.byTable)
          .filter(([, v]) => v.repaired > 0)
          .map(([k, v]) => `${k}: ${v.repaired}`)
          .join(", ");
        toast.success(`Reparadas ${result.repaired} fila(s)`, {
          description: byTable,
        });
      }
    } catch (err) {
      toast.error("No se pudo reparar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRepairing(false);
    }
  };

  const errorCount = items.filter((i) => i.status === "error").length;
  const conflictCount = items.filter((i) => i.status === "conflict").length;
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cola de sincronización
          </DialogTitle>
          <DialogDescription>
            {items.length} item{items.length === 1 ? "" : "s"} total
            {pendingCount > 0 && ` · ${pendingCount} pendiente${pendingCount === 1 ? "" : "s"}`}
            {errorCount > 0 && ` · ${errorCount} con error`}
            {conflictCount > 0 && ` · ${conflictCount} conflicto${conflictCount === 1 ? "" : "s"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Button size="sm" variant="default" onClick={handleSyncNow} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Sincronizar
          </Button>
          <Button size="sm" variant="outline" onClick={handleRetryAll} disabled={errorCount + conflictCount === 0}>
            Reintentar errores
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy} disabled={items.length === 0}>
            <Clipboard className="h-3.5 w-3.5 mr-1.5" />
            Copiar
          </Button>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            Refrescar
          </Button>
          <Button size="sm" variant="outline" onClick={handleRepairDates} disabled={repairing}>
            <Wrench className={cn("h-3.5 w-3.5 mr-1.5", repairing && "animate-spin")} />
            Reparar fechas
          </Button>
          <div className="ml-auto">
            <Button size="sm" variant="destructive" onClick={handleClearAll} disabled={items.length === 0}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Vaciar cola
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Cola vacía. Todos los cambios están sincronizados.
            </div>
          ) : (
            <ul className="space-y-2 py-2">
              {items.map((i) => (
                <li
                  key={i.id}
                  className={cn(
                    "rounded-md border p-3 text-xs",
                    i.status === "error" && "border-destructive/40 bg-destructive/5",
                    i.status === "conflict" && "border-warning/40 bg-warning/5",
                    i.status === "pending" && "border-border bg-muted/30",
                    i.status === "applied" && "border-success/40 bg-success/5 opacity-60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <StatusBadge status={i.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-medium">{i.entity}</span>
                        <span className="text-muted-foreground">#{i.entityId.slice(0, 8)}…</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">op={i.op}</span>
                        {i.retryCount > 0 && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">retry={i.retryCount}</span>
                          </>
                        )}
                      </div>
                      {i.lastError && (
                        <div className="mt-1.5 flex gap-1.5 text-destructive">
                          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="font-mono break-all whitespace-pre-wrap">{i.lastError}</span>
                        </div>
                      )}
                      <div className="mt-1 text-muted-foreground">
                        {new Date(i.updatedAt).toLocaleString("es-MX")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDiscard(i.id, i.entity)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Descartar este item (lo borra de la cola; la fila en Dexie NO se borra)"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t pt-3">
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "warning" | "success" | "info"> = {
    pending: "info",
    syncing: "secondary",
    applied: "success",
    error: "destructive",
    conflict: "warning",
  };
  return (
    <Badge variant={variants[status] ?? "secondary"} className="shrink-0 text-[10px]">
      {status}
    </Badge>
  );
}
