import * as React from "react";
import { useAuthStore } from "@store/authStore";
import { useDashboardQuickAccessStore } from "@store/dashboardQuickAccessStore";

export function DashboardQuickAccessScopeController() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const activateScope = useDashboardQuickAccessStore(
    (state) => state.activateScope,
  );
  const deactivateScope = useDashboardQuickAccessStore(
    (state) => state.deactivateScope,
  );

  React.useEffect(() => {
    if (!userId) {
      void deactivateScope();
      return;
    }
    void activateScope({ userId, sucursalId });
  }, [activateScope, deactivateScope, sucursalId, userId]);

  React.useEffect(
    () => () => {
      void deactivateScope();
    },
    [deactivateScope],
  );

  return null;
}
