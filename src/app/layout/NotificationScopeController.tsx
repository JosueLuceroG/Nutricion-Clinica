import * as React from "react";
import { useAuthStore } from "@store/authStore";
import { useNotificationStore } from "@store/notificationStore";

export function NotificationScopeController() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const activateScope = useNotificationStore((state) => state.activateScope);
  const deactivateScope = useNotificationStore(
    (state) => state.deactivateScope,
  );

  React.useLayoutEffect(() => {
    if (!userId) {
      deactivateScope();
      return;
    }
    activateScope({ userId, sucursalId });
  }, [activateScope, deactivateScope, sucursalId, userId]);

  React.useLayoutEffect(
    () => () => {
      deactivateScope();
    },
    [deactivateScope],
  );

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const state = useNotificationStore.getState();
      if (!state.scope || event.key !== state.scopeKey) return;
      state.activateScope(state.scope);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
