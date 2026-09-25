import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { getPool } from "../../db/connection.js";
import { listMigrations } from "../../db/migrate.js";
import { getDwhPool } from "../dwh/dwhConnection.js";
import {
  assertDwhSchemaCompatible,
  DWH_SCHEMA_VERSION,
} from "../dwh/schema/dwhSchema.js";

export const STANDALONE_CONTRACT_VERSION = "standalone-windows-v1";
export const STANDALONE_OLTP_SCHEMA_VERSION = "039";
export const STANDALONE_DWH_SCHEMA_VERSION = DWH_SCHEMA_VERSION;

export type StandalonePreflightPhase = "install" | "runtime";
export type StandalonePreflightStatus = "pass" | "warning" | "fail";

export interface StandalonePreflightCheck {
  id: string;
  status: StandalonePreflightStatus;
  detail: string;
}

export interface StandalonePreflightReport {
  contractVersion: typeof STANDALONE_CONTRACT_VERSION;
  phase: StandalonePreflightPhase;
  ok: boolean;
  checks: StandalonePreflightCheck[];
}

export interface StandalonePaths {
  dataRoot: string;
  backupRoot: string;
  logRoot: string;
  webRoot: string;
}

interface SchemaProbe {
  current: boolean;
  detail: string;
}

export interface StandalonePreflightDependencies {
  accessPath(path: string, mode: number): Promise<void>;
  probeOltp(): Promise<void>;
  probeDwh(): Promise<void>;
  probeOltpSchema(): Promise<SchemaProbe>;
  probeDwhSchema(): Promise<SchemaProbe>;
}

function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function placeholder(value: string): boolean {
  return /(?:change|replace|reemplaz|example|sample|placeholder|todo)/i.test(
    value,
  );
}

function secretConfigured(value: string | undefined, minimum: number): boolean {
  const raw = value?.trim() ?? "";
  return raw.length >= minimum && new Set(raw).size >= 8 && !placeholder(raw);
}

function push(
  checks: StandalonePreflightCheck[],
  id: string,
  passed: boolean,
  okDetail: string,
  failedDetail: string,
  failureStatus: Exclude<StandalonePreflightStatus, "pass"> = "fail",
): void {
  checks.push({
    id,
    status: passed ? "pass" : failureStatus,
    detail: passed ? okDetail : failedDetail,
  });
}

export function readStandalonePaths(
  env: NodeJS.ProcessEnv = process.env,
): StandalonePaths {
  const programData = configured(env.PROGRAMDATA) ?? "C:\\ProgramData";
  const dataRoot =
    configured(env.NUTRICLINICA_DATA_ROOT) ?? join(programData, "NutriClinica");
  return {
    dataRoot,
    backupRoot:
      configured(env.NUTRICLINICA_BACKUP_ROOT) ?? join(dataRoot, "backups"),
    logRoot: configured(env.NUTRICLINICA_LOG_ROOT) ?? join(dataRoot, "logs"),
    webRoot: configured(env.NUTRICLINICA_WEB_ROOT) ?? join(dataRoot, "web"),
  };
}

