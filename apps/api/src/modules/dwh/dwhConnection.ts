import sql from "mssql";
import { userInfo } from "node:os";
import { assertDwhDatabaseSeparate } from "./config.js";

/**
 * Conexión dedicada al DWH: host/auth pueden ser distintos; la base debe ser
 * lógicamente distinta del OLTP.
 * Server-side only: nada de esto viaja al frontend.
 */

function configured(
  primary: string | undefined,
  fallback?: string,
): string | undefined {
  if (primary?.trim()) return primary;
  if (fallback?.trim()) return fallback;
  return undefined;
}

const trusted =
  configured(process.env.DWH_TRUSTED, process.env.DB_TRUSTED) === "true";

const configuredPort = configured(process.env.DWH_PORT, process.env.DB_PORT);
const explicitPort = configuredPort ? Number(configuredPort) : undefined;

const baseOptions = {
  encrypt:
    configured(process.env.DWH_ENCRYPT, process.env.DB_ENCRYPT) === "true",
  trustServerCertificate:
    configured(process.env.DWH_TRUST_CERT, process.env.DB_TRUST_CERT) !==
    "false",
  enableArithAbort: true,
};

function getWindowsAuthCredentials(): { userName: string; domain: string } {
  const envUser = configured(
    process.env.DWH_TRUSTED_USER,
    process.env.DB_TRUSTED_USER,
  );
  const envDomain = configured(
    process.env.DWH_TRUSTED_DOMAIN,
    process.env.DB_TRUSTED_DOMAIN,
  );
  if (envUser && envDomain) {
    return { userName: envUser, domain: envDomain };
  }
  const osUser = userInfo().username;
  const parts = osUser.split("\\");
  if (parts.length === 2) {
    return { userName: parts[1]!, domain: parts[0]! };
  }
  return { userName: osUser, domain: envDomain ?? "" };
}

function buildDwhConfig(database: string): sql.config {
  const server =
    configured(process.env.DWH_SERVER, process.env.DB_SERVER) ?? "localhost";
  const port = explicitPort !== undefined ? { port: explicitPort } : {};
  if (trusted) {
    const { userName, domain } = getWindowsAuthCredentials();
    return {
      server,
      database,
      ...port,
      options: { ...baseOptions, trustedConnection: true },
      authentication: {
        type: "ntlm" as const,
        options: { userName, password: "", domain },
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    };
  }
  return {
    user: configured(process.env.DWH_USER, process.env.DB_USER) ?? "sa",
    password:
      configured(process.env.DWH_PASSWORD, process.env.DB_PASSWORD) ?? "",
    server,
    database,
    ...port,
    options: baseOptions,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
}

let dwhPool: sql.ConnectionPool | null = null;
let dwhPoolPromise: Promise<sql.ConnectionPool> | null = null;
let dwhClosePromise: Promise<void> | null = null;

export async function getDwhPool(): Promise<sql.ConnectionPool> {
  assertDwhDatabaseSeparate(process.env);
  if (dwhClosePromise) await dwhClosePromise;
  if (dwhPool) return dwhPool;
  if (!dwhPoolPromise) {
    const database = (process.env.DWH_DATABASE ?? "nutriclinicadw").trim();
    dwhPoolPromise = new sql.ConnectionPool(buildDwhConfig(database))
      .connect()
      .then(
        (connectedPool) => {
          dwhPool = connectedPool;
          return connectedPool;
        },
        (error: unknown) => {
          dwhPoolPromise = null;
          throw error;
        },
      );
  }
  return dwhPoolPromise;
}

export async function closeDwhPool(): Promise<void> {
  if (dwhClosePromise) return dwhClosePromise;
  dwhClosePromise = (async () => {
    const pending = dwhPoolPromise;
    const activePool =
      dwhPool ?? (pending ? await pending.catch(() => null) : null);
    dwhPool = null;
    dwhPoolPromise = null;
    if (activePool) await activePool.close();
  })().finally(() => {
    dwhClosePromise = null;
  });
  return dwhClosePromise;
}

export async function testDwhConnection(logFailure = true): Promise<boolean> {
  try {
    const pool = await getDwhPool();
    await pool.request().query("SELECT 1 AS ok");
    return true;
  } catch (err) {
    if (logFailure) {
      console.error(
        "[dwh] connection failed:",
        err instanceof Error ? err.message : err,
      );
    }
    return false;
  }
}

/** La base DWH configurada (para metadata/lineage, nunca secreto). */
export function dwhDatabaseName(): string {
  return (process.env.DWH_DATABASE ?? "nutriclinicadw").trim();
}
