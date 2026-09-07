import { isIP } from "node:net";

export type TrustProxySetting = false | number | string[];

export interface ServerRuntimeConfig {
  bindHost: string;
  port: number;
  trustProxy: TrustProxySetting;
  backgroundJobsEnabled: boolean;
  shutdownTimeoutMs: number;
}

export function readTrustProxy(value: string | undefined): TrustProxySetting {
  const raw = value?.trim();
  if (!raw || raw === "false") return false;
  if (raw === "true" || raw === "*" || raw === "0.0.0.0/0" || raw === "::/0") {
    throw new Error("TRUST_PROXY no puede confiar en todos los proxies");
  }
  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    if (hops < 1 || hops > 16) {
      throw new Error("TRUST_PROXY por saltos debe estar entre 1 y 16");
    }
    return hops;
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (
    entries.length === 0 ||
    entries.some((entry) => {
      const [address, prefix, extra] = entry.split("/");
      const version = isIP(address ?? "");
      if (version === 0 || extra !== undefined) return true;
      if (prefix === undefined) return false;
      if (!/^\d+$/.test(prefix)) return true;
      const bits = Number(prefix);
      return bits === 0 || bits > (version === 4 ? 32 : 128);
    })
  ) {
    throw new Error(
      "TRUST_PROXY debe ser false, numero de saltos o lista IP/CIDR",
    );
  }
  return entries;
}

function readBoolean(
  value: string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} debe ser true o false`);
}

function readInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  const parsed =
    value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} debe ser entero entre ${min} y ${max}`);
  }
  return parsed;
}

export function readServerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerRuntimeConfig {
  const bindHost = (env.API_BIND_HOST ?? "127.0.0.1").trim();
  if (!bindHost || /[\s/]/.test(bindHost)) {
    throw new Error("API_BIND_HOST invalido");
  }
  return {
    bindHost,
    port: readInteger(env.PORT, 3000, 1, 65535, "PORT"),
    trustProxy: readTrustProxy(env.TRUST_PROXY),
    backgroundJobsEnabled: readBoolean(
      env.BACKGROUND_JOBS_ENABLED,
      true,
      "BACKGROUND_JOBS_ENABLED",
    ),
    shutdownTimeoutMs: readInteger(
      env.SHUTDOWN_TIMEOUT_MS,
      15_000,
      1_000,
      120_000,
      "SHUTDOWN_TIMEOUT_MS",
    ),
  };
}
