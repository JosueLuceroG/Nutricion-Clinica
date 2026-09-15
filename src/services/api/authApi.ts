/**
 * Auth API client.
 *
 * Funciones tipadas para los endpoints /auth/* del backend.
 * El token JWT se persiste en el authStore (zustand + localStorage).
 */

import { httpRequest } from "./httpClient.js";
import { useAuthStore } from "@store/authStore";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Role,
} from "@nutriclinica/shared";
import { sensitiveActionApi } from "./sensitiveActionApi.js";

export const authApi = {
  async prepareLocalSession(): Promise<void> {
    const [{ db }, { clearLocalContext }] = await Promise.all([
      import("@services/db"),
      import("@services/security/localContextBoundary"),
    ]);
    await clearLocalContext(db);
  },

  async login(input: LoginRequest): Promise<AuthResponse> {
    return httpRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: input,
      skipAuth: true,
    });
  },

  async register(input: RegisterRequest): Promise<AuthResponse> {
    return httpRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: input,
    });
  },

  async me(): Promise<{
    profesional: AuthResponse["profesional"];
    sucursales: AuthResponse["sucursales"];
  }> {
    return httpRequest("/auth/me");
  },

  async listSucursales(): Promise<{
    sucursales: AuthResponse["sucursales"];
    sucursalActivaId: string | null;
  }> {
    return httpRequest("/sucursales/me");
  },

  async logout(): Promise<void> {
    const [{ stopSync }, { db }, { clearLocalContext }] = await Promise.all([
      import("@services/sync/syncBootstrap"),
      import("@services/db"),
      import("@services/security/localContextBoundary"),
    ]);
    stopSync();
    await clearLocalContext(db);
    try {
      await httpRequest("/auth/logout", { method: "POST" });
    } finally {
      await useAuthStore.getState().logout({ skipLocalCache: true });
    }
  },

  authorizeSensitiveAction: sensitiveActionApi.authorize,
};

export type { AuthResponse, LoginRequest, RegisterRequest, Role };
