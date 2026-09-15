import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import { canonicalSyncId } from "@nutriclinica/shared";

export interface SucursalScopedRow {
  sucursal_id?: string | null;
}

export function getActiveSucursalId(): string | null {
  const sucursalId = (
    useSyncStore.getState().sucursalId ??
    useAuthStore.getState().sucursalActivaId ??
    null
  );
  return sucursalId ? canonicalSyncId(sucursalId) : null;
}

export function requireActiveSucursalId(): string {
  const sucursalId = getActiveSucursalId();
  if (!sucursalId) throw new Error("No hay sucursal activa");
  return sucursalId;
}

export function rowMatchesSucursal(
  row: SucursalScopedRow,
  sucursalId?: string | null,
): boolean {
  if (!sucursalId) return false;
  return typeof row.sucursal_id === "string" &&
    canonicalSyncId(row.sucursal_id) === canonicalSyncId(sucursalId);
}

export function withCurrentSucursalScope<T extends SucursalScopedRow>(
  row: T,
  existing?: SucursalScopedRow | null,
): T {
  const sucursalId =
    row.sucursal_id ?? existing?.sucursal_id ?? getActiveSucursalId();
  return {
    ...row,
    sucursal_id: typeof sucursalId === "string" ? canonicalSyncId(sucursalId) : sucursalId,
  };
}

export function withSucursalScope<T extends SucursalScopedRow>(
  row: T,
  sucursalId: string,
): T {
  return { ...row, sucursal_id: canonicalSyncId(sucursalId) };
}
