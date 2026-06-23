import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { ConflictResolutionModal } from "@modules/sync/ui/ConflictResolutionModal";
import { SyncQueueDiagnosticModal } from "@modules/sync/ui/SyncQueueDiagnosticModal";
import { useSyncActions } from "@services/sync/useSyncActions";
import { useSyncStore, type SyncStatus } from "@store/syncStore";

const STATUS_CONFIG: Record<SyncStatus, { labelKey: string; icon: LucideIcon; tone: string }> = {
  idle: { labelKey: "sync.synced", icon: CheckCircle2, tone: "synced" },
  syncing: { labelKey: "sync.syncing", icon: RefreshCw, tone: "syncing" },
  offline: { labelKey: "sync.offline", icon: CloudOff, tone: "offline" },
  error: { labelKey: "sync.error", icon: AlertCircle, tone: "error" },
};

export function BottomStatusBar() {
  const { t } = useTranslation();
  const status = useSyncStore((s) => s.status);
  const pending = useSyncStore((s) => s.pendingChanges);
  const lastSync = useSyncStore((s) => s.lastSyncAt);
  const lastError = useSyncStore((s) => s.lastError);
  const { syncNow, conflictCount } = useSyncActions();
  const [queueOpen, setQueueOpen] = React.useState(false);
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      })
    : "Sin registro";
  const isSyncing = status === "syncing";

  return (
    <>
      <footer className="nc-dashboard-bottom-frame nc-dashboard-bottom-bar" role="contentinfo">
        <div
          className={`nc-dashboard-bottom-status nc-dashboard-bottom-status--${config.tone}`}
          title={lastError ?? undefined}
        >
          <StatusIcon className={isSyncing ? "nc-dashboard-spin" : undefined} size={15} strokeWidth={2.2} aria-hidden="true" />
          <span>{t(config.labelKey)}</span>
        </div>

        <button
          type="button"
          className="nc-dashboard-bottom-chip nc-dashboard-bottom-chip--button"
          onClick={() => setQueueOpen(true)}
          title={t("sync.view_queue_details")}
        >
          <Database size={15} strokeWidth={2} aria-hidden="true" />
          <span>{pending > 0 ? t("sync.pending_count", { count: pending }) : "Cola al dia"}</span>
        </button>

        {conflictCount > 0 ? (
          <button
            type="button"
            className="nc-dashboard-bottom-chip nc-dashboard-bottom-chip--button nc-dashboard-bottom-chip--warning"
            onClick={() => setConflictOpen(true)}
            title={t("sync.resolve_conflicts")}
          >
            <AlertTriangle size={15} strokeWidth={2} aria-hidden="true" />
            <span>{t("sync.conflict_count", { count: conflictCount })}</span>
          </button>
        ) : (
          <span className="nc-dashboard-bottom-chip nc-dashboard-bottom-chip--quiet">
            <CheckCircle2 size={15} strokeWidth={2} aria-hidden="true" />
            Sin conflictos
          </span>
        )}

        <span className="nc-dashboard-bottom-chip nc-dashboard-bottom-chip--sync" title={t("sync.last_sync", { time: lastSyncLabel })}>
          <Cloud size={15} strokeWidth={2} aria-hidden="true" />
          <span>Ultima sync: {lastSyncLabel}</span>
        </span>

        <div className="nc-dashboard-bottom-bar__spacer" />

        <span className={`nc-dashboard-bottom-network${isOnline ? " nc-dashboard-bottom-network--online" : " nc-dashboard-bottom-network--offline"}`}>
          {isOnline ? <Wifi size={15} strokeWidth={2} aria-hidden="true" /> : <WifiOff size={15} strokeWidth={2} aria-hidden="true" />}
          <span>{isOnline ? t("sync.online") : t("sync.disconnected")}</span>
        </span>

        <button
          type="button"
          className="nc-dashboard-bottom-sync-button"
          onClick={() => void syncNow()}
          disabled={isSyncing}
          title={t("sync.force_now")}
        >
          <RefreshCw className={isSyncing ? "nc-dashboard-spin" : undefined} size={15} strokeWidth={2.2} aria-hidden="true" />
          <span>{t("sync.sync_now")}</span>
        </button>
      </footer>

      <SyncQueueDiagnosticModal open={queueOpen} onOpenChange={setQueueOpen} />
      <ConflictResolutionModal open={conflictOpen} onOpenChange={setConflictOpen} />
    </>
  );
}
