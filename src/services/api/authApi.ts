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
    try {
      await httpRequest("/auth/logout", { method: "POST" });
    } finally {
      useAuthStore.getState().logout();
    }
  },

  authorizeSensitiveAction: sensitiveActionApi.authorize,
};

export type { AuthResponse, LoginRequest, RegisterRequest, Role };
