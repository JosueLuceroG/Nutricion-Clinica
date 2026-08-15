import type { AgentLedger, AgentRun } from './agentTypes.js';

export class InMemoryAgentLedger implements AgentLedger {
  private readonly runs = new Map<string, AgentRun>();

  async createRun(run: AgentRun): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
  }

  async getRun(runId: string): Promise<AgentRun | null> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }

  async saveRun(run: AgentRun): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
  }

  async countActiveRuns(actorProfesionalId: string, sucursalId: string): Promise<number> {
    let count = 0;
    for (const run of this.runs.values()) {
      if (run.actor.profesionalId === actorProfesionalId && run.sucursalId === sucursalId) {
        if (run.status === 'running' || run.status === 'awaiting_confirmation') count += 1;
      }
    }
    return count;
  }
}

interface AgentRunRow {
  agent_id: string;
  actor_profesional_id: string;
  actor_role: string;
  sucursal_id: string;
  paciente_id: string | null;
  status: string;
  stop_reason: string | null;
  steps_json: string;
  budget_json: string;
  input_json: string;
  pending_step_index: number | null;
  pending_tool_json: string | null;
  answer: string | null;
  error: string | null;
  started_at: Date;
  expires_at: Date;
  completed_at: Date | null;
}

export class SqlAgentLedger implements AgentLedger {
  async createRun(run: AgentRun): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), run.id)
      .input('agent_id', sql.NVarChar(100), run.agentId)
      .input('actor_profesional_id', sql.UniqueIdentifier(), run.actor.profesionalId)
      .input('actor_role', sql.NVarChar(40), run.actor.role)
      .input('sucursal_id', sql.UniqueIdentifier(), run.sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), run.pacienteId ?? null)
      .input('status', sql.NVarChar(30), run.status)
      .input('stop_reason', sql.NVarChar(30), run.stopReason ?? null)
      .input('steps_json', sql.NVarChar(sql.MAX), JSON.stringify(run.steps))
      .input('budget_json', sql.NVarChar(400), JSON.stringify(run.budgetUsed))
      .input('input_json', sql.NVarChar(sql.MAX), JSON.stringify(run.input))
      .input('pending_step_index', sql.Int, run.pendingStepIndex ?? null)
      .input('pending_tool_json', sql.NVarChar(sql.MAX), run.pendingTool ? JSON.stringify(run.pendingTool) : null)
      .input('answer', sql.NVarChar(sql.MAX), run.answer ?? null)
      .input('error', sql.NVarChar(sql.MAX), run.error ?? null)
      .input('started_at', sql.DateTime2(3), run.startedAt)
      .input('expires_at', sql.DateTime2(3), run.expiresAt)
      .input('completed_at', sql.DateTime2(3), run.completedAt ?? null)
      .query(
        `INSERT INTO ai_agent_runs
           (id, agent_id, actor_profesional_id, actor_role, sucursal_id, paciente_id,
            status, stop_reason, steps_json, budget_json, input_json, pending_step_index,
            pending_tool_json, answer, error, started_at, expires_at, completed_at)
         VALUES
           (@id, @agent_id, @actor_profesional_id, @actor_role, @sucursal_id, @paciente_id,
            @status, @stop_reason, @steps_json, @budget_json, @input_json, @pending_step_index,
            @pending_tool_json, @answer, @error, @started_at, @expires_at, @completed_at)`,
      );
  }

  async getRun(runId: string): Promise<AgentRun | null> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), runId)
      .query<AgentRunRow>(
        `SELECT agent_id, actor_profesional_id, actor_role, sucursal_id, paciente_id,
                status, stop_reason, steps_json, budget_json, input_json, pending_step_index,
                pending_tool_json, answer, error, started_at, expires_at, completed_at
           FROM ai_agent_runs
          WHERE id = @id`,
      );
    const row = result.recordset[0];
    if (!row) return null;
    return {
      id: runId,
      agentId: row.agent_id,
      actor: { profesionalId: row.actor_profesional_id, role: row.actor_role as AgentRun['actor']['role'] },
      sucursalId: row.sucursal_id,
      pacienteId: row.paciente_id ?? undefined,
      status: row.status as AgentRun['status'],
      stopReason: (row.stop_reason as AgentRun['stopReason']) ?? undefined,
      steps: JSON.parse(row.steps_json),
      budgetUsed: JSON.parse(row.budget_json),
      input: JSON.parse(row.input_json),
      pendingStepIndex: row.pending_step_index ?? undefined,
      pendingTool: row.pending_tool_json ? JSON.parse(row.pending_tool_json) : undefined,
      answer: row.answer ?? undefined,
      error: row.error ?? undefined,
      startedAt: row.started_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      completedAt: row.completed_at?.toISOString(),
    };
  }

  async saveRun(run: AgentRun): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), run.id)
      .input('status', sql.NVarChar(30), run.status)
      .input('stop_reason', sql.NVarChar(30), run.stopReason ?? null)
      .input('steps_json', sql.NVarChar(sql.MAX), JSON.stringify(run.steps))
      .input('budget_json', sql.NVarChar(400), JSON.stringify(run.budgetUsed))
      .input('pending_step_index', sql.Int, run.pendingStepIndex ?? null)
      .input('pending_tool_json', sql.NVarChar(sql.MAX), run.pendingTool ? JSON.stringify(run.pendingTool) : null)
      .input('answer', sql.NVarChar(sql.MAX), run.answer ?? null)
      .input('error', sql.NVarChar(sql.MAX), run.error ?? null)
      .input('expires_at', sql.DateTime2(3), run.expiresAt)
      .input('completed_at', sql.DateTime2(3), run.completedAt ?? null)
      .query(
        `UPDATE ai_agent_runs
            SET status = @status, stop_reason = @stop_reason, steps_json = @steps_json,
                budget_json = @budget_json, pending_step_index = @pending_step_index,
                pending_tool_json = @pending_tool_json, answer = @answer, error = @error,
                expires_at = @expires_at, completed_at = @completed_at
          WHERE id = @id`,
      );
  }

  async countActiveRuns(actorProfesionalId: string, sucursalId: string): Promise<number> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('actor_profesional_id', sql.UniqueIdentifier(), actorProfesionalId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<{ active: number }>(
        `SELECT COUNT(*) AS active
           FROM ai_agent_runs
          WHERE actor_profesional_id = @actor_profesional_id
            AND sucursal_id = @sucursal_id
            AND status IN ('running', 'awaiting_confirmation')`,
      );
    return result.recordset[0]?.active ?? 0;
  }
}

export function selectAgentLedger(env: NodeJS.ProcessEnv = process.env): AgentLedger {
  return env.AI_AGENTS_LEDGER_STORE === 'sql' ? new SqlAgentLedger() : inMemoryAgentLedger;
}

export const inMemoryAgentLedger = new InMemoryAgentLedger();