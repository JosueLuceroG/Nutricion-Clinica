import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import {
  SYNCABLE_ENTITIES,
  type SyncableEntity,
  type SyncPullChange,
  type SyncPullResponse,
  type SyncPushBatch,
  type SyncPushResponse,
  type SyncPushResultItem,
  type SyncManifest,
} from '@nutriclinica/shared';

const MAX_BATCH_SIZE = 500;
const PULL_PAGE_SIZE = 1000;

const ENTITY_TABLES: Record<SyncableEntity, string> = {
  pacientes: 'pacientes',
  consultas: 'consultas',
  antropometrias: 'antropometrias',
  lab_panels: 'lab_panels',
  planes_alimenticios: 'planes_alimenticios',
};

export async function getManifest(): Promise<SyncManifest> {
  const pool = await getPool();
  const timeResult = await pool
    .request()
    .query<{ t: Date }>('SELECT SYSUTCDATETIME() AS t');
  return {
    apiVersion: 'v1',
    syncSchemaVersion: 1,
    serverTime: (timeResult.recordset[0]?.t ?? new Date()).toISOString(),
    entities: [...SYNCABLE_ENTITIES],
    maxBatchSize: MAX_BATCH_SIZE,
    supportsDelta: true,
  };
}

export async function pullChanges(
  sucursalId: string,
  since: Date,
  entityFilter: SyncableEntity[] | null,
): Promise<SyncPullResponse> {
  const pool = await getPool();
  const entities = entityFilter && entityFilter.length > 0 ? entityFilter : [...SYNCABLE_ENTITIES];
  const allChanges: SyncPullChange[] = [];
  let hasMore = false;
  let nextSince = since;

  for (const entity of entities) {
    const table = ENTITY_TABLES[entity];
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('since', sql.DateTime2(), since)
      .query<{ id: string; updated_at: Date; deleted_at: Date | null; row_version: Buffer }>(
        `SELECT id, updated_at, deleted_at, row_version
           FROM ${table} WITH (NOLOCK)
          WHERE sucursal_id = @sucursal_id AND updated_at > @since
          ORDER BY updated_at ASC
          OFFSET 0 ROWS FETCH NEXT ${PULL_PAGE_SIZE + 1} ROWS ONLY`,
      );
    const rows = result.recordset;
    const truncated = rows.length > PULL_PAGE_SIZE;
    const limited = truncated ? rows.slice(0, PULL_PAGE_SIZE) : rows;
    for (const r of limited) {
      const detail = await pool
        .request()
        .input('id', sql.UniqueIdentifier(), r.id)
        .query<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = @id`);
      allChanges.push({
        entity,
        id: r.id,
        op: r.deleted_at ? 'delete' : 'update',
        payload: detail.recordset[0] ?? null,
        serverUpdatedAt: r.updated_at.toISOString(),
        serverRowVersion: r.row_version ? Buffer.from(r.row_version).toString('base64') : '',
      });
      if (r.updated_at > nextSince) nextSince = r.updated_at;
    }
    if (truncated) hasMore = true;
  }

  const serverTimeResult = await pool
    .request()
    .query<{ t: Date }>('SELECT SYSUTCDATETIME() AS t');
  return {
    serverTime: (serverTimeResult.recordset[0]?.t ?? new Date()).toISOString(),
    changes: allChanges,
    hasMore,
    nextSince: nextSince.toISOString(),
  };
}

export async function pushBatch(batch: SyncPushBatch): Promise<SyncPushResponse> {
  const pool = await getPool();
  const results: SyncPushResultItem[] = [];

  for (const op of batch.operations) {
    try {
      const result = await applyOperation(pool, batch.sucursalId, op);
      results.push(result);
    } catch (err) {
      results.push({
        entity: op.entity,
        id: op.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const timeResult = await pool
    .request()
    .query<{ t: Date }>('SELECT SYSUTCDATETIME() AS t');
  return {
    results,
    serverTime: (timeResult.recordset[0]?.t ?? new Date()).toISOString(),
  };
}

async function applyOperation(
  pool: sql.ConnectionPool,
  sucursalId: string,
  op: { entity: SyncableEntity; id: string; op: 'create' | 'update' | 'delete'; payload: unknown; clientUpdatedAt: string; expectedRowVersion?: string },
): Promise<SyncPushResultItem> {
  const table = ENTITY_TABLES[op.entity];

  if (op.op === 'delete') {
    const r = pool
      .request()
      .input('id', sql.UniqueIdentifier(), op.id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query(`UPDATE ${table} SET deleted_at = SYSUTCDATETIME() WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
    await r;
    return { entity: op.entity, id: op.id, status: 'applied' };
  }

  if (op.op === 'update' && op.expectedRowVersion) {
    const existing = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), op.id)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<{ row_version: Buffer; updated_at: Date }>(`SELECT row_version, updated_at FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id AND deleted_at IS NULL`);
    const current = existing.recordset[0];
    if (current) {
      const currentVersion = Buffer.from(current.row_version).toString('base64');
      if (currentVersion !== op.expectedRowVersion) {
        return {
          entity: op.entity,
          id: op.id,
          status: 'conflict',
          serverUpdatedAt: current.updated_at.toISOString(),
          serverRowVersion: currentVersion,
          error: 'row_version mismatch — server has newer changes',
        };
      }
    }
  }

  const exists = await pool
    .request()
    .input('id', sql.UniqueIdentifier(), op.id)
    .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
    .query<{ id: string }>(`SELECT id FROM ${table} WHERE id = @id AND sucursal_id = @sucursal_id`);

  if (exists.recordset.length === 0) {
    return { entity: op.entity, id: op.id, status: 'skipped', error: 'entity does not exist on server (would need explicit create)' };
  }

  return { entity: op.entity, id: op.id, status: 'applied' };
}
