import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";

export const DWH_PREVIOUS_SCHEMA_VERSION = "dwh-08-002";
export const DWH_SCHEMA_VERSION = "dwh-08-003";

const PREVIOUS_SCHEMA_FILE =
  process.env.NUTRICLINICA_DWH_SCHEMA_FILE?.trim() ||
  join(dirname(fileURLToPath(import.meta.url)), "dwh-schema.sql");
const UPGRADE_SCHEMA_FILE =
  process.env.NUTRICLINICA_DWH_UPGRADE_FILE?.trim() ||
  join(dirname(fileURLToPath(import.meta.url)), "dwh-upgrade-08-003.sql");

export function dwhSchemaChecksumOf(raw: string): string {
  const canonical = raw.replace(/\r\n/g, "\n").replace(/\n$/, "");
  return createHash("sha256").update(canonical).digest("hex");
}

export function dwhSchemaChecksum(): string {
  return dwhSchemaChecksumOf(
    `${DWH_PREVIOUS_SCHEMA_VERSION}:${dwhPreviousSchemaChecksum()}\n${DWH_SCHEMA_VERSION}:${dwhUpgradeChecksum()}`,
  );
}

export function dwhDdl(): string {
  return readFileSync(PREVIOUS_SCHEMA_FILE, "utf8");
}

export function dwhPreviousSchemaChecksum(): string {
  return dwhSchemaChecksumOf(dwhDdl());
}

export function dwhUpgradeDdl(): string {
  return readFileSync(UPGRADE_SCHEMA_FILE, "utf8");
}

export function dwhUpgradeChecksum(): string {
  return dwhSchemaChecksumOf(dwhUpgradeDdl());
}

async function recordedChecksum(
  pool: sql.ConnectionPool,
  schemaVersion: string,
): Promise<string | null> {
  try {
    const result = await pool
      .request()
      .input("schemaVersion", sql.NVarChar(40), schemaVersion)
      .query<{
        checksum: string;
      }>("SELECT checksum FROM dwh_schema_version WHERE schema_version = @schemaVersion");
    return result.recordset[0]?.checksum ?? null;
  } catch (error) {
    const sqlError = error as { number?: number };
    if (sqlError.number === 208) return null;
    throw error;
  }
}

async function applyBatches(
  pool: sql.ConnectionPool,
  ddl: string,
): Promise<void> {
  const batches = ddl.split(/^\s*GO\s*$/im);
  for (const batch of batches) {
    const trimmed = batch.trim();
    if (trimmed.length > 0) await pool.request().batch(trimmed);
  }
}

async function recordSchemaVersion(
  pool: sql.ConnectionPool,
  schemaVersion: string,
  checksum: string,
): Promise<void> {
  await pool
    .request()
    .input("schemaVersion", sql.NVarChar(40), schemaVersion)
    .input("checksum", sql.NVarChar(64), checksum)
    .query(
      "INSERT INTO dwh_schema_version (schema_version, checksum) VALUES (@schemaVersion, @checksum)",
    );
}

/** Verifica que el workload one-shot aplico exactamente el schema esperado. */
export async function assertDwhSchemaCompatible(
  pool: sql.ConnectionPool,
): Promise<void> {
  const previous = await recordedChecksum(pool, DWH_PREVIOUS_SCHEMA_VERSION);
  const current = await recordedChecksum(pool, DWH_SCHEMA_VERSION);
  if (
    previous !== dwhPreviousSchemaChecksum() ||
    current !== dwhSchemaChecksum()
  ) {
    throw new Error(
      `DWH schema ${DWH_SCHEMA_VERSION} ausente o incompatible; ejecutar el workload one-shot dwh-schema antes de ETL`,
    );
  }
}

/** Aplica la cadena base + upgrades sin reescribir artefactos historicos. */
export async function applyDwhSchema(pool: sql.ConnectionPool): Promise<void> {
  const previousChecksum = dwhPreviousSchemaChecksum();
  const recordedPrevious = await recordedChecksum(
    pool,
    DWH_PREVIOUS_SCHEMA_VERSION,
  );
  if (recordedPrevious && recordedPrevious !== previousChecksum) {
    throw new Error(
      `DWH schema drift: ${DWH_PREVIOUS_SCHEMA_VERSION} registrado con checksum distinto.`,
    );
  }
  if (!recordedPrevious) {
    await applyBatches(pool, dwhDdl());
    await recordSchemaVersion(
      pool,
      DWH_PREVIOUS_SCHEMA_VERSION,
      previousChecksum,
    );
  }

  const checksum = dwhSchemaChecksum();
  const recordedCurrent = await recordedChecksum(pool, DWH_SCHEMA_VERSION);
  if (recordedCurrent && recordedCurrent !== checksum) {
    throw new Error(
      `DWH schema drift: ${DWH_SCHEMA_VERSION} registrado con checksum distinto. Requiere version nueva de schema, no re-aplicar.`,
    );
  }
  if (!recordedCurrent) {
    await applyBatches(pool, dwhUpgradeDdl());
    await recordSchemaVersion(pool, DWH_SCHEMA_VERSION, checksum);
  }
}

export async function dwhSchemaStatus(pool: sql.ConnectionPool): Promise<{
  schemaVersion: string | null;
  appliedAt: string | null;
  checksum: string | null;
}> {
  const result = await pool
    .request()
    .input("schemaVersion", sql.NVarChar(40), DWH_SCHEMA_VERSION)
    .query<{
      schema_version: string;
      applied_at: Date;
      checksum: string;
    }>(
      "SELECT schema_version, applied_at, checksum FROM dwh_schema_version WHERE schema_version = @schemaVersion",
    );
  if (result.recordset.length === 0)
    return { schemaVersion: null, appliedAt: null, checksum: null };
  return {
    schemaVersion: result.recordset[0]!.schema_version,
    appliedAt: result.recordset[0]!.applied_at.toISOString(),
    checksum: result.recordset[0]!.checksum,
  };
}
