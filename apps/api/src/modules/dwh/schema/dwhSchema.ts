import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";

export const DWH_SCHEMA_VERSION = "dwh-08-002";

const SCHEMA_FILE =
  process.env.NUTRICLINICA_DWH_SCHEMA_FILE?.trim() ||
  join(dirname(fileURLToPath(import.meta.url)), "dwh-schema.sql");

export function dwhSchemaChecksumOf(raw: string): string {
  const canonical = raw.replace(/\r\n/g, "\n").replace(/\n$/, "");
  return createHash("sha256").update(canonical).digest("hex");
}

export function dwhSchemaChecksum(): string {
  return dwhSchemaChecksumOf(readFileSync(SCHEMA_FILE, "utf8"));
}

export function dwhDdl(): string {
  return readFileSync(SCHEMA_FILE, "utf8");
}

/** Verifica que el workload one-shot aplico exactamente el schema esperado. */
export async function assertDwhSchemaCompatible(
  pool: sql.ConnectionPool,
): Promise<void> {
  const result = await pool
    .request()
    .input("schemaVersion", sql.NVarChar(40), DWH_SCHEMA_VERSION)
    .query<{
      checksum: string;
    }>("SELECT checksum FROM dwh_schema_version WHERE schema_version = @schemaVersion");
  const recorded = result.recordset[0]?.checksum;
  if (!recorded || recorded !== dwhSchemaChecksum()) {
    throw new Error(
      `DWH schema ${DWH_SCHEMA_VERSION} ausente o incompatible; ejecutar el workload one-shot dwh-schema antes de ETL`,
    );
  }
}

/** Aplica el DDL (idempotente) y registra schemaVersion+checksum. */
export async function applyDwhSchema(pool: sql.ConnectionPool): Promise<void> {
  const checksum = dwhSchemaChecksum();
  let existingChecksum: string | null = null;
  try {
    const existing = await pool
      .request()
      .input("schemaVersion", sql.NVarChar(40), DWH_SCHEMA_VERSION)
      .query<{
        checksum: string;
      }>("SELECT checksum FROM dwh_schema_version WHERE schema_version = @schemaVersion");
    if (existing.recordset.length > 0)
      existingChecksum = existing.recordset[0]!.checksum;
  } catch (error) {
    const sqlError = error as { number?: number };
    if (sqlError.number !== 208) throw error;
    // SQL Server 208: la tabla de versionado aun no existe.
  }
  if (existingChecksum !== null && existingChecksum !== checksum) {
    throw new Error(
      `DWH schema drift: ${DWH_SCHEMA_VERSION} registrado con checksum distinto. Requiere version nueva de schema, no re-aplicar.`,
    );
  }

  const batches = dwhDdl().split(/^\s*GO\s*$/im);
  for (const batch of batches) {
    const trimmed = batch.trim();
    if (trimmed.length === 0) continue;
    await pool.request().batch(trimmed);
  }

  if (existingChecksum === null) {
    await pool
      .request()
      .input("schemaVersion", sql.NVarChar(40), DWH_SCHEMA_VERSION)
      .input("checksum", sql.NVarChar(64), checksum)
      .query(
        "INSERT INTO dwh_schema_version (schema_version, checksum) VALUES (@schemaVersion, @checksum)",
      );
  }
}

export async function dwhSchemaStatus(pool: sql.ConnectionPool): Promise<{
  schemaVersion: string | null;
  appliedAt: string | null;
  checksum: string | null;
}> {
  const result = await pool.request().query<{
    schema_version: string;
    applied_at: Date;
    checksum: string;
  }>("SELECT TOP 1 schema_version, applied_at, checksum FROM dwh_schema_version ORDER BY applied_at DESC");
  if (result.recordset.length === 0)
    return { schemaVersion: null, appliedAt: null, checksum: null };
  return {
    schemaVersion: result.recordset[0]!.schema_version,
    appliedAt: result.recordset[0]!.applied_at.toISOString(),
    checksum: result.recordset[0]!.checksum,
  };
}
