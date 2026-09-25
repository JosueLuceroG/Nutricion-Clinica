import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import { closePool, getPool } from "../db/connection.js";
import { assertTargetSafe } from "../modules/deployment/targetGuard.js";
import { readEnvironmentClass } from "../modules/deployment/environmentIdentity.js";
import { RETENTION_CONFIG } from "../services/retention/retentionConfig.js";

async function main(): Promise<void> {
  try {
    assertTargetSafe("maintenance", process.env);
    const apply = process.env.RETENTION_BACKFILL_APPLY === "true";
    if (apply && process.env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED !== "true") {
      throw new Error(
        "RETENTION_LEGAL_HOLD_REVIEW_ATTESTED=true requerido para aplicar backfill",
      );
    }

    const pool = await getPool();
    const count = await pool
      .request()
      .query<{
        candidates: number;
      }>("SELECT COUNT_BIG(*) AS candidates FROM video_grabaciones WHERE retention_until IS NULL");
    const candidates = Number(count.recordset[0]?.candidates ?? 0);
    if (!apply) {
      console.log(`retention-backfill: DRY_RUN candidates=${candidates}`);
      return;
    }

    const updated = await pool
      .request()
      .input("years", sql.Int, RETENTION_CONFIG.years)
      .input("batch_size", sql.Int, RETENTION_CONFIG.batchSize)
      .query(
        `UPDATE TOP (@batch_size) video_grabaciones
            SET retention_until = DATEADD(YEAR, @years, created_at)
          WHERE retention_until IS NULL`,
      );
    console.log(
      `retention-backfill: APPLIED rows=${updated.rowsAffected[0] ?? 0} priorCandidates=${candidates}`,
    );
  } catch (error) {
    const environmentClass = readEnvironmentClass(process.env);
    const detailedErrors =
      environmentClass === "LOCAL" || environmentClass === "TEST";
    console.error(
      "retention-backfill: failed:",
      error instanceof Error
        ? detailedErrors
          ? error.message
          : error.name
        : "UnknownRetentionBackfillError",
    );
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const invokedDirectly = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invokedDirectly) void main();
