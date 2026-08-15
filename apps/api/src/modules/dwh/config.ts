export type DwhStoreKind = 'memory' | 'sql';

export interface DwhConfig {
  enabled: boolean;
  store: DwhStoreKind;
  loadWindowDays: number;
  maxFreshnessDays: number;
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

export function readDwhConfig(env: NodeJS.ProcessEnv = process.env): DwhConfig {
  return {
    enabled: bool(env.DWH_ENABLED, false),
    store: env.DWH_STORE === 'sql' ? 'sql' : 'memory',
    loadWindowDays: Math.max(1, Math.round(number(env.DWH_LOAD_WINDOW_DAYS, 7))),
    maxFreshnessDays: Math.max(1, Math.round(number(env.DWH_MAX_FRESHNESS_DAYS, 3))),
  };
}