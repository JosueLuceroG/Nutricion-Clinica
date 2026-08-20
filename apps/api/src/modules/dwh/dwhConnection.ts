import sql from 'mssql';
import { userInfo } from 'node:os';
import { assertDwhDatabaseSeparate } from './config.js';

/**
 * Conexión dedicada al DWH: misma instancia/auth que el OLTP, base DISTINTA.
 * Server-side only: nada de esto viaja al frontend.
 */

const trusted = process.env.DB_TRUSTED === 'true';

const explicitPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

const baseOptions = {
  encrypt: process.env.DB_ENCRYPT === 'true',
  trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  enableArithAbort: true,
};

function getWindowsAuthCredentials(): { userName: string; domain: string } {
  const envUser = process.env.DB_TRUSTED_USER;
  const envDomain = process.env.DB_TRUSTED_DOMAIN;
  if (envUser && envDomain) {
    return { userName: envUser, domain: envDomain };
  }
  const osUser = userInfo().username;
  const parts = osUser.split('\\');
  if (parts.length === 2) {
    return { userName: parts[1]!, domain: parts[0]! };
  }
  return { userName: osUser, domain: envDomain ?? '' };
}

function buildDwhConfig(database: string): sql.config {
  const server = process.env.DB_SERVER ?? 'localhost';
  const port = explicitPort !== undefined ? { port: explicitPort } : {};
  if (trusted) {
    const { userName, domain } = getWindowsAuthCredentials();
    return {
      server,
      database,
      ...port,
      options: { ...baseOptions, trustedConnection: true },
      authentication: { type: 'ntlm' as const, options: { userName, password: '', domain } },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    };
  }
  return {
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    server,
    database,
    ...port,
    options: baseOptions,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
  };
}

let dwhPool: sql.ConnectionPool | null = null;

export async function getDwhPool(): Promise<sql.ConnectionPool> {
  assertDwhDatabaseSeparate(process.env);
  if (dwhPool) return dwhPool;
  const database = (process.env.DWH_DATABASE ?? 'nutriclinicadw').trim();
  dwhPool = await new sql.ConnectionPool(buildDwhConfig(database)).connect();
  return dwhPool;
}

export async function closeDwhPool(): Promise<void> {
  if (dwhPool) {
    await dwhPool.close();
    dwhPool = null;
  }
}

/** La base DWH configurada (para metadata/lineage, nunca secreto). */
export function dwhDatabaseName(): string {
  return (process.env.DWH_DATABASE ?? 'nutriclinicadw').trim();
}