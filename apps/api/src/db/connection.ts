import sql from "mssql";
import { userInfo } from "node:os";

/**
 * SQL Server connection config.
 *
 * Soporta dos modos de autenticaci\u00f3n:
 *  - SQL Auth:   DB_USER + DB_PASSWORD en el .env
 *  - Windows:    DB_TRUSTED=true  (usa el usuario del proceso Node, en dev
 *                es el usuario Windows actual; ideal para SQL Express con
 *                autenticaci\u00f3n solo-Windows)
 */
const trusted = process.env.DB_TRUSTED === "true";

// Solo incluir `port` cuando DB_PORT est\u00e1 expl\u00edcitamente seteado.
// Si no, dejar que el driver consulte al SQL Browser (UDP 1434) para
// resolver instancias nombradas (e.g. localhost\SQLEXPRESS).
const explicitPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const baseOptions = {
  encrypt: process.env.DB_ENCRYPT === "true",
  trustServerCertificate: process.env.DB_TRUST_CERT !== "false",
  enableArithAbort: true,
};

/**
 * Para Windows Auth con mssql@11 + Node, el driver no propaga el token
 * NTLM del proceso. Hay que pasarle el usuario y dominio expl\u00edcitamente.
 * En dev local los tomamos del SO; en prod se pueden setear por env.
 */
function getWindowsAuthCredentials(): { userName: string; domain: string } {
  const envUser = process.env.DB_TRUSTED_USER;
  const envDomain = process.env.DB_TRUSTED_DOMAIN;
  if (envUser && envDomain) {
    return { userName: envUser, domain: envDomain };
  }
  // userInfo().username en Windows devuelve "DOMINIO\\usuario" o "EQUIPO\\usuario"
  const osUser = userInfo().username;
  const parts = osUser.split("\\");
  if (parts.length === 2) {
    return { userName: parts[1]!, domain: parts[0]! };
  }
  // Si no tiene dominio (cuenta local), devolvemos userName tal cual y
  // dejamos el dominio vac\u00edo para que NTLM use el equipo local.
  return { userName: osUser, domain: envDomain ?? "" };
}

const config: sql.config = trusted
  ? (() => {
      const { userName, domain } = getWindowsAuthCredentials();
      return {
        server: process.env.DB_SERVER ?? "localhost",
        database: process.env.DB_NAME ?? "nutriclinica",
        ...(explicitPort !== undefined ? { port: explicitPort } : {}),
        options: {
          ...baseOptions,
          trustedConnection: true,
        },
        authentication: {
          type: "ntlm" as const,
          options: {
            userName,
            password: "",
            domain,
          },
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30_000,
        },
      };
    })()
  : {
      user: process.env.DB_USER ?? "sa",
      password: process.env.DB_PASSWORD ?? "",
      server: process.env.DB_SERVER ?? "localhost",
      database: process.env.DB_NAME ?? "nutriclinica",
      ...(explicitPort !== undefined ? { port: explicitPort } : {}),
      options: baseOptions,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30_000,
      },
    };

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

export async function testConnection(): Promise<boolean> {
  try {
    const p = await getPool();
    await p.request().query("SELECT 1 AS ok");
    return true;
  } catch (err) {
    console.error("[db] connection failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export const connectionMode = trusted ? "windows" : "sql";
