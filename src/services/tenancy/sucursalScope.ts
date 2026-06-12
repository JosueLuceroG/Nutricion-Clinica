import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";

export interface SucursalScopedRow {
  sucursal_id?: string | null;
}

export function getActiveSucursalId(): string | null {
  return useSyncStore.getState().sucursalId ?? useAuthStore.getState().sucursalActivaId ?? null;
}

export function rowMatchesSucursal(row: SucursalScopedRow, sucursalId?: string | null): boolean {
  if (!sucursalId) return true;
  return row.sucursal_id === sucursalId;
}

export function withCurrentSucursalScope<T extends SucursalScopedRow>(row: T, existing?: SucursalScopedRow | null): T {
  return {
    ...row,
    sucursal_id: row.sucursal_id ?? existing?.sucursal_id ?? getActiveSucursalId(),
  };
}
