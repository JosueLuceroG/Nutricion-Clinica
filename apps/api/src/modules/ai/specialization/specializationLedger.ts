import { randomUUID } from 'node:crypto';
import type { EvaluationVerdict, SpecializationLedger } from './specializationTypes.js';

export class InMemorySpecializationLedger implements SpecializationLedger {
  private readonly decisions = new Map<string, EvaluationVerdict[]>();

  async recordDecision(verdict: EvaluationVerdict): Promise<void> {
    const list = this.decisions.get(verdict.candidateId) ?? [];
    list.push(verdict);
    this.decisions.set(verdict.candidateId, list);
  }

  async latestDecision(candidateId: string): Promise<EvaluationVerdict | undefined> {
    const list = this.decisions.get(candidateId);
    return list?.at(-1);
  }

  async listDecisions(): Promise<EvaluationVerdict[]> {
    return Array.from(this.decisions.values()).flat();
  }
}

interface DecisionRow {
  candidate_id: string;
  status: string;
  reasons_json: string;
  evaluated_at: Date;
}

export class SqlSpecializationLedger implements SpecializationLedger {
  async recordDecision(verdict: EvaluationVerdict): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('candidate_id', sql.NVarChar(100), verdict.candidateId)
      .input('status', sql.NVarChar(20), verdict.status)
      .input('reasons_json', sql.NVarChar(sql.MAX), JSON.stringify(verdict.reasons))
      .input('evaluated_at', sql.DateTime2(3), verdict.evaluatedAt)
      .query(
        `INSERT INTO ai_specialization_decisions (id, candidate_id, status, reasons_json, evaluated_at)
         VALUES (@id, @candidate_id, @status, @reasons_json, @evaluated_at)`,
      );
  }

  async latestDecision(candidateId: string): Promise<EvaluationVerdict | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('candidate_id', sql.NVarChar(100), candidateId)
      .query<DecisionRow>(
        `SELECT TOP 1 candidate_id, status, reasons_json, evaluated_at
           FROM ai_specialization_decisions
          WHERE candidate_id = @candidate_id
          ORDER BY evaluated_at DESC`,
      );
    const row = result.recordset[0];
    if (!row) return undefined;
    return {
      candidateId: row.candidate_id,
      status: row.status as EvaluationVerdict['status'],
      reasons: JSON.parse(row.reasons_json),
      evaluatedAt: row.evaluated_at.toISOString(),
    };
  }

  async listDecisions(): Promise<EvaluationVerdict[]> {
    const { getPool } = await import('../../../db/connection.js');
    const pool = await getPool();
    const result = await pool
      .request()
      .query<DecisionRow>(
        `SELECT candidate_id, status, reasons_json, evaluated_at
           FROM ai_specialization_decisions
          ORDER BY evaluated_at DESC`,
      );
    return result.recordset.map((row) => ({
      candidateId: row.candidate_id,
      status: row.status as EvaluationVerdict['status'],
      reasons: JSON.parse(row.reasons_json),
      evaluatedAt: row.evaluated_at.toISOString(),
    }));
  }
}

export function selectSpecializationLedger(env: NodeJS.ProcessEnv = process.env): SpecializationLedger {
  return env.AI_SPECIALIZATION_STORE === 'sql' ? new SqlSpecializationLedger() : inMemorySpecializationLedger;
}

export const inMemorySpecializationLedger = new InMemorySpecializationLedger();