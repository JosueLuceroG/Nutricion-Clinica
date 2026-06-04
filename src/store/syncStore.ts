import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  pendingChanges: number;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Sucursal activa (debe coincidir con authStore.sucursalActivaId; copia aquí para
   *  que el httpClient pueda leerlo sin acoplar módulos). */
  sucursalId: string | null;
  setStatus: (status: SyncStatus) => void;
  setPendingChanges: (count: number) => void;
  setLastSync: (iso: string) => void;
  setLastError: (msg: string | null) => void;
  setSucursalId: (id: string | null) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: 'idle',
      pendingChanges: 0,
      lastSyncAt: null,
      lastError: null,
      sucursalId: null,
      setStatus: (status) => set({ status }),
      setPendingChanges: (pendingChanges) => set({ pendingChanges }),
      setLastSync: (lastSyncAt) => set({ lastSyncAt, lastError: null }),
      setLastError: (lastError) => set({ lastError }),
      setSucursalId: (sucursalId) => set({ sucursalId }),
    }),
    {
      name: 'sync-store',
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
        sucursalId: state.sucursalId,
      }),
    },
  ),
);
