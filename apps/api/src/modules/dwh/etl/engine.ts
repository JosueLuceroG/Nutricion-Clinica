import { randomBytes } from "node:crypto";
import sql from "mssql";
import { getPool } from "../../../db/connection.js";
import { getDwhPool } from "../dwhConnection.js";
import { readDwhConfig } from "../config.js";
import {
  assertDwhSchemaCompatible,
  DWH_SCHEMA_VERSION,
} from "../schema/dwhSchema.js";
import { populateDimDate } from "./dimDate.js";
import {
  DWH_CODE_VERSION,
  DWH_TRANSFORMATION_VERSION,
  type EtlCounts,
  type EtlReject,
  type EtlRunResult,
} from "./types.js";
import { emitTelemetry } from "../../observability/telemetryService.js";

/**
 * Motor ETL idempotente y versionado.
 * Reglas:
 *  - watermark sobre updated_at del OLTP; avanza SOLO tras éxito.
 *  - MERGE por clave natural => segunda ejecución sin duplicados.
 *  - filas malformadas => dwh_rejects (nunca desaparecen en silencio).
 *  - reconciliación por pipeline: source = loaded + filtered + rejected.
 *  - lock por pipeline para evitar solapamiento; crash recuperable.
 *  - inyección de fallo (DWH_FAIL_INJECTION) para tests de recuperación.
 */

export interface EtlContext {
  oltp: sql.ConnectionPool;
  dwh: sql.ConnectionPool;
  loadRunId: number;
  transformationVersion: string;
  schemaVersion: string;
  codeVersion: string;
  sourceEnvironment: string;
  watermark: Date | null;
}

export interface EtlExtracted {
  rows: Array<Record<string, unknown>>;
  expected: number;
  rejects: EtlReject[];
  maxSourceUpdatedAt?: Date;
  metadata?: unknown;
}

export interface PipelineSpec {
  pipelineId: string;
  extract(ctx: EtlContext): Promise<EtlExtracted>;
  load(
    ctx: EtlContext,
    rows: Array<Record<string, unknown>>,
    metadata?: unknown,
  ): Promise<{ inserted: number; updated: number }>;
  filtered(): number;
}

function watermarkParam(value: Date | null): Date {
  return value ?? new Date("2000-01-01T00:00:00Z");
}

function latestSourceUpdate(
  rows: ReadonlyArray<{ updated_at: Date }>,
): Date | undefined {
  let latest: Date | undefined;
  for (const row of rows) {
    if (!latest || row.updated_at.getTime() > latest.getTime()) {
      latest = row.updated_at;
    }
  }
  return latest;
}

async function readWatermark(
  dwh: sql.ConnectionPool,
  pipelineId: string,
): Promise<Date | null> {
  const result = await dwh
    .request()
    .input("pipelineId", sql.NVarChar(60), pipelineId)
    .query<{
      watermark_at: Date;
    }>("SELECT watermark_at FROM dwh_watermarks WHERE pipeline_id = @pipelineId");
  return result.recordset[0]?.watermark_at ?? null;
}

