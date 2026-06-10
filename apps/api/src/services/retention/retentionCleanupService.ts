import sql from 'mssql';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../db/connection.js';

interface ExpiredGrabacion {
  id: string;
  sucursal_id: string | null;
  retention_until: Date;
}

export interface CleanupResult {
  deletedCount: number;
  errors: string[];
}

async function hardDeleteGrabacion(pool: sql.ConnectionPool, row: ExpiredGrabacion): Promise<boolean> {
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const logId = randomUUID();
    await transaction
      .request()
      .input('log_id', sql.UniqueIdentifier(), logId)
      .input('sucursal_id', sql.UniqueIdentifier(), row.sucursal_id)
      .input('entity_type', sql.NVarChar(60), 'video_grabacion')
      .input('entity_id', sql.UniqueIdentifier(), row.id)
      .input('retention_until', sql.DateTime2(3), row.retention_until)
      .input('reason', sql.NVarChar(500), `Retención expirada: ${row.retention_until.toISOString()}`)
      .query(
        `INSERT INTO retention_cleanup_log
           (id, sucursal_id, entity_type, entity_id, retention_until, reason)
         VALUES
           (@log_id, @sucursal_id, @entity_type, @entity_id, @retention_until, @reason)`,
      );

    await transaction
      .request()
      .input('id', sql.UniqueIdentifier(), row.id)
      .query('DELETE FROM video_grabaciones WHERE id = @id');

    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

export async function runRetentionCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = { deletedCount: 0, errors: [] };

  try {
    const pool = await getPool();

    const expired = await pool.request().query<ExpiredGrabacion>(
      `SELECT id, sucursal_id, retention_until
         FROM video_grabaciones WITH (READPAST)
        WHERE deleted_at IS NULL
          AND retention_until IS NOT NULL
          AND retention_until < SYSUTCDATETIME()`,
    );

    if (expired.recordset.length === 0) {
      console.log('[retention] no expired recordings found');
      return result;
    }

    for (const row of expired.recordset) {
      try {
        await hardDeleteGrabacion(pool, row);
        result.deletedCount++;
        console.log(`[retention] deleted recording ${row.id} (expired ${row.retention_until.toISOString()})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`recording ${row.id}: ${msg}`);
        console.error(`[retention] failed to delete ${row.id}:`, msg);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`query: ${msg}`);
    console.error('[retention] cleanup error:', msg);
  }

  return result;
}
