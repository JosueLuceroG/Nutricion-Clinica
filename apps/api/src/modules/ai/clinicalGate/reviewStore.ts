import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import type { ClinicalComparison } from './comparison.js';
import type { ShadowRun } from './shadowMode.js';

export interface ClinicalReviewStore {
  saveShadowRun(run: ShadowRun): Promise<void>;
  getShadowRun(id: string): Promise<ShadowRun | undefined>;
  saveComparison(comparison: ClinicalComparison): Promise<void>;
  countCriticalDisagreements(input: { sucursalId: string | null; since: Date }): Promise<number>;
  listShadowRuns(input: { sucursalId: string; limit?: number }): Promise<ShadowRun[]>;
}

export class InMemoryClinicalReviewStore implements ClinicalReviewStore {
  private readonly runs = new Map<string, ShadowRun>();
  private readonly comparisons = new Map<string, ClinicalComparison>();

  async saveShadowRun(run: ShadowRun): Promise<void> {
    this.runs.set(run.id, run);
  }

  async getShadowRun(id: string): Promise<ShadowRun | undefined> {
    return this.runs.get(id);
  }

  async saveComparison(comparison: ClinicalComparison): Promise<void> {
    this.comparisons.set(comparison.id, comparison);
  }

  async countCriticalDisagreements(input: { sucursalId: string | null; since: Date }): Promise<number> {
    let count = 0;
    for (const comparison of this.comparisons.values()) {
      if (comparison.verdict !== 'critical_disagreement') continue;
      if (new Date(comparison.reviewedAt) < input.since) continue;
      if (input.sucursalId !== null && comparison.sucursalId !== input.sucursalId) continue;
      count += 1;
    }
    return count;
  }

  async listShadowRuns(input: { sucursalId: string; limit?: number }): Promise<ShadowRun[]> {
    const runs = Array.from(this.runs.values())
      .filter((run) => run.sucursalId === input.sucursalId)
      .sort((a, b) => b.runAt.localeCompare(a.runAt));
    return input.limit !== undefined ? runs.slice(0, input.limit) : runs;
  }
}

export class SqlClinicalReviewStore implements ClinicalReviewStore {
  async saveShadowRun(run: ShadowRun): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), run.id)
      .input('sucursal_id', sql.UniqueIdentifier(), run.sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), run.pacienteId)
      .input('profesional_id', sql.UniqueIdentifier(), run.actor)
      .input('request_id', sql.NVarChar(64), run.requestId)
      .input('run_at', sql.DateTime2(3), new Date(run.runAt))
      .input('served', sql.Bit, run.served ? 1 : 0)
      .input('envelope_json', sql.NVarChar(sql.MAX), JSON.stringify(run.result.envelope))
      .input('advice_json', sql.NVarChar(sql.MAX), run.result.advice ? JSON.stringify(run.result.advice) : null)
      .query(
        `INSERT INTO clinical_shadow_runs (id, sucursal_id, paciente_id, profesional_id, request_id, run_at, served, envelope_json, advice_json, deleted_at)
         VALUES (@id, @sucursal_id, @paciente_id, @profesional_id, @request_id, @run_at, @served, @envelope_json, @advice_json, NULL)`,
      );
  }

  async getShadowRun(id: string): Promise<ShadowRun | undefined> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query(
        `SELECT TOP 1 id, sucursal_id, paciente_id, profesional_id, request_id, run_at, served, envelope_json, advice_json
         FROM clinical_shadow_runs WHERE id = @id AND deleted_at IS NULL`,
      );
    const row = result.recordset[0];
    if (!row) return undefined;
    return {
      id: String(row.id),
      requestId: String(row.request_id),
      pacienteId: String(row.paciente_id),
      sucursalId: String(row.sucursal_id),
      actor: String(row.profesional_id),
      runAt: new Date(row.run_at).toISOString(),
      served: Boolean(row.served),
      result: {
        status: row.advice_json ? 'advice' : 'abstained',
        envelope: JSON.parse(String(row.envelope_json)) as ShadowRun['result']['envelope'],
        ...(row.advice_json ? { advice: JSON.parse(String(row.advice_json)) as { content: string } } : {}),
      },
    };
  }

  async saveComparison(comparison: ClinicalComparison): Promise<void> {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), comparison.id)
      .input('sucursal_id', sql.UniqueIdentifier(), comparison.sucursalId)
      .input('shadow_run_id', sql.UniqueIdentifier(), comparison.shadowRunId)
      .input('profesional_id', sql.UniqueIdentifier(), comparison.professionalId)
      .input('reviewed_at', sql.DateTime2(3), new Date(comparison.reviewedAt))
      .input('verdict', sql.NVarChar(32), comparison.verdict)
      .input('notes', sql.NVarChar(1000), comparison.notes ?? null)
      .query(
        `INSERT INTO clinical_reviews (id, sucursal_id, shadow_run_id, profesional_id, reviewed_at, verdict, notes, deleted_at)
         VALUES (@id, @sucursal_id, @shadow_run_id, @profesional_id, @reviewed_at, @verdict, @notes, NULL)`,
      );
  }

  async countCriticalDisagreements(input: { sucursalId: string | null; since: Date }): Promise<number> {
    const pool = await getPool();
    const req = pool.request().input('since', sql.DateTime2(3), input.since);
    if (input.sucursalId !== null) {
      req.input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId);
    }
    const result = await req.query(
      `SELECT COUNT(*) AS total FROM clinical_reviews
       WHERE verdict = 'critical_disagreement' AND reviewed_at >= @since AND deleted_at IS NULL
       ${input.sucursalId !== null ? 'AND sucursal_id = @sucursal_id' : ''}`,
    );
    return Number(result.recordset[0]?.total ?? 0);
  }

  async listShadowRuns(input: { sucursalId: string; limit?: number }): Promise<ShadowRun[]> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId)
      .input('limit', sql.Int(), input.limit ?? 50)
      .query(
        `SELECT TOP (@limit) id, sucursal_id, paciente_id, profesional_id, request_id, run_at, served, envelope_json, advice_json
         FROM clinical_shadow_runs WHERE sucursal_id = @sucursal_id AND deleted_at IS NULL ORDER BY run_at DESC`,
      );
    return result.recordset.map((row) => ({
      id: String(row.id),
      requestId: String(row.request_id),
      pacienteId: String(row.paciente_id),
      sucursalId: String(row.sucursal_id),
      actor: String(row.profesional_id),
      runAt: new Date(row.run_at).toISOString(),
      served: Boolean(row.served),
      result: {
        status: row.advice_json ? 'advice' : 'abstained',
        envelope: JSON.parse(String(row.envelope_json)) as ShadowRun['result']['envelope'],
        ...(row.advice_json ? { advice: JSON.parse(String(row.advice_json)) as { content: string } } : {}),
      },
    }));
  }
}

export function selectClinicalReviewStore(env: NodeJS.ProcessEnv = process.env): ClinicalReviewStore {
  return env.AI_CLINICAL_REVIEW_STORE === 'sql' ? new SqlClinicalReviewStore() : inMemoryClinicalReviewStore;
}

export const inMemoryClinicalReviewStore = new InMemoryClinicalReviewStore();