async function acquireLock(
  dwh: sql.ConnectionPool,
  pipelineId: string,
  ttlMinutes = 60,
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await dwh
    .request()
    .input("pipelineId", sql.NVarChar(60), pipelineId)
    .input("token", sql.NVarChar(64), token)
    .input("ttlMinutes", sql.Int, ttlMinutes).query(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      BEGIN TRY
        IF EXISTS (
          SELECT 1
            FROM dwh_pipeline_locks WITH (UPDLOCK, HOLDLOCK)
           WHERE pipeline_id = @pipelineId
             AND lock_expires_at > SYSUTCDATETIME()
        )
          THROW 51000, 'pipeline lock active', 1;

        IF EXISTS (
          SELECT 1 FROM dwh_pipeline_locks WITH (UPDLOCK, HOLDLOCK)
           WHERE pipeline_id = @pipelineId
        )
          UPDATE dwh_pipeline_locks
             SET lock_token = @token,
                  lock_expires_at = DATEADD(MINUTE, @ttlMinutes, SYSUTCDATETIME()),
                  locked_at = SYSUTCDATETIME()
           WHERE pipeline_id = @pipelineId;
        ELSE
          INSERT INTO dwh_pipeline_locks (pipeline_id, lock_token, lock_expires_at)
          VALUES (@pipelineId, @token, DATEADD(MINUTE, @ttlMinutes, SYSUTCDATETIME()));

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH;
    `);
  return token;
}

async function releaseLock(
  dwh: sql.ConnectionPool,
  pipelineId: string,
  token: string,
): Promise<void> {
  await dwh
    .request()
    .input("pipelineId", sql.NVarChar(60), pipelineId)
    .input("token", sql.NVarChar(64), token)
    .query(
      "DELETE FROM dwh_pipeline_locks WHERE pipeline_id = @pipelineId AND lock_token = @token",
    );
}

async function startLoadRun(
  ctx: EtlContext,
  pipelineId: string,
): Promise<number> {
  const result = await ctx.dwh
    .request()
    .input("pipelineId", sql.NVarChar(60), pipelineId)
    .input("status", sql.NVarChar(20), "running")
    .input("sourceEnvironment", sql.NVarChar(60), ctx.sourceEnvironment)
    .input("sourceWatermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
    .input("targetSchemaVersion", sql.NVarChar(40), ctx.schemaVersion)
    .input("transformationVersion", sql.NVarChar(40), ctx.transformationVersion)
    .input("codeVersion", sql.NVarChar(40), ctx.codeVersion).query<{
    load_run_id: string;
  }>(`
      INSERT INTO dwh_load_runs (pipeline_id, status, source_environment, source_watermark, target_schema_version, transformation_version, code_version)
      OUTPUT INSERTED.load_run_id
      VALUES (@pipelineId, @status, @sourceEnvironment, @sourceWatermark, @targetSchemaVersion, @transformationVersion, @codeVersion)
    `);
  return Number(result.recordset[0]!.load_run_id);
}

async function completeLoadRun(
  ctx: EtlContext,
  counts: EtlCounts,
  status: "succeeded" | "failed",
  error: string | null,
): Promise<void> {
  await ctx.dwh
    .request()
    .input("loadRunId", sql.BigInt, ctx.loadRunId)
    .input("status", sql.NVarChar(20), status)
    .input("extracted", sql.Int, counts.extracted)
    .input("inserted", sql.Int, counts.inserted)
    .input("updated", sql.Int, counts.updated)
    .input("rejected", sql.Int, counts.rejected)
    .input("errorCount", sql.Int, status === "failed" ? 1 : 0)
    .input("errorDetail", sql.NVarChar(sql.MAX), error).query(`
      UPDATE dwh_load_runs
      SET status = @status, completed_at = SYSUTCDATETIME(), rows_extracted = @extracted,
          rows_inserted = @inserted, rows_updated = @updated, rows_rejected = @rejected,
          error_count = @errorCount, error_detail = @errorDetail
      WHERE load_run_id = @loadRunId
    `);
}

async function insertRejects(
  ctx: EtlContext,
  pipelineId: string,
  rejects: EtlReject[],
): Promise<void> {
  for (const r of rejects) {
    await ctx.dwh
      .request()
      .input("loadRunId", sql.BigInt, ctx.loadRunId)
      .input("pipelineId", sql.NVarChar(60), pipelineId)
      .input("entity", sql.NVarChar(60), r.entity)
      .input("sourceReference", sql.NVarChar(120), r.sourceReference)
      .input("reasonCode", sql.NVarChar(40), r.reasonCode)
      .input("reasonDetail", sql.NVarChar(500), r.reasonDetail ?? null)
      .query(
        "INSERT INTO dwh_rejects (load_run_id, pipeline_id, entity, source_reference, reason_code, reason_detail) VALUES (@loadRunId, @pipelineId, @entity, @sourceReference, @reasonCode, @reasonDetail)",
      );
  }
}

async function recordReconciliation(
  ctx: EtlContext,
  pipelineId: string,
  factTable: string,
  expected: number,
  loaded: number,
  filtered: number,
  rejected: number,
): Promise<number> {
  const unexpectedLoss = Math.max(0, expected - loaded - filtered - rejected);
  await ctx.dwh
    .request()
    .input("loadRunId", sql.BigInt, ctx.loadRunId)
    .input("pipelineId", sql.NVarChar(60), pipelineId)
    .input("factTable", sql.NVarChar(60), factTable)
    .input("expected", sql.Int, expected)
    .input("loaded", sql.Int, loaded)
    .input("filtered", sql.Int, filtered)
    .input("rejected", sql.Int, rejected)
    .input("loss", sql.Int, unexpectedLoss).query(`
      INSERT INTO dwh_reconciliation (load_run_id, pipeline_id, fact_table, source_expected, loaded, filtered, rejected, unexpected_loss)
      VALUES (@loadRunId, @pipelineId, @factTable, @expected, @loaded, @filtered, @rejected, @loss)
    `);
  return unexpectedLoss;
}

export async function runPipeline(
  spec: PipelineSpec,
  opts: { failInjectionPipeline?: string | null } = {},
): Promise<EtlRunResult> {
  const startedAt = performance.now();
  const oltp = await getPool();
  const dwh = await getDwhPool();
  const sourceEnvironment = (process.env.DB_NAME ?? "nutriclinica").trim();

  const watermark = await readWatermark(dwh, spec.pipelineId);
  const lockToken = await acquireLock(dwh, spec.pipelineId);

  const ctx: EtlContext = {
    oltp,
    dwh,
    loadRunId: 0,
    transformationVersion: DWH_TRANSFORMATION_VERSION,
    schemaVersion: DWH_SCHEMA_VERSION,
    codeVersion: DWH_CODE_VERSION,
    sourceEnvironment,
    watermark,
  };

  const counts: EtlCounts = {
    extracted: 0,
    inserted: 0,
    updated: 0,
    rejected: 0,
  };
  let reconciliation = {
    sourceExpected: 0,
    loaded: 0,
    filtered: 0,
    rejected: 0,
    unexpectedLoss: 0,
  };
  try {
    ctx.loadRunId = await startLoadRun(ctx, spec.pipelineId);

    const extracted = await spec.extract(ctx);
    counts.extracted = extracted.rows.length;

    if (opts.failInjectionPipeline === spec.pipelineId) {
      throw new Error(
        `INYECTADO: inyección de fallo (${spec.pipelineId}) tras extracción`,
      );
    }

    const { inserted, updated } = await spec.load(
      ctx,
      extracted.rows,
      extracted.metadata,
    );
    counts.inserted = inserted;
    counts.updated = updated;
    counts.rejected = extracted.rejects.length;
    await insertRejects(ctx, spec.pipelineId, extracted.rejects);

    const newWatermark =
      extracted.maxSourceUpdatedAt ??
      (extracted.rows.length > 0
        ? new Date(
            Math.max(
              ...extracted.rows.map((r) => (r.updatedAt as Date).getTime()),
            ),
          )
        : watermarkParam(watermark));
    const filtered = spec.filtered();
    const loaded = inserted + updated;
    const unexpectedLoss = await recordReconciliation(
      ctx,
      spec.pipelineId,
      spec.pipelineId,
      extracted.expected,
      loaded,
      filtered,
      extracted.rejects.length,
    );
    reconciliation = {
      sourceExpected: extracted.expected,
      loaded,
      filtered,
      rejected: extracted.rejects.length,
      unexpectedLoss,
    };
    const accounted = loaded + filtered + extracted.rejects.length;
    if (accounted !== extracted.expected) {
      throw new Error(
        `DWH_RECONCILIATION_FAILED: ${spec.pipelineId} expected ${extracted.expected} source rows, accounted ${accounted}`,
      );
    }
    await completeLoadRun(ctx, counts, "succeeded", null);
    await dwh
      .request()
      .input("pipelineId", sql.NVarChar(60), spec.pipelineId)
      .input("watermark", sql.DateTime2(3), newWatermark).query(`
        IF EXISTS (SELECT 1 FROM dwh_watermarks WHERE pipeline_id = @pipelineId)
          UPDATE dwh_watermarks SET watermark_at = @watermark, updated_at = SYSUTCDATETIME() WHERE pipeline_id = @pipelineId
        ELSE
          INSERT INTO dwh_watermarks (pipeline_id, watermark_at) VALUES (@pipelineId, @watermark)
      `);

    emitTelemetry({
      eventType: "dwh.etl",
      executionId: `etl-${ctx.loadRunId}`,
      loadRunId: ctx.loadRunId,
      capability: "dwh",
      status: "succeeded",
      durationMs: Math.round(performance.now() - startedAt),
      counts: {
        extracted: counts.extracted,
        inserted: counts.inserted,
        updated: counts.updated,
        rejected: counts.rejected,
        unexpectedLoss,
      },
    });

    return {
      loadRunId: ctx.loadRunId,
      pipelineId: spec.pipelineId,
      status: "succeeded",
      transformationVersion: ctx.transformationVersion,
      sourceWatermark: newWatermark,
      counts,
      reconciliation,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (ctx.loadRunId > 0) {
      await completeLoadRun(ctx, counts, "failed", message).catch(
        () => undefined,
      );
    }
    emitTelemetry({
      eventType: "dwh.etl",
      executionId: `etl-${ctx.loadRunId || 0}`,
      loadRunId: ctx.loadRunId || 0,
      capability: "dwh",
      status: "failed",
      reasonCode: message.startsWith("INYECTADO") ? "INYECTADO" : "ETL_FAILED",
      counts: {
        extracted: counts.extracted,
        inserted: counts.inserted,
        updated: counts.updated,
        rejected: counts.rejected,
        unexpectedLoss: reconciliation.unexpectedLoss,
      },
    });
    return {
      loadRunId: ctx.loadRunId,
      pipelineId: spec.pipelineId,
      status: "failed",
      transformationVersion: ctx.transformationVersion,
      sourceWatermark: null,
      counts,
      reconciliation,
      error: message,
    };
  } finally {
    await releaseLock(dwh, spec.pipelineId, lockToken).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Helpers de dimensiones
// ---------------------------------------------------------------------------

function guidHex(buf: Buffer): string {
  return buf.toString("hex");
}

function toGuidParam(value: Buffer | string): string {
  const hex = Buffer.isBuffer(value)
    ? value.toString("hex")
    : value.replace(/-/g, "");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function buildSucursalMap(ctx: EtlContext): Promise<Map<string, number>> {
  const result = await ctx.dwh.request().query<{
    sucursal_natural_id: Buffer;
    sucursal_key: number;
  }>("SELECT sucursal_natural_id, sucursal_key FROM dim_sucursal WHERE is_current = 1");
  return new Map(
    result.recordset.map((r) => [
      guidHex(r.sucursal_natural_id),
      r.sucursal_key,
    ]),
  );
}

async function buildProfessionalMap(
  ctx: EtlContext,
): Promise<Map<string, number>> {
  const result = await ctx.dwh.request().query<{
    professional_natural_id: Buffer;
    professional_key: number;
  }>("SELECT professional_natural_id, professional_key FROM dim_professional WHERE is_current = 1");
  return new Map(
    result.recordset.map((r) => [
      guidHex(r.professional_natural_id),
      r.professional_key,
    ]),
  );
}

async function buildPatientMap(ctx: EtlContext): Promise<Map<string, number>> {
  const result = await ctx.dwh.request().query<{
    patient_natural_id: Buffer;
    patient_key: number;
  }>("SELECT patient_natural_id, patient_key FROM dim_patient");
  return new Map(
    result.recordset.map((r) => [guidHex(r.patient_natural_id), r.patient_key]),
  );
}

export function dateKeyFromDate(d: Date | null): number | null {
  if (!d) return null;
  const utc = new Date(d);
  return (
    utc.getUTCFullYear() * 10000 +
    (utc.getUTCMonth() + 1) * 100 +
    utc.getUTCDate()
  );
}

function dateKeySql(d: Date | null): string {
  const key = dateKeyFromDate(d);
  return key === null ? "NULL" : String(key);
}

function numSql(v: number | null | undefined): string {
  return v === null || v === undefined ? "NULL" : String(v);
}

function strSql(v: string | null | undefined): string {
  return v === null || v === undefined ? "NULL" : `N'${v.replace(/'/g, "''")}'`;
}

