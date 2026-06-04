import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthProfesionalDTO, AuthSucursalDTO, Role } from '@nutriclinica/shared';

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
  logout: () => void;
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
          sucursalActivaId,
          isAuthenticated: true,
        }),
      setSucursalActiva: (sucursalId) => set({ sucursalActivaId: sucursalId }),
      logout: () =>
        set({
          token: null,
          user: null,
          sucursales: [],
          sucursalActivaId: null,
          isAuthenticated: false,
        }),
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