export function validateStandaloneConfiguration(
  env: NodeJS.ProcessEnv,
): StandalonePreflightCheck[] {
  const checks: StandalonePreflightCheck[] = [];
  push(
    checks,
    "config.mode",
    env.STANDALONE_MODE === "true",
    "standalone mode enabled",
    "STANDALONE_MODE=true is required",
  );
  push(
    checks,
    "config.environment",
    env.ENVIRONMENT_CLASS === "LOCAL" || env.ENVIRONMENT_CLASS === "TEST",
    "environment is explicitly local",
    "standalone requires ENVIRONMENT_CLASS=LOCAL or TEST",
  );
  push(
    checks,
    "config.instance",
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(
      configured(env.INSTANCE_ID) ?? "",
    ),
    "instance identity configured",
    "INSTANCE_ID is missing or invalid",
  );

  const bindHost = configured(env.API_BIND_HOST) ?? "127.0.0.1";
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]).has(bindHost);
  const lanAllowed = env.STANDALONE_ALLOW_LAN === "true";
  push(
    checks,
    "network.bind",
    loopback || (lanAllowed && bindHost !== "0.0.0.0" && bindHost !== "::"),
    loopback ? "API bound to loopback" : "explicit LAN binding enabled",
    "non-loopback binding requires STANDALONE_ALLOW_LAN=true and an explicit host",
  );

  const dbName = configured(env.DB_NAME) ?? "nutriclinica";
  const dwhName = configured(env.DWH_DATABASE) ?? "nutriclinicadw";
  push(
    checks,
    "sql.separation",
    dbName.toLowerCase() !== dwhName.toLowerCase(),
    "OLTP and DWH database identities are distinct",
    "DB_NAME and DWH_DATABASE must be different",
  );
  push(
    checks,
    "sql.oltp-auth",
    env.DB_TRUSTED === "true" ||
      (Boolean(configured(env.DB_USER)) &&
        secretConfigured(env.DB_PASSWORD, 12)),
    "OLTP authentication configured server-side",
    "configure Windows auth or a protected SQL credential for OLTP",
  );
  const dwhTrusted = configured(env.DWH_TRUSTED) ?? configured(env.DB_TRUSTED);
  const dwhUser = configured(env.DWH_USER) ?? configured(env.DB_USER);
  const dwhPassword =
    configured(env.DWH_PASSWORD) ?? configured(env.DB_PASSWORD);
  push(
    checks,
    "sql.dwh-auth",
    dwhTrusted === "true" ||
      (Boolean(dwhUser) && secretConfigured(dwhPassword, 12)),
    "DWH authentication configured server-side",
    "configure Windows auth or a protected SQL credential for DWH",
  );
  push(
    checks,
    "dwh.runtime",
    env.DWH_ENABLED === "true" && env.DWH_STORE === "sql",
    "DWH uses the dedicated SQL store",
    "standalone requires DWH_ENABLED=true and DWH_STORE=sql",
  );

  push(
    checks,
    "secrets.jwt",
    secretConfigured(env.JWT_SECRET, 32),
    "JWT secret is provisioned",
    "JWT secret is missing, weak or a placeholder",
  );
  push(
    checks,
    "secrets.fields",
    secretConfigured(env.FIELD_ENCRYPTION_KEY, 32),
    "field encryption key is provisioned",
    "field encryption key is missing, weak or a placeholder",
  );

  push(
    checks,
    "ai.patient",
    env.AI_PATIENT_ENABLED !== "true",
    "Patient AI remains disabled",
    "Patient AI is not certified for standalone mode",
  );
  push(
    checks,
    "ai.shadow",
    !configured(env.AI_SHADOW_STATE) || env.AI_SHADOW_STATE === "DISABLED",
    "professional shadow remains disabled",
    "professional shadow must remain DISABLED",
  );
  push(
    checks,
    "ai.memory",
    env.AI_MEMORY_ENABLED !== "true" || env.AI_MEMORY_STORE === "sql",
    env.AI_MEMORY_ENABLED === "true"
      ? "AI memory is persisted in SQL"
      : "AI memory is disabled",
    "enabled AI memory must use the SQL store",
  );
  push(
    checks,
    "ai.rag",
    env.AI_RAG_VERSIONED !== "true" || env.AI_RAG_DOC_STORE === "sql",
    env.AI_RAG_VERSIONED === "true"
      ? "versioned RAG documents are persisted in SQL"
      : "versioned RAG is disabled",
    "versioned RAG must use the SQL document store",
  );
  push(
    checks,
    "observability.persistence",
    env.AI_TELEMETRY_STORE === "sql",
    "telemetry is persisted in SQL",
    "telemetry is ephemeral; recovery excludes historical telemetry",
    "warning",
  );
  push(
    checks,
    "internet.core",
    env.EXTERNAL_SIDE_EFFECTS_MODE !== "PRODUCTION",
    "core operation does not require external side effects",
    "external production side effects are enabled",
    "warning",
  );
  return checks;
}

async function defaultOltpSchemaProbe(): Promise<SchemaProbe> {
  const [pool, expected] = await Promise.all([getPool(), listMigrations()]);
  const legacyDwh = await pool
    .request()
    .query<{
      name: string;
    }>("SELECT name FROM sys.tables WHERE name IN ('dwh_metric_snapshots', 'dwh_load_runs')");
  if (legacyDwh.recordset.length > 0) {
    throw new Error("legacy DWH tables are present in the OLTP database");
  }
  const result = await pool
    .request()
    .query<{
      filename: string;
      checksum: string;
    }>("SELECT filename, checksum FROM dbo.schema_migrations ORDER BY filename");
  const applied = new Map(
    result.recordset.map((row) => [row.filename, row.checksum]),
  );
  const current =
    expected.length > 0 &&
    expected.every(
      (migration) => applied.get(migration.filename) === migration.checksum,
    ) &&
    applied.size === expected.length &&
    expected
      .at(-1)
      ?.filename.startsWith(`${STANDALONE_OLTP_SCHEMA_VERSION}-`) === true;
  return {
    current,
    detail: current
      ? `OLTP schema ${STANDALONE_OLTP_SCHEMA_VERSION}`
      : `OLTP migrations ${applied.size}/${expected.length}`,
  };
}

