export type DwhStoreKind = "memory" | "sql";

export interface DwhConfig {
  enabled: boolean;
  store: DwhStoreKind;
  loadWindowDays: number;
  maxFreshnessDays: number;
  database: string;
  smallCellMin: number;
  scheduledLoadEnabled: boolean;
  cronSchedule: string;
  cronTimezone: string;
  failInjectionPipeline: string | null;
}

function bool(
  value: string | undefined,
  defaultValue: boolean,
  name: string,
): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} debe ser true o false`);
}

function positiveInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} debe ser entero >= 1`);
  }
  return parsed;
}

/** Fall-closed: el DWH DEBE ser una base distinta del OLTP. */
export function assertDwhDatabaseSeparate(env: NodeJS.ProcessEnv): void {
  const oltp = (env.DB_NAME ?? "nutriclinica").trim().toLowerCase();
  const dwh = (env.DWH_DATABASE ?? "nutriclinicadw").trim().toLowerCase();
  if (oltp === dwh) {
    throw new Error(
      `DWH_DATABASE (${dwh}) apunta a la misma base que el OLTP (${oltp}): el DWH debe ser una base separada (fail-closed).`,
    );
  }
}

export function readDwhConfig(env: NodeJS.ProcessEnv = process.env): DwhConfig {
  assertDwhDatabaseSeparate(env);
  const store = env.DWH_STORE?.trim() || "memory";
  if (store !== "memory" && store !== "sql") {
    throw new Error("DWH_STORE debe ser memory o sql");
  }
  const cronTimezone = env.DWH_CRON_TIMEZONE?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: cronTimezone });
  } catch {
    throw new Error(`DWH_CRON_TIMEZONE invalido: '${cronTimezone}'`);
  }
  return {
    enabled: bool(env.DWH_ENABLED, false, "DWH_ENABLED"),
    store,
    loadWindowDays: positiveInteger(
      env.DWH_LOAD_WINDOW_DAYS,
      7,
      "DWH_LOAD_WINDOW_DAYS",
    ),
    maxFreshnessDays: positiveInteger(
      env.DWH_MAX_FRESHNESS_DAYS,
      3,
      "DWH_MAX_FRESHNESS_DAYS",
    ),
    database: (env.DWH_DATABASE ?? "nutriclinicadw").trim(),
    smallCellMin: positiveInteger(
      env.DWH_SMALL_CELL_MIN,
      5,
      "DWH_SMALL_CELL_MIN",
    ),
    scheduledLoadEnabled: bool(
      env.DWH_SCHEDULED_LOAD_ENABLED,
      false,
      "DWH_SCHEDULED_LOAD_ENABLED",
    ),
    cronSchedule: env.DWH_CRON_SCHEDULE ?? "30 4 * * *",
    cronTimezone,
    failInjectionPipeline: env.DWH_FAIL_INJECTION?.trim() || null,
  };
}
