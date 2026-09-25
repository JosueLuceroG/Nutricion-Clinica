import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { canonicalSyncId, type AuthProfesionalDTO, type AuthSucursalDTO, type Role } from '@nutriclinica/shared';
import { useSyncStore } from './syncStore';

/**
 * Auth store con JWT real.
 *
 * El token se persiste en localStorage (key: 'auth-store').
 * El syncStore lee el token + sucursalId para añadir headers en cada request.
 */

interface AuthUser extends AuthProfesionalDTO {
  rol: Role;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  sucursales: AuthSucursalDTO[];
  sucursalActivaId: string | null;
  isAuthenticated: boolean;

  setSession: (input: {
    token: string;
    user: AuthUser;
    sucursales: AuthSucursalDTO[];
    sucursalActivaId: string | null;
  }) => void;
  setSucursalActiva: (sucursalId: string | null) => void;
  logout: (options?: { skipLocalCache?: boolean }) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sucursales: [],
      sucursalActivaId: null,
      isAuthenticated: false,
      setSession: ({ token, user, sucursales, sucursalActivaId }) =>
        set({
          token,
          user,
          sucursales,
          sucursalActivaId: sucursalActivaId ? canonicalSyncId(sucursalActivaId) : null,
          isAuthenticated: true,
        }),
      setSucursalActiva: (sucursalId) => set({
        sucursalActivaId: sucursalId ? canonicalSyncId(sucursalId) : null,
      }),
      logout: async (options) => {
        const [{ stopSync }, { db }, { clearLocalContext }] = await Promise.all([
          import('@services/sync/syncBootstrap'),
          import('@services/db'),
          import('@services/security/localContextBoundary'),
        ]);
        stopSync();
        if (!options?.skipLocalCache) await clearLocalContext(db);
        useSyncStore.getState().setSucursalId(null);
        set({
          token: null,
          user: null,
          sucursales: [],
          sucursalActivaId: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        sucursales: state.sucursales,
        sucursalActivaId: state.sucursalActivaId,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
