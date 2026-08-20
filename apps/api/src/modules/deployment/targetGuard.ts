import { readEnvironmentClass, type EnvironmentClass } from './environmentIdentity';

/**
 * Guardas de objetivo (Build 09.5A §6, §26-28, §48).
 * Acciones destructivas/sensibles contra PRODUCTION o entornos UNKNOWN => fail-closed
 * salvo ALLOW_PRODUCTION_<ACCION>=true explicito.
 * STAGING debe apuntar a bases operacionalmente distintas (nunca los nombres locales
 * por defecto 'nutriclinica' / 'nutriclinicadw').
 */

export type DestructiveAction = 'migrate' | 'seed' | 'reset' | 'rebuild' | 'drop' | 'maintenance';

export const DEFAULT_OLTP_DB = 'nutriclinica';
export const DEFAULT_DWH_DB = 'nutriclinicadw';

export function assertTargetSafe(action: DestructiveAction, env: NodeJS.ProcessEnv = process.env): void {
  const environmentClass = readEnvironmentClass(env);
  if (environmentClass === 'UNKNOWN') {
    throw new Error(`guard: entorno UNKNOWN: '${action}' bloqueado (fail-closed)`);
  }
  if (environmentClass === 'PRODUCTION') {
    const allowed = env[`ALLOW_PRODUCTION_${action.toUpperCase()}`] === 'true';
    if (!allowed) {
      throw new Error(`guard: '${action}' bloqueado contra PRODUCTION; requiere ALLOW_PRODUCTION_${action.toUpperCase()}=true explicito`);
    }
  }
  if (environmentClass === 'STAGING') {
    assertStagingDatabases(env);
  }
}

/** STAGING no puede apuntar a las bases por defecto locales ni a la misma base OLTP/DWH. */
export function assertStagingDatabases(env: NodeJS.ProcessEnv = process.env): void {
  const oltp = (env.DB_NAME ?? '').trim().toLowerCase();
  const dwh = (env.DWH_DATABASE ?? '').trim().toLowerCase();
  if (!oltp || !dwh) {
    throw new Error('guard: STAGING requiere DB_NAME y DWH_DATABASE explicitos');
  }
  if (oltp === dwh) {
    throw new Error(`guard: STAGING no puede usar la misma base para OLTP y DWH ('${oltp}')`);
  }
  if (oltp === DEFAULT_OLTP_DB || dwh === DEFAULT_DWH_DB) {
    throw new Error(`guard: STAGING no puede apuntar a las bases por defecto locales ('${oltp}'/'${dwh}')`);
  }
}

export function describeTarget(env: NodeJS.ProcessEnv = process.env): { environmentClass: EnvironmentClass; oltp: string; dwh: string } {
  const environmentClass = readEnvironmentClass(env);
  const oltp = (env.DB_NAME ?? DEFAULT_OLTP_DB).trim();
  const dwh = (env.DWH_DATABASE ?? DEFAULT_DWH_DB).trim();
  return { environmentClass, oltp, dwh };
}