import "dotenv/config";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import sql from "mssql";
import { getPool, closePool } from "./connection.js";
import { assertTargetSafe } from "../modules/deployment/targetGuard.js";
import { readEnvironmentClass } from "../modules/deployment/environmentIdentity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_CANDIDATES = [
  // Flattened standalone package: api/migrations.
  join(__dirname, "migrations"),
  // Workspace deployment bundle: api/dist-deploy/migrations.
  join(__dirname, "..", "migrations"),
  // TypeScript source tree: apps/api/migrations.
  join(__dirname, "..", "..", "migrations"),
];
const MIGRATIONS_DIR =
  process.env.NUTRICLINICA_MIGRATIONS_DIR?.trim() ||
  MIGRATIONS_CANDIDATES.find((candidate) => existsSync(candidate)) ||
  MIGRATIONS_CANDIDATES[0];

export interface MigrationFile {
  filename: string;
  content: string;
  checksum: string;
}

export function checksumOf(content: string): string {
  return createHash("sha256")
    .update(content.replace(/\r\n/g, "\n"), "utf8")
    .digest("hex");
}

export function shouldSkipStandaloneLegacyMigration(
  filename: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.STANDALONE_MODE?.trim().toLowerCase() === "true" &&
    filename === "031-dwh.sql"
  );
}

export function splitSqlBatches(content: string): string[] {
  const batches: string[] = [];
  const lines = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (/^\s*GO\s*(?:--.*)?$/i.test(line)) {
      if (hasExecutableSql(current.join("\n"))) {
        batches.push(current.join("\n").trim());
      }
      current = [];
      continue;
    }
    current.push(line);
  }

  if (hasExecutableSql(current.join("\n"))) {
    batches.push(current.join("\n").trim());
  }

  return batches;
}

function hasExecutableSql(batch: string): boolean {
  const withoutBlockComments = batch.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlockComments.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("--");
  });
}

export async function listMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((f) => f.endsWith(".sql")).sort();
  return Promise.all(
    sqlFiles.map(async (filename) => {
      const content = await readFile(join(MIGRATIONS_DIR, filename), "utf8");
      return { filename, content, checksum: checksumOf(content) };
    }),
  );
}

export interface ApplyMigrationsOptions {
  force?: boolean;
  onProgress?: (msg: string) => void;
}

export interface MigrationResult {
  filename: string;
  status: "applied" | "skipped" | "reapplied" | "error";
  error?: string;
}