async function defaultDwhSchemaProbe(): Promise<SchemaProbe> {
  const pool = await getDwhPool();
  try {
    await assertDwhSchemaCompatible(pool);
    return { current: true, detail: `DWH schema ${DWH_SCHEMA_VERSION}` };
  } catch {
    return {
      current: false,
      detail: `DWH schema ${DWH_SCHEMA_VERSION} missing or incompatible`,
    };
  }
}

const defaultDependencies: StandalonePreflightDependencies = {
  accessPath: access,
  probeOltp: async () => {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
  },
  probeDwh: async () => {
    const pool = await getDwhPool();
    await pool.request().query("SELECT 1 AS ok");
  },
  probeOltpSchema: defaultOltpSchemaProbe,
  probeDwhSchema: defaultDwhSchemaProbe,
};

async function dependencyCheck(
  checks: StandalonePreflightCheck[],
  id: string,
  action: () => Promise<void>,
  success: string,
  failure: string,
): Promise<void> {
  try {
    await action();
    checks.push({ id, status: "pass", detail: success });
  } catch {
    checks.push({ id, status: "fail", detail: failure });
  }
}

export async function runStandalonePreflight(
  env: NodeJS.ProcessEnv = process.env,
  phase: StandalonePreflightPhase = "runtime",
  dependencies: StandalonePreflightDependencies = defaultDependencies,
): Promise<StandalonePreflightReport> {
  const checks = validateStandaloneConfiguration(env);
  const paths = readStandalonePaths(env);
  await dependencyCheck(
    checks,
    "filesystem.data",
    () =>
      dependencies.accessPath(
        paths.dataRoot,
        fsConstants.R_OK | fsConstants.W_OK,
      ),
    "data directory is readable and writable",
    "data directory is unavailable or not writable",
  );
  await dependencyCheck(
    checks,
    "filesystem.backup",
    () =>
      dependencies.accessPath(
        paths.backupRoot,
        fsConstants.R_OK | fsConstants.W_OK,
      ),
    "backup directory is readable and writable",
    "backup directory is unavailable or not writable",
  );
  await dependencyCheck(
    checks,
    "filesystem.logs",
    () =>
      dependencies.accessPath(
        paths.logRoot,
        fsConstants.R_OK | fsConstants.W_OK,
      ),
    "log directory is readable and writable",
    "log directory is unavailable or not writable",
  );
  await dependencyCheck(
    checks,
    "filesystem.web",
    () => dependencies.accessPath(paths.webRoot, fsConstants.R_OK),
    "Web artifact directory is readable",
    "Web artifact directory is unavailable",
  );
  await dependencyCheck(
    checks,
    "sql.oltp-connectivity",
    dependencies.probeOltp,
    "OLTP connection succeeded",
    "OLTP connection failed",
  );
  await dependencyCheck(
    checks,
    "sql.dwh-connectivity",
    dependencies.probeDwh,
    "DWH connection succeeded",
    "DWH connection failed",
  );

  for (const [id, probe] of [
    ["schema.oltp", dependencies.probeOltpSchema],
    ["schema.dwh", dependencies.probeDwhSchema],
  ] as const) {
    try {
      const result = await probe();
      checks.push({
        id,
        status: result.current
          ? "pass"
          : phase === "install"
            ? "warning"
            : "fail",
        detail: result.detail,
      });
    } catch {
      checks.push({
        id,
        status: phase === "install" ? "warning" : "fail",
        detail: "schema status unavailable",
      });
    }
  }

  return {
    contractVersion: STANDALONE_CONTRACT_VERSION,
    phase,
    ok: checks.every((check) => check.status !== "fail"),
    checks,
  };
}

export function formatStandalonePreflightReport(
  report: StandalonePreflightReport,
): string {
  const lines = report.checks.map(
    (check) => `[${check.status.toUpperCase()}] ${check.id}: ${check.detail}`,
  );
  lines.push(
    `standalone-preflight: ${report.ok ? "PASS" : "FAIL"} phase=${report.phase}`,
  );
  return lines.join("\n");
}
