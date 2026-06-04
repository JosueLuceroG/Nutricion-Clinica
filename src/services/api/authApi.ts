/**
 * Auth API client.
 *
 * Funciones tipadas para los endpoints /auth/* del backend.
 * El token JWT se persiste en el authStore (zustand + localStorage).
 */

import { httpRequest } from './httpClient.js';
import type { AuthResponse, LoginRequest, RegisterRequest, Role } from '@nutriclinica/shared';

export const authApi = {
  async login(input: LoginRequest): Promise<AuthResponse> {
    return httpRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      skipAuth: true,
    });
  },

  async register(input: RegisterRequest): Promise<AuthResponse> {
    return httpRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      skipAuth: true,
    });
  },

  async me(): Promise<{ profesional: AuthResponse['profesional']; sucursales: AuthResponse['sucursales'] }> {
    return httpRequest('/auth/me');
  },

  async listSucursales(): Promise<{ sucursales: AuthResponse['sucursales']; sucursalActivaId: string | null }> {
    return httpRequest('/sucursales/me');
  },
};

export type { AuthResponse, LoginRequest, RegisterRequest, Role };
