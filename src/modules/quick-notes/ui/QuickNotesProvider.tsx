import * as React from "react";
import { useAuthStore } from "@store/authStore";
import { useQuickNotesStore } from "@store/quickNotesStore";
import { useSyncStore } from "@store/syncStore";
import { quickNotesStorageKey } from "../infrastructure";
import { QuickNotesLayer } from "./QuickNotesLayer";

export function QuickNotesProvider() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authSucursalId = useAuthStore((state) => state.sucursalActivaId);
  const syncSucursalId = useSyncStore((state) => state.sucursalId);
  const activeScopeKey = useQuickNotesStore((state) => state.scopeKey);
  const activateScope = useQuickNotesStore((state) => state.activateScope);
  const deactivateScope = useQuickNotesStore((state) => state.deactivateScope);
  const flush = useQuickNotesStore((state) => state.flush);
  const sucursalId = syncSucursalId ?? authSucursalId ?? null;
  const expectedScopeKey = userId
    ? quickNotesStorageKey({ userId, sucursalId })
    : null;

  React.useEffect(() => {
    if (!userId) {
      void deactivateScope();
      return;
    }
    void activateScope({ userId, sucursalId });
  }, [activateScope, deactivateScope, sucursalId, userId]);

  React.useEffect(() => {
    const persistPendingNotes = () => {
      void flush();
    };
    window.addEventListener("beforeunload", persistPendingNotes);
    return () => {
      window.removeEventListener("beforeunload", persistPendingNotes);
      void flush();
    };
  }, [flush]);

  if (!expectedScopeKey || activeScopeKey !== expectedScopeKey) return null;
  return <QuickNotesLayer />;
}