export async function applyMigrations(
  options: ApplyMigrationsOptions = {},
): Promise<MigrationResult[]> {
  assertTargetSafe("migrate", process.env);
  const environmentClass = readEnvironmentClass(process.env);
  const detailedErrors =
    environmentClass === "LOCAL" || environmentClass === "TEST";
  if (
    options.force &&
    (environmentClass === "STAGING" || environmentClass === "PRODUCTION")
  ) {
    throw new Error(
      "--force esta prohibido en STAGING/PRODUCTION; publicar una migracion forward-repair",
    );
  }
  const log = options.onProgress ?? ((m) => console.log(m));
  const pool = await getPool();
  const migrations = await listMigrations();
  const results: MigrationResult[] = [];

  const ensured = await ensureMigrationsTable(pool);
  log(ensured);

  const applied = await fetchAppliedMigrations(pool);
  const appliedMap = new Map(applied.map((r) => [r.filename, r.checksum]));

  for (const m of migrations) {
    const existing = appliedMap.get(m.filename);
    if (existing === m.checksum) {
      log(`skip  ${m.filename} (ya aplicada)`);
      results.push({ filename: m.filename, status: "skipped" });
      continue;
    }
    if (existing && !options.force) {
      const msg = `migration ${m.filename} ya aplicada con checksum distinto. --force solo se permite en LOCAL/TEST; publicar una migracion forward-repair para targets remotos.`;
      log(`error ${msg}`);
      results.push({ filename: m.filename, status: "error", error: msg });
      break;
    }

    log(`apply ${m.filename}`);
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
      await transaction.begin();
      transactionStarted = true;
      const standaloneLegacyDwh = shouldSkipStandaloneLegacyMigration(
        m.filename,
      );
      if (standaloneLegacyDwh) {
        log(
          `skip  ${m.filename} SQL en standalone; el schema DWH usa su propia base`,
        );
      }
      // Split only on SQL Server batch separators so IF/BEGIN/END blocks
      // remain intact even when they contain semicolon-terminated statements.
      const batches = standaloneLegacyDwh ? [] : splitSqlBatches(m.content);
      for (let i = 0; i < batches.length; i++) {
        const stmt = batches[i]!;
        try {
          await new sql.Request(transaction).query(stmt);
        } catch (stmtErr) {
          const e = stmtErr as Error & {
            precedingErrors?: Array<{ message: string }>;
          };
          log(
            `  batch ${i} fail (len=${stmt.length}): ${detailedErrors ? e.message : e.name}`,
          );
          if (detailedErrors && e.precedingErrors) {
            for (const pe of e.precedingErrors) log(`    pre: ${pe.message}`);
          }
          throw e;
        }
      }
      await new sql.Request(transaction)
        .input("filename", sql.NVarChar(255), m.filename)
        .input("checksum", sql.NVarChar(64), m.checksum)
        .query(
          `IF EXISTS (SELECT 1 FROM dbo.schema_migrations WHERE filename = @filename)
             UPDATE dbo.schema_migrations SET applied_at = SYSUTCDATETIME(), checksum = @checksum WHERE filename = @filename
            ELSE
             INSERT INTO dbo.schema_migrations (filename, checksum) VALUES (@filename, @checksum)`,
        );
      await transaction.commit();
      transactionStarted = false;
      results.push({
        filename: m.filename,
        status: existing ? "reapplied" : "applied",
      });
      log(`ok    ${m.filename}`);
    } catch (err) {
      if (transactionStarted) {
        try {
          await transaction.rollback();
        } catch {
          log(`  rollback ${m.filename} failed`);
        }
      }
      const msg =
        err instanceof Error
          ? detailedErrors
            ? err.message
            : err.name
          : "UnknownMigrationError";
      log(`fail  ${m.filename}: ${msg}`);
      results.push({ filename: m.filename, status: "error", error: msg });
      break;
    }
  }

  return results;
}

async function ensureMigrationsTable(
  pool: sql.ConnectionPool,
): Promise<string> {
  await pool.request().query(
    `IF OBJECT_ID('dbo.schema_migrations', 'U') IS NULL
         CREATE TABLE dbo.schema_migrations (
           filename NVARCHAR(255) NOT NULL PRIMARY KEY,
           applied_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
           checksum NVARCHAR(64) NOT NULL
         )`,
  );
  return "tabla schema_migrations lista";
}

interface AppliedRow {
  filename: string;
  checksum: string;
}

async function fetchAppliedMigrations(
  pool: sql.ConnectionPool,
): Promise<AppliedRow[]> {
  const result = await pool
    .request()
    .query<AppliedRow>("SELECT filename, checksum FROM dbo.schema_migrations");
  return result.recordset;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  console.log("=== nutriclinica: migraciones SQL Server ===");
  try {
    // Build 09.5A §6, §26-27: fail-closed contra PRODUCTION/UNKNOWN.
    assertTargetSafe("migrate", process.env);
    const results = await applyMigrations({ force });
    const errors = results.filter((r) => r.status === "error");
    console.log(
      `\nresultado: ${results.length} archivos, ${errors.length} errores`,
    );
    if (errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    const environmentClass = readEnvironmentClass(process.env);
    console.error(
      "error fatal:",
      environmentClass === "LOCAL" || environmentClass === "TEST"
        ? err instanceof Error
          ? err.message
          : String(err)
        : err instanceof Error
          ? err.name
          : "UnknownMigrationError",
    );
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const invokedDirectly = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invokedDirectly) {
  void main();
}
