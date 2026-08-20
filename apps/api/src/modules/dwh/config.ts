export type DwhStoreKind = 'memory' | 'sql';

export interface DwhConfig {
  enabled: boolean;
  store: DwhStoreKind;
  loadWindowDays: number;
  maxFreshnessDays: number;
  database: string;
  smallCellMin: number;
  scheduledLoadEnabled: boolean;
  cronSchedule: string;
  failInjectionPipeline: string | null;
}

function bool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true';
}

function number(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/** Fall-closed: el DWH DEBE ser una base distinta del OLTP. */
export function assertDwhDatabaseSeparate(env: NodeJS.ProcessEnv): void {
  const oltp = (env.DB_NAME ?? 'nutriclinica').trim().toLowerCase();
  const dwh = (env.DWH_DATABASE ?? 'nutriclinicadw').trim().toLowerCase();
  if (oltp === dwh) {
    throw new Error(`DWH_DATABASE (${dwh}) apunta a la misma base que el OLTP (${oltp}): el DWH debe ser una base separada (fail-closed).`);
  }
}

export function readDwhConfig(env: NodeJS.ProcessEnv = process.env): DwhConfig {
  assertDwhDatabaseSeparate(env);
  return {
    enabled: bool(env.DWH_ENABLED, false),
    store: env.DWH_STORE === 'sql' ? 'sql' : 'memory',
    loadWindowDays: Math.max(1, Math.round(number(env.DWH_LOAD_WINDOW_DAYS, 7))),
    maxFreshnessDays: Math.max(1, Math.round(number(env.DWH_MAX_FRESHNESS_DAYS, 3))),
    database: (env.DWH_DATABASE ?? 'nutriclinicadw').trim(),
    smallCellMin: Math.max(1, Math.round(number(env.DWH_SMALL_CELL_MIN, 5))),
    scheduledLoadEnabled: bool(env.DWH_SCHEDULED_LOAD_ENABLED, false),
    cronSchedule: env.DWH_CRON_SCHEDULE ?? '30 4 * * *',
    failInjectionPipeline: env.DWH_FAIL_INJECTION?.trim() || null,
  };
}