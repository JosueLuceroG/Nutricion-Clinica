function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/$/, "") : undefined;
}

/**
 * The API origin is public client configuration, never a secret. Production
 * artifacts fail closed instead of silently contacting a developer machine.
 */
export function getApiBaseUrl(): string {
  if (import.meta.env.MODE === "test" && typeof process !== "undefined") {
    const testOverride = configured(process.env?.VITE_API_URL);
    if (testOverride) return testOverride;
  }

  const fromVite = configured(import.meta.env.VITE_API_URL);
  if (fromVite) return fromVite;
  if (import.meta.env.DEV) return "http://localhost:3000";

  throw new Error("VITE_API_URL es obligatorio en builds de produccion");
}

/** Builds an absolute WebSocket URL, including when the API base is `/api`. */
export function getApiWebSocketUrl(path: string): string {
  const base = getApiBaseUrl();
  let baseUrl: URL;
  try {
    baseUrl = new URL(base);
  } catch {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!origin || origin === "null" || !base.startsWith("/")) {
      throw new Error("No se puede resolver la URL WebSocket del API");
    }
    baseUrl = new URL(base, origin);
  }
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${baseUrl.toString().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
