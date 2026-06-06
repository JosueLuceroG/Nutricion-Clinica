import * as React from "react";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Database,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { useSyncStore, type SyncStatus } from "@store/syncStore";
import { useSyncActions } from "@services/sync/useSyncActions";
import { ConflictResolutionModal } from "@modules/sync/ui/ConflictResolutionModal";
import { SyncQueueDiagnosticModal } from "@modules/sync/ui/SyncQueueDiagnosticModal";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { cn } from "@utils/cn";

const STATUS_CONFIG: Record<
  SyncStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }
> = {
  idle: { label: "Sincronizado", icon: CheckCircle2, variant: "success" },
  syncing: { label: "Sincronizando\u2026", icon: RefreshCw, variant: "info" },
  offline: { label: "Sin conexi\u00f3n", icon: CloudOff, variant: "warning" },
  error: { label: "Error de sync", icon: AlertCircle, variant: "destructive" },
};

export function StatusBar() {
  const status = useSyncStore((s) => s.status);
  const pending = useSyncStore((s) => s.pendingChanges);
  const lastSync = useSyncStore((s) => s.lastSyncAt);
  const lastError = useSyncStore((s) => s.lastError);
  const { syncNow, conflictCount } = useSyncActions();
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  React.useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      })
    : "\u2014";

  return (
    <>
      <footer
        className="flex h-7 items-center gap-3 border-t bg-muted/30 px-3 text-[11px] text-muted-foreground"
        role="contentinfo"
      >
        <Badge
          variant={cfg.variant}
          className="gap-1 px-1.5 py-0 text-[10px]"
          title={lastError ?? undefined}
        >
          <StatusIcon
            className={cn("h-3 w-3", status === "syncing" && "animate-spin")}
            aria-hidden
          />
          {cfg.label}
        </Badge>

        {pending > 0 && (
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="flex items-center gap-1 rounded px-1 hover:bg-muted"
            title="Ver detalles de la cola de sincronización"
          >
            <Database className="h-3 w-3" aria-hidden />
            {pending} pendiente{pending === 1 ? "" : "s"}
          </button>
        )}

        {conflictCount > 0 && (
          <button
            type="button"
            onClick={() => setConflictOpen(true)}
            className="flex items-center gap-1 rounded px-1 text-warning hover:bg-warning/10"
            title="Resolver conflictos de sincronizaci\u00f3n"
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {conflictCount} conflicto{conflictCount === 1 ? "" : "s"}
          </button>
        )}

        <span className="flex items-center gap-1" title={`\u00daltima sync: ${lastSyncLabel}`}>
          <Cloud className="h-3 w-3" aria-hidden />
          {lastSyncLabel}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1">
            {isOnline ? (
              <Wifi className="h-3 w-3 text-success" aria-hidden />
            ) : (
              <WifiOff className="h-3 w-3 text-warning" aria-hidden />
            )}
            {isOnline ? "En l\u00ednea" : "Desconectado"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[10px]"
            onClick={() => void syncNow()}
            disabled={status === "syncing"}
            title="Forzar un ciclo de sync ahora"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Sincronizar
          </Button>
        </div>
      </footer>

      <ConflictResolutionModal open={conflictOpen} onOpenChange={setConflictOpen} />
      <SyncQueueDiagnosticModal open={queueOpen} onOpenChange={setQueueOpen} />
    </>
  );
}
