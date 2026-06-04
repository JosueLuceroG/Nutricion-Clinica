/**
 * HTTP client para el backend NutriClinica (apps/api).
 *
 * Wrapper sobre fetch que:
 * - Inyecta Authorization: Bearer <token> desde el authStore.
 * - Inyecta X-Sucursal-Id desde el syncStore.
 * - Lanza HttpError tipado con status + body.
 * - Base URL configurable via VITE_API_URL.
 */

import { useAuthStore } from '@store/authStore';
import { useSyncStore } from '@store/syncStore';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface HttpClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
  skipSucursalHeader?: boolean;
  signal?: AbortSignal;
}

function buildUrl(base: string, path: string, query?: HttpClientOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function getBaseUrl(): string {
  const fromVite = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  if (fromVite) return fromVite;
  const fromProcess = typeof process !== 'undefined' ? process.env?.VITE_API_URL : undefined;
  return fromProcess ?? 'http://localhost:3000';
}

export async function httpRequest<T = unknown>(path: string, options: HttpClientOptions = {}): Promise<T> {
  const base = getBaseUrl();
  const url = buildUrl(base, path, options.query);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!options.skipAuth) {
    const token = useAuthStore.getState().token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (!options.skipSucursalHeader) {
    const sucId = useSyncStore.getState().sucursalId;
    if (sucId) headers['X-Sucursal-Id'] = sucId;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'Network failure', err);
  }

  const text = await response.text();
  const body: unknown = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `HTTP ${response.status}`;
    throw new HttpError(response.status, message, body);
  }

  return body as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
