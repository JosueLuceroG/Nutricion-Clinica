import type { DwhStore, LoadRun, MetricSnapshot } from './dwhTypes.js';

export class InMemoryDwhStore implements DwhStore {
  private readonly snapshots = new Map<string, MetricSnapshot>();
  private readonly runs = new Map<string, LoadRun>();

  async saveSnapshot(snapshot: MetricSnapshot): Promise<void> {
    this.snapshots.set(`${snapshot.metricId}:${snapshot.dimensionKey}`, snapshot);
  }

  async listSnapshots(input: { metricId?: string; dimensionKey?: string }): Promise<MetricSnapshot[]> {
    return Array.from(this.snapshots.values()).filter(
      (snapshot) =>
        (input.metricId === undefined || snapshot.metricId === input.metricId) &&
        (input.dimensionKey === undefined || snapshot.dimensionKey === input.dimensionKey),
    );
  }

  async saveLoadRun(run: LoadRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async getLoadRun(id: string): Promise<LoadRun | undefined> {
    return this.runs.get(id);
  }

  async listLoadRuns(limit = 20): Promise<LoadRun[]> {
    return Array.from(this.runs.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }
}

export class SqlDwhStore implements DwhStore {
  async saveSnapshot(snapshot: MetricSnapshot): Promise<void> {
    const { getPool } = await import('../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool.request()
      .input('metric_id', sql.NVarChar(60), snapshot.metricId)
      .input('dimension_key', sql.NVarChar(100), snapshot.dimensionKey)
      .input('value', sql.Float, snapshot.value)
      .input('loaded_at', sql.DateTime2(3), new Date(snapshot.loadedAt))
      .input('source_run_id', sql.UniqueIdentifier(), snapshot.sourceRunId)
      .batch(
        `UPDATE dwh_metric_snapshots SET value = @value, loaded_at = @loaded_at, source_run_id = @source_run_id
         WHERE metric_id = @metric_id AND dimension_key = @dimension_key;
         IF @@ROWCOUNT = 0
         BEGIN
           INSERT INTO dwh_metric_snapshots (metric_id, dimension_key, value, loaded_at, source_run_id)
           VALUES (@metric_id, @dimension_key, @value, @loaded_at, @source_run_id);
         END;`,
      );
  }

  async listSnapshots(input: { metricId?: string; dimensionKey?: string }): Promise<MetricSnapshot[]> {
    const { getPool } = await import('../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const req = pool.request();
    if (input.metricId) req.input('metric_id', sql.NVarChar(60), input.metricId);
    if (input.dimensionKey) req.input('dimension_key', sql.NVarChar(100), input.dimensionKey);
    const result = await req.query(
      `SELECT * FROM dwh_metric_snapshots
       ${input.metricId ? 'WHERE metric_id = @metric_id' : ''}
       ${input.metricId && input.dimensionKey ? 'AND' : input.dimensionKey ? 'WHERE' : ''}
       ${input.dimensionKey ? 'dimension_key = @dimension_key' : ''}
       ORDER BY dimension_key ASC`,
    );
    return result.recordset.map(mapSnapshot);
  }

  async saveLoadRun(run: LoadRun): Promise<void> {
    const { getPool } = await import('../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool.request()
      .input('id', sql.UniqueIdentifier(), run.id)
      .input('started_at', sql.DateTime2(3), new Date(run.startedAt))
      .input('finished_at', sql.DateTime2(3), new Date(run.finishedAt))
      .input('rows_loaded', sql.Int, run.rowsLoaded)
      .input('status', sql.NVarChar(20), run.status)
      .input('error', sql.NVarChar(sql.MAX), run.error ?? null)
      .input('metrics', sql.NVarChar(1000), run.metrics.join(','))
      .input('engine_version', sql.NVarChar(40), run.engineVersion)
      .query(
        `INSERT INTO dwh_load_runs (id, started_at, finished_at, rows_loaded, status, error, metrics, engine_version)
         VALUES (@id, @started_at, @finished_at, @rows_loaded, @status, @error, @metrics, @engine_version)`,
      );
  }

  async getLoadRun(id: string): Promise<LoadRun | undefined> {
    const { getPool } = await import('../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.UniqueIdentifier(), id)
      .query('SELECT TOP 1 * FROM dwh_load_runs WHERE id = @id');
    const row = result.recordset[0];
    return row ? mapRun(row) : undefined;
  }

  async listLoadRuns(limit = 20): Promise<LoadRun[]> {
    const { getPool } = await import('../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query('SELECT TOP (@limit) * FROM dwh_load_runs ORDER BY started_at DESC');
    return result.recordset.map(mapRun);
  }
}

function mapSnapshot(row: Record<string, unknown>): MetricSnapshot {
  return {
    metricId: String(row.metric_id),
    dimensionKey: String(row.dimension_key),
    value: Number(row.value),
    loadedAt: new Date(row.loaded_at as string).toISOString(),
    sourceRunId: String(row.source_run_id),
  };
}

function mapRun(row: Record<string, unknown>): LoadRun {
  return {
    id: String(row.id),
    startedAt: new Date(row.started_at as string).toISOString(),
    finishedAt: new Date(row.finished_at as string).toISOString(),
    rowsLoaded: Number(row.rows_loaded),
    status: row.status as LoadRun['status'],
    error: row.error ? String(row.error) : undefined,
    metrics: String(row.metrics).split(',').filter(Boolean),
    engineVersion: String(row.engine_version),
  };
}

export function selectDwhStore(env: NodeJS.ProcessEnv = process.env): DwhStore {
  return env.DWH_STORE === 'sql' ? new SqlDwhStore() : inMemoryDwhStore;
}

export const inMemoryDwhStore = new InMemoryDwhStore();