function binSql(buf: Buffer | string): string {
  const hex = Buffer.isBuffer(buf)
    ? buf.toString("hex")
    : buf.replace(/-/g, "").toLowerCase();
  const dashed = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return `CONVERT(uniqueidentifier, N'${dashed}')`;
}

type BatchRunner = (
  statement: string,
) => Promise<{ recordset?: Array<Record<string, unknown>> }>;

async function loadFactsWithMerge(
  ctx: EtlContext,
  table: string,
  columns: string[],
  valuesSql: string,
  keyColumns: string[] = [columns[0]!],
  runBatch: BatchRunner = (statement) => ctx.dwh.request().batch(statement),
): Promise<{ inserted: number; updated: number }> {
  const result = await runBatch(`
    MERGE ${table} WITH (HOLDLOCK) AS t
    USING (VALUES ${valuesSql}) AS s(${columns.join(", ")})
    ON ${keyColumns.map((column) => `t.${column} = s.${column}`).join(" AND ")}
    WHEN MATCHED THEN UPDATE SET ${columns
      .filter((column) => !keyColumns.includes(column))
      .map((c) => `t.${c} = s.${c}`)
      .join(", ")}
    WHEN NOT MATCHED THEN INSERT (${columns.join(", ")}) VALUES (${columns.map((c) => `s.${c}`).join(", ")})
    OUTPUT $action AS act;
  `);
  const actions = (result.recordset ?? []) as Array<{ act: string }>;
  let inserted = 0;
  let updated = 0;
  for (const a of actions) {
    if (a.act === "INSERT") inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}

// ---------------------------------------------------------------------------
// Pipelines concretos
// ---------------------------------------------------------------------------

export const ALL_PIPELINE_IDS = [
  "dim_sucursal",
  "dim_professional",
  "dim_patient",
  "fact_consultation",
  "fact_anthropometry",
  "fact_lab",
  "fact_meal_plan",
  "fact_adherence",
] as const;

// ---- dim_sucursal (SCD2) ----
export const dimSucursalPipeline: PipelineSpec = {
  pipelineId: "dim_sucursal",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      nombre: string;
      activa: boolean;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT id, nombre, activa, deleted_at, updated_at
        FROM sucursales
        WHERE updated_at >= @watermark
      `);
    return {
      rows: result.recordset.map((r) => ({
        ...r,
        activa: r.deleted_at === null && Boolean(r.activa),
        updatedAt: r.updated_at,
      })),
      expected: result.recordset.length,
      rejects: [],
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    let inserted = 0;
    let updated = 0;
    const map = await buildSucursalMap(ctx);
    for (const raw of rows) {
      const row = raw as { id: Buffer; nombre: string; activa: boolean };
      const naturalId = guidHex(row.id);
      const existing = map.get(naturalId);
      if (existing !== undefined) {
        const current = await ctx.dwh
          .request()
          .input("key", sql.Int, existing)
          .query<{
            nombre: string;
            activa: boolean;
          }>("SELECT nombre, activa FROM dim_sucursal WHERE sucursal_key = @key");
        const cur = current.recordset[0]!;
        if (
          cur.nombre !== row.nombre ||
          Boolean(cur.activa) !== Boolean(row.activa)
        ) {
          await ctx.dwh
            .request()
            .input("naturalId", sql.UniqueIdentifier, toGuidParam(row.id))
            .input("nombre", sql.NVarChar(120), row.nombre)
            .input("activa", sql.Bit, row.activa).query(`
              SET XACT_ABORT ON;
              BEGIN TRANSACTION;
              BEGIN TRY
                UPDATE dim_sucursal
                   SET valid_to = CAST(SYSUTCDATETIME() AS DATE), is_current = 0
                 WHERE sucursal_natural_id = @naturalId AND is_current = 1;
                INSERT INTO dim_sucursal (sucursal_natural_id, nombre, activa, valid_from, is_current)
                VALUES (@naturalId, @nombre, @activa, CAST(SYSUTCDATETIME() AS DATE), 1);
                COMMIT TRANSACTION;
              END TRY
              BEGIN CATCH
                IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
                THROW;
              END CATCH;
            `);
          inserted += 1;
        } else {
          updated += 1;
        }
      } else {
        await ctx.dwh
          .request()
          .input("naturalId", sql.UniqueIdentifier, toGuidParam(row.id))
          .input("nombre", sql.NVarChar(120), row.nombre)
          .input("activa", sql.Bit, row.activa).query(`
            INSERT INTO dim_sucursal (sucursal_natural_id, nombre, activa, valid_from, is_current)
            VALUES (@naturalId, @nombre, @activa, CAST(SYSUTCDATETIME() AS DATE), 1)
          `);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

// ---- dim_professional (SCD2) ----
export const dimProfessionalPipeline: PipelineSpec = {
  pipelineId: "dim_professional",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      nombre_completo: string;
      cedula_profesional: string | null;
      rol: string;
      activo: boolean;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT id, nombre_completo, cedula_profesional, rol, activo, deleted_at, updated_at
        FROM profesionales
        WHERE updated_at >= @watermark
      `);
    return {
      rows: result.recordset.map((r) => ({
        ...r,
        activo: r.deleted_at === null && Boolean(r.activo),
        updatedAt: r.updated_at,
      })),
      expected: result.recordset.length,
      rejects: [],
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    let inserted = 0;
    let updated = 0;
    const map = await buildProfessionalMap(ctx);
    for (const raw of rows) {
      const row = raw as {
        id: Buffer;
        nombre_completo: string;
        cedula_profesional: string | null;
        rol: string;
        activo: boolean;
      };
      const naturalId = guidHex(row.id);
      const existing = map.get(naturalId);
      if (existing !== undefined) {
        const current = await ctx.dwh
          .request()
          .input("key", sql.Int, existing)
          .query<{
            nombre_completo: string;
            cedula_profesional: string | null;
            rol: string;
            activo: boolean;
          }>("SELECT nombre_completo, cedula_profesional, rol, activo FROM dim_professional WHERE professional_key = @key");
        const cur = current.recordset[0]!;
        if (
          cur.nombre_completo !== row.nombre_completo ||
          cur.cedula_profesional !== row.cedula_profesional ||
          cur.rol !== row.rol ||
          Boolean(cur.activo) !== Boolean(row.activo)
        ) {
          await ctx.dwh
            .request()
            .input("naturalId", sql.UniqueIdentifier, toGuidParam(row.id))
            .input("nombre", sql.NVarChar(160), row.nombre_completo)
            .input("cedula", sql.NVarChar(60), row.cedula_profesional ?? null)
            .input("rol", sql.NVarChar(30), row.rol)
            .input("activo", sql.Bit, row.activo).query(`
              SET XACT_ABORT ON;
              BEGIN TRANSACTION;
              BEGIN TRY
                UPDATE dim_professional
                   SET valid_to = CAST(SYSUTCDATETIME() AS DATE), is_current = 0
                 WHERE professional_natural_id = @naturalId AND is_current = 1;
                INSERT INTO dim_professional (professional_natural_id, nombre_completo, cedula_profesional, rol, activo, valid_from, is_current)
                VALUES (@naturalId, @nombre, @cedula, @rol, @activo, CAST(SYSUTCDATETIME() AS DATE), 1);
                COMMIT TRANSACTION;
              END TRY
              BEGIN CATCH
                IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
                THROW;
              END CATCH;
            `);
          inserted += 1;
        } else {
          updated += 1;
        }
      } else {
        await ctx.dwh
          .request()
          .input("naturalId", sql.UniqueIdentifier, toGuidParam(row.id))
          .input("nombre", sql.NVarChar(160), row.nombre_completo)
          .input("cedula", sql.NVarChar(60), row.cedula_profesional ?? null)
          .input("rol", sql.NVarChar(30), row.rol)
          .input("activo", sql.Bit, row.activo).query(`
            INSERT INTO dim_professional (professional_natural_id, nombre_completo, cedula_profesional, rol, activo, valid_from, is_current)
            VALUES (@naturalId, @nombre, @cedula, @rol, @activo, CAST(SYSUTCDATETIME() AS DATE), 1)
          `);
        inserted += 1;
      }
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

// ---- dim_patient (SCD1, privacidad) ----
export const dimPatientPipeline: PipelineSpec = {
  pipelineId: "dim_patient",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      sexo: string | null;
      fecha_nacimiento: Date | null;
      estado_expediente: string | null;
      record_status: string | null;
      updated_at: Date;
    }>(`
        SELECT id, sexo, fecha_nacimiento, estado_expediente, record_status, updated_at
        FROM pacientes
        WHERE updated_at >= @watermark
      `);
    return {
      rows: result.recordset.map((r) => ({ ...r, updatedAt: r.updated_at })),
      expected: result.recordset.length,
      rejects: [],
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    let inserted = 0;
    let updated = 0;
    for (const raw of rows) {
      const row = raw as {
        id: Buffer;
        sexo: string | null;
        fecha_nacimiento: Date | null;
        estado_expediente: string | null;
        record_status: string | null;
      };
      const result = await ctx.dwh
        .request()
        .input("naturalId", sql.UniqueIdentifier, toGuidParam(row.id))
        .input("sexo", sql.NVarChar(10), row.sexo ?? null)
        .input("fechaNac", sql.Date, row.fecha_nacimiento ?? null)
        .input("estado", sql.NVarChar(20), row.estado_expediente ?? null)
        .input("record", sql.NVarChar(20), row.record_status ?? null).query<{
        act: "INSERT" | "UPDATE";
      }>(`
          MERGE dim_patient WITH (HOLDLOCK) AS t
          USING (SELECT @naturalId AS patient_natural_id, @sexo AS sexo, @fechaNac AS fecha_nacimiento, @estado AS estado_expediente, @record AS record_status) AS s
          ON t.patient_natural_id = s.patient_natural_id
          WHEN MATCHED THEN UPDATE SET
            sexo = s.sexo, fecha_nacimiento = s.fecha_nacimiento, estado_expediente = s.estado_expediente,
            record_status = s.record_status, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (patient_natural_id, sexo, fecha_nacimiento, estado_expediente, record_status)
            VALUES (s.patient_natural_id, s.sexo, s.fecha_nacimiento, s.estado_expediente, s.record_status)
          OUTPUT $action AS act;
        `);
      const action = result.recordset[0]?.act;
      if (action === "INSERT") inserted += 1;
      else if (action === "UPDATE") updated += 1;
      else throw new Error("dim_patient MERGE did not report an action");
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

// ---- hechos: reject por dimensión faltante en extract ----

async function mapFactRow(
  ctx: EtlContext,
  entity: string,
  sourceId: Buffer,
  sucursalId: Buffer,
  profesionalId: Buffer | null,
  pacienteId: Buffer,
): Promise<{
  sucursalKey: number;
  professionalKey: number;
  patientKey: number;
}> {
  const sucursales = await buildSucursalMap(ctx);
  const profesionales = await buildProfessionalMap(ctx);
  const pacientes = await buildPatientMap(ctx);
  const sucursalKey = sucursales.get(guidHex(sucursalId));
  const professionalKey =
    profesionalId === null
      ? undefined
      : profesionales.get(guidHex(profesionalId));
  const patientKey = pacientes.get(guidHex(pacienteId));
  if (
    sucursalKey === undefined ||
    professionalKey === undefined ||
    patientKey === undefined
  ) {
    throw new FactRowReject(
      entity,
      guidHex(sourceId),
      "unknown_dimension",
      "sucursal/profesional/paciente sin dimensión",
    );
  }
  return { sucursalKey, professionalKey, patientKey };
}

class FactRowReject extends Error {
  constructor(
    public readonly entity: string,
    public readonly sourceReference: string,
    public readonly reasonCode: string,
    detail: string,
  ) {
    super(detail);
  }
}

export const factConsultationPipeline: PipelineSpec = {
  pipelineId: "fact_consultation",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      sucursal_id: Buffer;
      paciente_id: Buffer;
      profesional_id: Buffer;
      consultation_date: Date;
      status: string;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT id, sucursal_id, paciente_id, profesional_id, consultation_date, status, deleted_at, updated_at
        FROM consultas
        WHERE updated_at >= @watermark
      `);
    const rejects: EtlReject[] = [];
    const rows: Array<Record<string, unknown>> = [];
    for (const r of result.recordset) {
      try {
        const keys = await mapFactRow(
          ctx,
          "consultation",
          r.id,
          r.sucursal_id,
          r.profesional_id,
          r.paciente_id,
        );
        rows.push({ ...r, ...keys, updatedAt: r.updated_at });
      } catch (err) {
        if (err instanceof FactRowReject)
          rejects.push({
            entity: err.entity,
            sourceReference: err.sourceReference,
            reasonCode: err.reasonCode,
            reasonDetail: err.message,
          });
        else throw err;
      }
    }
    return {
      rows,
      expected: result.recordset.length,
      rejects,
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    const batches: string[] = [];
    let pending: string[] = [];
    for (const raw of rows) {
      const row = raw as {
        id: Buffer;
        sucursalKey: number;
        professionalKey: number;
        patientKey: number;
        consultation_date: Date;
        status: string;
        deleted_at: Date | null;
        updatedAt: Date;
      };
      pending.push(
        `(${binSql(row.id)}, ${row.sucursalKey}, ${row.professionalKey}, ${row.patientKey}, ${dateKeySql(row.consultation_date)}, ${strSql(row.status)}, ${row.deleted_at ? 1 : 0}, '${row.updatedAt.toISOString().slice(0, 23)}')`,
      );
      if (pending.length >= 200) {
        batches.push(pending.join(",\n"));
        pending = [];
      }
    }
    if (pending.length > 0) batches.push(pending.join(",\n"));
    let inserted = 0;
    let updated = 0;
    for (const valuesSql of batches) {
      const counts = await loadFactsWithMerge(
        ctx,
        "fact_consultation",
        [
          "source_consultation_id",
          "sucursal_key",
          "professional_key",
          "patient_key",
          "date_key",
          "status",
          "is_deleted",
          "source_updated_at",
        ],
        valuesSql,
      );
      inserted += counts.inserted;
      updated += counts.updated;
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

export const factAnthropometryPipeline: PipelineSpec = {
  pipelineId: "fact_anthropometry",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      sucursal_id: Buffer;
      paciente_id: Buffer;
      profesional_id: Buffer;
      measured_at: Date;
      weight_kg: number | null;
      height_m: number | null;
      bmi: number | null;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT id, sucursal_id, paciente_id, profesional_id, measured_at, weight_kg, height_m, bmi, deleted_at, updated_at
        FROM antropometrias
        WHERE updated_at >= @watermark
      `);
    const rejects: EtlReject[] = [];
    const rows: Array<Record<string, unknown>> = [];
    for (const r of result.recordset) {
      try {
        const keys = await mapFactRow(
          ctx,
          "anthropometry",
          r.id,
          r.sucursal_id,
          r.profesional_id,
          r.paciente_id,
        );
        rows.push({ ...r, ...keys, updatedAt: r.updated_at });
      } catch (err) {
        if (err instanceof FactRowReject)
          rejects.push({
            entity: err.entity,
            sourceReference: err.sourceReference,
            reasonCode: err.reasonCode,
            reasonDetail: err.message,
          });
        else throw err;
      }
    }
    return {
      rows,
      expected: result.recordset.length,
      rejects,
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    const batches: string[] = [];
    let pending: string[] = [];
    for (const raw of rows) {
      const row = raw as {
        id: Buffer;
        sucursalKey: number;
        professionalKey: number;
        patientKey: number;
        measured_at: Date;
        weight_kg: number | null;
        height_m: number | null;
        bmi: number | null;
        deleted_at: Date | null;
        updatedAt: Date;
      };
      pending.push(
        `(${binSql(row.id)}, ${row.sucursalKey}, ${row.professionalKey}, ${row.patientKey}, ${dateKeySql(row.measured_at)}, ${numSql(row.weight_kg)}, ${numSql(row.height_m)}, ${numSql(row.bmi)}, ${row.deleted_at ? 1 : 0}, '${row.updatedAt.toISOString().slice(0, 23)}')`,
      );
      if (pending.length >= 200) {
        batches.push(pending.join(",\n"));
        pending = [];
      }
    }
    if (pending.length > 0) batches.push(pending.join(",\n"));
    let inserted = 0;
    let updated = 0;
    for (const valuesSql of batches) {
      const counts = await loadFactsWithMerge(
        ctx,
        "fact_anthropometry",
        [
          "source_measurement_id",
          "sucursal_key",
          "professional_key",
          "patient_key",
          "date_key",
          "weight_kg",
          "height_m",
          "bmi",
          "is_deleted",
          "source_updated_at",
        ],
        valuesSql,
      );
      inserted += counts.inserted;
      updated += counts.updated;
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

// Una fila por observación de laboratorio (results_json).
interface LabPanelSyncState {
  panelId: Buffer;
  updatedAt: Date;
}

export const factLabPipeline: PipelineSpec = {
  pipelineId: "fact_lab",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      sucursal_id: Buffer;
      paciente_id: Buffer;
      profesional_id: Buffer;
      taken_at: Date;
      lab_name: string;
      results_json: string | null;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT id, sucursal_id, paciente_id, profesional_id, taken_at, lab_name, results_json, deleted_at, updated_at
        FROM lab_panels
        WHERE updated_at >= @watermark
      `);
    const rejects: EtlReject[] = [];
    const rows: Array<Record<string, unknown>> = [];
    const panels: LabPanelSyncState[] = [];
    for (const panel of result.recordset) {
      let observations: unknown[] = [];
      if (panel.results_json) {
        try {
          const parsed = JSON.parse(panel.results_json);
          if (Array.isArray(parsed)) observations = parsed;
          else if (parsed !== null && typeof parsed === "object")
            observations = Object.entries(parsed).map(([name, value]) => ({
              name,
              value,
            }));
          else
            rejects.push({
              entity: "lab_observation",
              sourceReference: guidHex(panel.id),
              reasonCode: "invalid_lab_json",
              reasonDetail: "results_json no es un arreglo ni objeto",
            });
        } catch {
          rejects.push({
            entity: "lab_observation",
            sourceReference: guidHex(panel.id),
            reasonCode: "invalid_lab_json",
            reasonDetail: "results_json malformado",
          });
        }
      }
      if (
        observations.length === 0 &&
        !rejects.some((r) => r.sourceReference === guidHex(panel.id))
      ) {
        rejects.push({
          entity: "lab_observation",
          sourceReference: guidHex(panel.id),
          reasonCode: "no_observations",
          reasonDetail: "sin observaciones",
        });
      }
      panels.push({
        panelId: panel.id,
        updatedAt: panel.updated_at,
      });
      for (const [observationIndex, rawObservation] of observations.entries()) {
        if (
          rawObservation === null ||
          typeof rawObservation !== "object" ||
          Array.isArray(rawObservation)
        ) {
          rejects.push({
            entity: "lab_observation",
            sourceReference: `${guidHex(panel.id)}:${observationIndex}`,
            reasonCode: "invalid_lab_observation",
            reasonDetail: "observación de laboratorio no es un objeto",
          });
          continue;
        }
        const obs = rawObservation as {
          name?: unknown;
          analyte?: unknown;
          value?: unknown;
          unit?: unknown;
        };
        if (
          (obs.name !== undefined && typeof obs.name !== "string") ||
          (obs.analyte !== undefined && typeof obs.analyte !== "string") ||
          (obs.unit !== undefined &&
            obs.unit !== null &&
            typeof obs.unit !== "string") ||
          (obs.value !== undefined &&
            obs.value !== null &&
            typeof obs.value === "object")
        ) {
          rejects.push({
            entity: "lab_observation",
            sourceReference: `${guidHex(panel.id)}:${observationIndex}`,
            reasonCode: "invalid_lab_observation",
            reasonDetail:
              "observación de laboratorio contiene campos inválidos",
          });
          continue;
        }
        try {
          const keys = await mapFactRow(
            ctx,
            "lab_observation",
            panel.id,
            panel.sucursal_id,
            panel.profesional_id,
            panel.paciente_id,
          );
          rows.push({
            panelId: panel.id,
            observationIndex,
            labName: String(
              obs.name ?? obs.analyte ?? panel.lab_name ?? "unknown",
            ),
            resultValue:
              obs.value === null || obs.value === undefined
                ? null
                : String(obs.value),
            resultUnit: (obs.unit as string | null | undefined) ?? null,
            sucursalKey: keys.sucursalKey,
            professionalKey: keys.professionalKey,
            patientKey: keys.patientKey,
            takenAt: panel.taken_at,
            deletedAt: panel.deleted_at,
            updatedAt: panel.updated_at,
          });
        } catch (err) {
          if (err instanceof FactRowReject)
            rejects.push({
              entity: err.entity,
              sourceReference: err.sourceReference,
              reasonCode: err.reasonCode,
              reasonDetail: err.message,
            });
          else throw err;
        }
      }
    }
    return {
      rows,
      expected: rows.length + rejects.length,
      rejects,
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
      metadata: { panels },
    };
  },
  load: async (ctx, rows, metadata) => {
    const panels =
      (metadata as { panels?: LabPanelSyncState[] } | undefined)?.panels ?? [];
    if (panels.length === 0 && rows.length === 0) {
      return { inserted: 0, updated: 0 };
    }

    const transaction = ctx.dwh.transaction();
    await transaction.begin();
    const runBatch: BatchRunner = (statement) =>
      transaction.request().batch(statement);
    try {
      for (let offset = 0; offset < panels.length; offset += 200) {
        const panelValues = panels
          .slice(offset, offset + 200)
          .map(
            (panel) =>
              `(${binSql(panel.panelId)}, '${panel.updatedAt.toISOString().slice(0, 23)}')`,
          )
          .join(",\n");
        await runBatch(`
          UPDATE target
             SET target.is_deleted = 1,
                 target.source_updated_at = incoming.source_updated_at
            FROM fact_lab AS target
            JOIN (VALUES ${panelValues}) AS incoming(source_lab_panel_id, source_updated_at)
              ON target.source_lab_panel_id = incoming.source_lab_panel_id;
        `);
      }

      const batches: string[] = [];
      let pending: string[] = [];
      for (const raw of rows) {
        const row = raw as {
          panelId: Buffer;
          observationIndex: number;
          labName: string;
          resultValue: string | null;
          resultUnit: string | null;
          sucursalKey: number;
          professionalKey: number;
          patientKey: number;
          takenAt: Date;
          deletedAt: Date | null;
          updatedAt: Date;
        };
        pending.push(
          `(${binSql(row.panelId)}, ${row.observationIndex}, ${strSql(row.labName)}, ${strSql(row.resultValue)}, ${strSql(row.resultUnit)}, ${row.sucursalKey}, ${row.professionalKey}, ${row.patientKey}, ${dateKeySql(row.takenAt)}, ${row.deletedAt ? 1 : 0}, '${row.updatedAt.toISOString().slice(0, 23)}')`,
        );
        if (pending.length >= 200) {
          batches.push(pending.join(",\n"));
          pending = [];
        }
      }
      if (pending.length > 0) batches.push(pending.join(",\n"));
      let inserted = 0;
      let updated = 0;
      for (const valuesSql of batches) {
        const counts = await loadFactsWithMerge(
          ctx,
          "fact_lab",
          [
            "source_lab_panel_id",
            "observation_index",
            "lab_name",
            "result_value",
            "result_unit",
            "sucursal_key",
            "professional_key",
            "patient_key",
            "date_key",
            "is_deleted",
            "source_updated_at",
          ],
          valuesSql,
          ["source_lab_panel_id", "observation_index"],
          runBatch,
        );
        inserted += counts.inserted;
        updated += counts.updated;
      }

      await transaction.commit();
      return { inserted, updated };
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  },
  filtered: () => 0,
};

export const factMealPlanPipeline: PipelineSpec = {
  pipelineId: "fact_meal_plan",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      sucursal_id: Buffer;
      paciente_id: Buffer;
      profesional_id: Buffer;
      start_date: Date;
      end_date: Date | null;
      kcal_target: number | null;
      status: string;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT id, sucursal_id, paciente_id, profesional_id, start_date, end_date, kcal_target, status, deleted_at, updated_at
        FROM planes_alimenticios
        WHERE updated_at >= @watermark
      `);
    const rejects: EtlReject[] = [];
    const rows: Array<Record<string, unknown>> = [];
    for (const r of result.recordset) {
      try {
        const keys = await mapFactRow(
          ctx,
          "meal_plan",
          r.id,
          r.sucursal_id,
          r.profesional_id,
          r.paciente_id,
        );
        rows.push({ ...r, ...keys, updatedAt: r.updated_at });
      } catch (err) {
        if (err instanceof FactRowReject)
          rejects.push({
            entity: err.entity,
            sourceReference: err.sourceReference,
            reasonCode: err.reasonCode,
            reasonDetail: err.message,
          });
        else throw err;
      }
    }
    return {
      rows,
      expected: result.recordset.length,
      rejects,
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    const batches: string[] = [];
    let pending: string[] = [];
    for (const raw of rows) {
      const row = raw as {
        id: Buffer;
        sucursalKey: number;
        professionalKey: number;
        patientKey: number;
        start_date: Date;
        end_date: Date | null;
        kcal_target: number | null;
        status: string;
        deleted_at: Date | null;
        updatedAt: Date;
      };
      pending.push(
        `(${binSql(row.id)}, ${row.sucursalKey}, ${row.professionalKey}, ${row.patientKey}, ${dateKeySql(row.start_date)}, ${dateKeySql(row.end_date)}, ${numSql(row.kcal_target)}, ${strSql(row.status)}, ${row.deleted_at ? 1 : 0}, '${row.updatedAt.toISOString().slice(0, 23)}')`,
      );
      if (pending.length >= 200) {
        batches.push(pending.join(",\n"));
        pending = [];
      }
    }
    if (pending.length > 0) batches.push(pending.join(",\n"));
    let inserted = 0;
    let updated = 0;
    for (const valuesSql of batches) {
      const counts = await loadFactsWithMerge(
        ctx,
        "fact_meal_plan",
        [
          "source_plan_id",
          "sucursal_key",
          "professional_key",
          "patient_key",
          "start_date_key",
          "end_date_key",
          "kcal_target",
          "status",
          "is_deleted",
          "source_updated_at",
        ],
        valuesSql,
      );
      inserted += counts.inserted;
      updated += counts.updated;
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

export const factAdherencePipeline: PipelineSpec = {
  pipelineId: "fact_adherence",
  extract: async (ctx) => {
    const result = await ctx.oltp
      .request()
      .input("watermark", sql.DateTime2(3), watermarkParam(ctx.watermark))
      .query<{
      id: Buffer;
      sucursal_id: Buffer;
      paciente_id: Buffer;
      profesional_id: Buffer | null;
      record_date: Date;
      adherence_menu: number | null;
      adherence_water: number | null;
      adherence_activity: number | null;
      adherence_supplements: number | null;
      adherence_sleep: number | null;
      meals_logged: string | null;
      deleted_at: Date | null;
      updated_at: Date;
    }>(`
        SELECT a.id, a.sucursal_id, a.paciente_id, c.profesional_id, a.record_date, a.adherence_menu, a.adherence_water, a.adherence_activity, a.adherence_supplements, a.adherence_sleep, a.meals_logged, a.deleted_at, a.updated_at
        FROM adherence_records a
        LEFT JOIN consultas c ON c.id = a.consulta_id
        WHERE a.updated_at >= @watermark
      `);
    const rejects: EtlReject[] = [];
    const rows: Array<Record<string, unknown>> = [];
    for (const r of result.recordset) {
      try {
        const keys = await mapFactRow(
          ctx,
          "adherence",
          r.id,
          r.sucursal_id,
          r.profesional_id,
          r.paciente_id,
        );
        rows.push({ ...r, ...keys, updatedAt: r.updated_at });
      } catch (err) {
        if (err instanceof FactRowReject)
          rejects.push({
            entity: err.entity,
            sourceReference: err.sourceReference,
            reasonCode: err.reasonCode,
            reasonDetail: err.message,
          });
        else throw err;
      }
    }
    return {
      rows,
      expected: result.recordset.length,
      rejects,
      maxSourceUpdatedAt: latestSourceUpdate(result.recordset),
    };
  },
  load: async (ctx, rows) => {
    const batches: string[] = [];
    let pending: string[] = [];
    for (const raw of rows) {
      const row = raw as {
        id: Buffer;
        sucursalKey: number;
        professionalKey: number;
        patientKey: number;
        record_date: Date;
        adherence_menu: number | null;
        adherence_water: number | null;
        adherence_activity: number | null;
        adherence_supplements: number | null;
        adherence_sleep: number | null;
        meals_logged: string | null;
        deleted_at: Date | null;
        updatedAt: Date;
      };
      pending.push(
        `(${binSql(row.id)}, ${row.sucursalKey}, ${row.professionalKey}, ${row.patientKey}, ${dateKeySql(row.record_date)}, ${numSql(row.adherence_menu)}, ${numSql(row.adherence_water)}, ${numSql(row.adherence_activity)}, ${numSql(row.adherence_supplements)}, ${numSql(row.adherence_sleep)}, ${strSql(row.meals_logged)}, ${row.deleted_at ? 1 : 0}, '${row.updatedAt.toISOString().slice(0, 23)}')`,
      );
      if (pending.length >= 200) {
        batches.push(pending.join(",\n"));
        pending = [];
      }
    }
    if (pending.length > 0) batches.push(pending.join(",\n"));
    let inserted = 0;
    let updated = 0;
    for (const valuesSql of batches) {
      const counts = await loadFactsWithMerge(
        ctx,
        "fact_adherence",
        [
          "source_adherence_id",
          "sucursal_key",
          "professional_key",
          "patient_key",
          "date_key",
          "adherence_menu",
          "adherence_water",
          "adherence_activity",
          "adherence_supplements",
          "adherence_sleep",
          "meals_logged",
          "is_deleted",
          "source_updated_at",
        ],
        valuesSql,
      );
      inserted += counts.inserted;
      updated += counts.updated;
    }
    return { inserted, updated };
  },
  filtered: () => 0,
};

export const PIPELINES: Record<string, PipelineSpec> = {
  dim_sucursal: dimSucursalPipeline,
  dim_professional: dimProfessionalPipeline,
  dim_patient: dimPatientPipeline,
  fact_consultation: factConsultationPipeline,
  fact_anthropometry: factAnthropometryPipeline,
  fact_lab: factLabPipeline,
  fact_meal_plan: factMealPlanPipeline,
  fact_adherence: factAdherencePipeline,
};

export async function runAllPipelines(): Promise<EtlRunResult[]> {
  const config = readDwhConfig();
  const dwh = await getDwhPool();
  await assertDwhSchemaCompatible(dwh);
  await populateDimDate(dwh);
  const results: EtlRunResult[] = [];
  for (const id of ALL_PIPELINE_IDS) {
    const spec = PIPELINES[id];
    if (!spec) continue;
    const result = await runPipeline(spec, {
      failInjectionPipeline: config.failInjectionPipeline,
    });
    results.push(result);
    if (result.status !== "succeeded") break;
  }
  return results;
}
