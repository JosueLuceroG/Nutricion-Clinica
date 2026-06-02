import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface SyncState {
  status: SyncStatus;
  pendingChanges: number;
  lastSyncAt: string | null;
  setStatus: (status: SyncStatus) => void;
  setPendingChanges: (count: number) => void;
  setLastSync: (iso: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: "idle",
      pendingChanges: 0,
      lastSyncAt: null,
      setStatus: (status) => set({ status }),
      setPendingChanges: (pendingChanges) => set({ pendingChanges }),
      setLastSync: (lastSyncAt) => set({ lastSyncAt }),
    }),
    {
      name: "sync-store",
      partialize: (state) => ({ lastSyncAt: state.lastSyncAt }),
    },
  ),
);
