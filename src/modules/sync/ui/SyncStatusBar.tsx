import * as React from "react";
import { useTranslation } from "react-i18next";
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
  { labelKey: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }
> = {
  idle: { labelKey: "sync.synced", icon: CheckCircle2, variant: "success" },
  syncing: { labelKey: "sync.syncing", icon: RefreshCw, variant: "info" },
  offline: { labelKey: "sync.offline", icon: CloudOff, variant: "warning" },
  error: { labelKey: "sync.error", icon: AlertCircle, variant: "destructive" },
};

export function SyncStatusBar() {
  const { t } = useTranslation();
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
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <Badge
          variant={cfg.variant}
          className="gap-1 px-1.5 py-0 text-[10px]"
          title={lastError ?? undefined}
        >
          <StatusIcon
            className={cn("h-3 w-3", status === "syncing" && "animate-spin")}
            aria-hidden
          />
          {t(cfg.labelKey)}
        </Badge>

        {pending > 0 && (
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="flex items-center gap-1 rounded px-1 hover:bg-muted"
            title={t("sync.view_queue_details")}
          >
            <Database className="h-3 w-3" aria-hidden />
            {t("sync.pending_count", { count: pending })}
          </button>
        )}

        {conflictCount > 0 && (
          <button
            type="button"
            onClick={() => setConflictOpen(true)}
            className="flex items-center gap-1 rounded px-1 text-warning hover:bg-warning/10"
            title={t("sync.resolve_conflicts")}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t("sync.conflict_count", { count: conflictCount })}
          </button>
        )}

        <span className="flex items-center gap-1" title={t("sync.last_sync", { time: lastSyncLabel })}>
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
            {isOnline ? t("sync.online") : t("sync.disconnected")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[10px]"
            onClick={() => void syncNow()}
            disabled={status === "syncing"}
            title={t("sync.force_now")}
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            {t("sync.sync_now")}
          </Button>
        </div>
      </div>

      <ConflictResolutionModal open={conflictOpen} onOpenChange={setConflictOpen} />
      <SyncQueueDiagnosticModal open={queueOpen} onOpenChange={setQueueOpen} />
    </>
  );
}
