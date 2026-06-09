import * as React from "react";
import { AlertTriangle, CheckCircle2, Server, HardDrive, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { ScrollArea } from "@components/ui/scroll-area";
import { SyncQueueRepository } from "@services/sync/syncQueueRepository";
import { db } from "@services/db";
import type { SyncQueueItem } from "@modules/sync/domain/SyncQueueItem";
import { useSyncStore } from "@store/syncStore";
import { toast } from "sonner";

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConflictResolutionModal({ open, onOpenChange }: ConflictResolutionModalProps) {
  const { t } = useTranslation();
  const [conflicts, setConflicts] = React.useState<SyncQueueItem[]>([]);
  const [resolving, setResolving] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const setStatus = useSyncStore((s) => s.setStatus);

  const queue = React.useMemo(() => new SyncQueueRepository(db.sync_queue), []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const items = await db.sync_queue.where("status").equals("conflict").toArray();
      setConflicts(items);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const resolve = async (item: SyncQueueItem, side: "local" | "remote") => {
    setResolving(item.id);
    try {
      await queue.resolveConflict(item.id, side);
      if (side === "local") {
        // Re-encolar para que el pr\u00f3ximo push lo intente con la versi\u00f3n
        // m\u00e1s reciente (server force-pull antes de reintentar).
        setStatus("syncing");
      }
      await refresh();
      toast.success(side === "local" ? t("sync.local_reapplied") : t("sync.remote_accepted"));
    } catch (err) {
      toast.error(t("sync.resolve_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setResolving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden />
            {t("sync.conflicts_title")}
          </DialogTitle>
          <DialogDescription>
            {t("sync.conflicts_desc")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{t("sync.loading_conflicts")}</div>
        ) : conflicts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
            {t("sync.no_conflicts")}
          </div>
        ) : (
          <ScrollArea className="max-h-96 pr-2">
            <ul className="space-y-3">
              {conflicts.map((item) => (
                <li
                  key={item.id}
                  className="rounded-md border bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.entity}</Badge>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.entityId}</code>
                        <Badge variant="secondary">{item.op}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("sync.queued")}: {new Date(item.enqueuedAt).toLocaleString("es-MX")}
                      </p>
                      {item.lastError && (
                        <p className="text-xs text-warning">{t("sync.reason")}: {item.lastError}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        disabled={resolving === item.id}
                        onClick={() => resolve(item, "remote")}
                      >
                        <Server className="h-3 w-3" aria-hidden />
                        {t("sync.keep_server")}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 gap-1.5 text-xs"
                        disabled={resolving === item.id}
                        onClick={() => resolve(item, "local")}
                      >
                        <HardDrive className="h-3 w-3" aria-hidden />
                        {t("sync.keep_local")}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
            <X className="h-3.5 w-3.5" aria-hidden />
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
