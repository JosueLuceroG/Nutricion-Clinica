import sql from "mssql";
import { randomUUID } from "node:crypto";
import { getPool } from "../../db/connection.js";
import { RETENTION_CONFIG } from "./retentionConfig.js";

interface ExpiredGrabacion {
  id: string;
  sucursal_id: string | null;
  retention_until: Date;
}

export interface CleanupResult {
  eligibleCount: number;
  deletedCount: number;
  dryRun: boolean;
  errors: string[];
}

async function hardDeleteGrabacion(
  pool: sql.ConnectionPool,
  row: ExpiredGrabacion,
): Promise<boolean> {
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const deleted = await transaction
      .request()
      .input("id", sql.UniqueIdentifier(), row.id)
      .input("retention_until", sql.DateTime2(3), row.retention_until)
      .query(`DELETE FROM video_grabaciones
               WHERE id = @id
                 AND retention_until = @retention_until
                 AND retention_until < SYSUTCDATETIME()`);
    if ((deleted.rowsAffected[0] ?? 0) !== 1) {
      await transaction.rollback();
      return false;
    }

    const logId = randomUUID();
    await transaction
      .request()
      .input("log_id", sql.UniqueIdentifier(), logId)
      .input("sucursal_id", sql.UniqueIdentifier(), row.sucursal_id)
      .input("entity_type", sql.NVarChar(60), "video_grabacion")
      .input("entity_id", sql.UniqueIdentifier(), row.id)
      .input("retention_until", sql.DateTime2(3), row.retention_until)
      .input(
        "reason",
        sql.NVarChar(500),
        `Retención expirada: ${row.retention_until.toISOString()}`,
      )
      .query(
        `INSERT INTO retention_cleanup_log
           (id, sucursal_id, entity_type, entity_id, retention_until, reason)
         VALUES
           (@log_id, @sucursal_id, @entity_type, @entity_id, @retention_until, @reason)`,
      );

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback().catch(() => undefined);
    throw err;
  }
}

export async function runRetentionCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    eligibleCount: 0,
    deletedCount: 0,
    dryRun: RETENTION_CONFIG.dryRun,
    errors: [],
  };

  if (!result.dryRun && !RETENTION_CONFIG.legalHoldReviewAttested) {
    result.errors.push("legal hold review attestation missing");
    console.error(
      "[retention] apply blocked: legal hold review attestation missing",
    );
    return result;
  }

  try {
    const pool = await getPool();

    const expired = await pool
      .request()
      .input("batch_size", sql.Int, RETENTION_CONFIG.batchSize)
      .query<ExpiredGrabacion>(
        `SELECT TOP (@batch_size) id, sucursal_id, retention_until
          FROM video_grabaciones WITH (READPAST)
        WHERE retention_until IS NOT NULL
          AND retention_until < SYSUTCDATETIME()
         ORDER BY retention_until, id`,
      );

    result.eligibleCount = expired.recordset.length;
    if (result.eligibleCount === 0) {
      console.log("[retention] no expired recordings found");
      return result;
    }

    if (result.dryRun) {
      console.log(
        `[retention] dry-run: ${result.eligibleCount} recordings eligible`,
      );
      return result;
    }

    for (const row of expired.recordset) {
      try {
        if (await hardDeleteGrabacion(pool, row)) {
          result.deletedCount++;
          console.log("[retention] deleted one expired recording");
        }
      } catch (err) {
        result.errors.push("recording deletion failed");
        console.error(
          "[retention] failed to delete one expired recording:",
          err instanceof Error ? err.name : "UnknownRetentionError",
        );
      }
    }
  } catch (err) {
    result.errors.push("retention query failed");
    console.error(
      "[retention] cleanup error:",
      err instanceof Error ? err.name : "UnknownRetentionError",
    );
  }

  return result;
}
