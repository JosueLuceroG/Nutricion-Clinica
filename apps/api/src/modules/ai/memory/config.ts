export type MemoryStoreKind = 'memory' | 'sql';

export interface MemoryConfig {
  enabled: boolean;
  retentionDays: number;
  maxEntries: number;
  store: MemoryStoreKind;
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

export function readMemoryConfig(env: NodeJS.ProcessEnv = process.env): MemoryConfig {
  return {
    enabled: bool(env.AI_MEMORY_ENABLED, false),
    retentionDays: Math.max(1, Math.round(number(env.AI_MEMORY_RETENTION_DAYS, 90))),
    maxEntries: Math.max(1, Math.round(number(env.AI_MEMORY_MAX_ENTRIES, 50))),
    store: env.AI_MEMORY_STORE === 'sql' ? 'sql' : 'memory',
  };
}