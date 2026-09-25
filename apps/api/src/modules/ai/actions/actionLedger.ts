import type { ActionConfirmation, ActionExecution, ActionLedger } from './actionTypes.js';

export class InMemoryActionLedger implements ActionLedger {
  private readonly confirmations = new Map<string, ActionConfirmation>();
  private readonly executions = new Map<string, ActionExecution>();

  constructor(private readonly options: { now?: () => Date } = {}) {}

  private clock(): Date {
    return this.options.now?.() ?? new Date();
  }

  async createConfirmation(confirmation: ActionConfirmation): Promise<void> {
    this.confirmations.set(confirmation.id, confirmation);
  }

  async getConfirmation(id: string): Promise<ActionConfirmation | undefined> {
    return this.confirmations.get(id);
  }

  async markUsed(id: string): Promise<boolean> {
    const confirmation = this.confirmations.get(id);
    if (!confirmation) return false;
    if (confirmation.used) return false;
    this.confirmations.set(id, { ...confirmation, used: true });
    return true;
  }

  async countPendingConfirmations(actorProfesionalId: string): Promise<number> {
    const now = this.clock().getTime();
    let count = 0;
    for (const confirmation of this.confirmations.values()) {
      if (confirmation.actor.profesionalId !== actorProfesionalId) continue;
      if (confirmation.used) continue;
      if (new Date(confirmation.expiresAt).getTime() < now) continue;
      count += 1;
    }
    return count;
  }

  async findExecutionByIdempotencyKey(key: string, actionId: string, sucursalId: string): Promise<ActionExecution | undefined> {
    for (const execution of this.executions.values()) {
      if (execution.idempotencyKey === key && execution.actionId === actionId && execution.sucursalId === sucursalId) {
        return execution;
      }
    }
    return undefined;
  }

  async recordExecution(execution: ActionExecution): Promise<void> {
    this.executions.set(execution.id, execution);
  }

  async getExecution(id: string): Promise<ActionExecution | undefined> {
    return this.executions.get(id);
  }

  async markRolledBack(id: string, reason: string, rolledBackAt: string): Promise<boolean> {
    const execution = this.executions.get(id);
    if (!execution || execution.status !== 'executed') return false;
    this.executions.set(id, { ...execution, status: 'rolled_back', rollbackReason: reason, rolledBackAt });
    return true;
  }
}

export class SqlActionLedger implements ActionLedger {
  async createConfirmation(confirmation: ActionConfirmation): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), confirmation.id)
      .input('action_id', sql.NVarChar(80), confirmation.actionId)
      .input('actor_profesional_id', sql.UniqueIdentifier(), confirmation.actor.profesionalId)
      .input('actor_role', sql.NVarChar(40), confirmation.actor.role)
      .input('sucursal_id', sql.UniqueIdentifier(), confirmation.sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), confirmation.pacienteId ?? null)
      .input('input_json', sql.NVarChar(sql.MAX), JSON.stringify(confirmation.input))
      .input('idempotency_key', sql.NVarChar(120), confirmation.idempotencyKey)
      .input('preview_summary', sql.NVarChar(400), confirmation.previewSummary)
      .input('expires_at', sql.DateTime2(3), confirmation.expiresAt)
      .input('used', sql.Bit, confirmation.used)
      .input('created_at', sql.DateTime2(3), confirmation.createdAt)
      .query(
        `INSERT INTO ai_action_confirmations
           (id, action_id, actor_profesional_id, actor_role, sucursal_id, paciente_id,
            input_json, idempotency_key, preview_summary, expires_at, used, created_at)
         VALUES
           (@id, @action_id, @actor_profesional_id, @actor_role, @sucursal_id, @paciente_id,
            @input_json, @idempotency_key, @preview_summary, @expires_at, @used, @created_at)`,
      );
  }

  async getConfirmation(id: string): Promise<ActionConfirmation | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<{
        action_id: string;
        actor_profesional_id: string;
        actor_role: string;
        sucursal_id: string;
        paciente_id: string | null;
        input_json: string;
        idempotency_key: string | null;
        preview_summary: string;
        expires_at: Date;
        used: boolean;
        created_at: Date;
      }>(
        `SELECT action_id, actor_profesional_id, actor_role, sucursal_id, paciente_id,
                input_json, idempotency_key, preview_summary, expires_at, used, created_at
           FROM ai_action_confirmations
          WHERE id = @id`,
      );
    const row = result.recordset[0];
    if (!row) return undefined;
    return {
      id,
      actionId: row.action_id,
      actor: { profesionalId: row.actor_profesional_id, role: row.actor_role },
      sucursalId: row.sucursal_id,
      pacienteId: row.paciente_id ?? undefined,
      input: JSON.parse(row.input_json),
      idempotencyKey: row.idempotency_key,
      previewSummary: row.preview_summary,
      expiresAt: row.expires_at.toISOString(),
      used: row.used,
      createdAt: row.created_at.toISOString(),
    };
  }

  async markUsed(id: string): Promise<boolean> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<{ updated: number }>(
        `UPDATE ai_action_confirmations SET used = 1 WHERE id = @id AND used = 0;
         SELECT @@ROWCOUNT AS updated`,
      );
    return result.recordset[0].updated > 0;
  }

  async countPendingConfirmations(actorProfesionalId: string): Promise<number> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('actor_profesional_id', sql.UniqueIdentifier(), actorProfesionalId)
      .query<{ pending: number }>(
        `SELECT COUNT(*) AS pending
           FROM ai_action_confirmations
          WHERE actor_profesional_id = @actor_profesional_id
            AND used = 0
            AND expires_at > SYSUTCDATETIME()`,
      );
    return result.recordset[0].pending;
  }

  async findExecutionByIdempotencyKey(key: string, actionId: string, sucursalId: string): Promise<ActionExecution | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('idempotency_key', sql.NVarChar(120), key)
      .input('action_id', sql.NVarChar(80), actionId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query<ActionExecutionRow>(
        `SELECT id, action_id, confirmation_id, idempotency_key, actor_profesional_id, actor_role,
                sucursal_id, paciente_id, input_json, result_json, error, status,
                created_at, confirmed_at, executed_at, rolled_back_at, rollback_reason
           FROM ai_action_executions
          WHERE idempotency_key = @idempotency_key
            AND action_id = @action_id
            AND sucursal_id = @sucursal_id`,
      );
    const row = result.recordset[0];
    return row ? rowToExecution(row) : undefined;
  }

  async recordExecution(execution: ActionExecution): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), execution.id)
      .input('action_id', sql.NVarChar(80), execution.actionId)
      .input('confirmation_id', sql.UniqueIdentifier(), execution.confirmationId)
      .input('idempotency_key', sql.NVarChar(120), execution.idempotencyKey)
      .input('actor_profesional_id', sql.UniqueIdentifier(), execution.actor.profesionalId)
      .input('actor_role', sql.NVarChar(40), execution.actor.role)
      .input('sucursal_id', sql.UniqueIdentifier(), execution.sucursalId)
      .input('paciente_id', sql.UniqueIdentifier(), execution.pacienteId ?? null)
      .input('input_json', sql.NVarChar(sql.MAX), JSON.stringify(execution.input))
      .input('result_json', sql.NVarChar(sql.MAX), execution.result ? JSON.stringify(execution.result) : null)
      .input('error', sql.NVarChar(sql.MAX), execution.error ?? null)
      .input('status', sql.NVarChar(30), execution.status)
      .input('created_at', sql.DateTime2(3), execution.createdAt)
      .input('confirmed_at', sql.DateTime2(3), execution.confirmedAt)
      .input('executed_at', sql.DateTime2(3), execution.executedAt ?? null)
      .input('rolled_back_at', sql.DateTime2(3), execution.rolledBackAt ?? null)
      .input('rollback_reason', sql.NVarChar(400), execution.rollbackReason ?? null)
      .query(
        `INSERT INTO ai_action_executions
           (id, action_id, confirmation_id, idempotency_key, actor_profesional_id, actor_role,
            sucursal_id, paciente_id, input_json, result_json, error, status,
            created_at, confirmed_at, executed_at, rolled_back_at, rollback_reason)
         VALUES
           (@id, @action_id, @confirmation_id, @idempotency_key, @actor_profesional_id, @actor_role,
            @sucursal_id, @paciente_id, @input_json, @result_json, @error, @status,
            @created_at, @confirmed_at, @executed_at, @rolled_back_at, @rollback_reason)`,
      );
  }

  async getExecution(id: string): Promise<ActionExecution | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query<ActionExecutionRow>(
        `SELECT id, action_id, confirmation_id, idempotency_key, actor_profesional_id, actor_role,
                sucursal_id, paciente_id, input_json, result_json, error, status,
                created_at, confirmed_at, executed_at, rolled_back_at, rollback_reason
           FROM ai_action_executions
          WHERE id = @id`,
      );
    const row = result.recordset[0];
    return row ? rowToExecution(row) : undefined;
  }

  async markRolledBack(id: string, reason: string, rolledBackAt: string): Promise<boolean> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .input('rollback_reason', sql.NVarChar(400), reason)
      .input('rolled_back_at', sql.DateTime2(3), rolledBackAt)
      .query<{ updated: number }>(
        `UPDATE ai_action_executions
            SET status = 'rolled_back', rollback_reason = @rollback_reason, rolled_back_at = @rolled_back_at
          WHERE id = @id AND status = 'executed';
         SELECT @@ROWCOUNT AS updated`,
      );
    return result.recordset[0].updated > 0;
  }
}

interface ActionExecutionRow {
  id: string;
  action_id: string;
  confirmation_id: string;
  idempotency_key: string | null;
  actor_profesional_id: string;
  actor_role: string;
  sucursal_id: string;
  paciente_id: string | null;
  input_json: string;
  result_json: string | null;
  error: string | null;
  status: ActionExecution['status'];
  created_at: Date;
  confirmed_at: Date;
  executed_at: Date | null;
  rolled_back_at: Date | null;
  rollback_reason: string | null;
}

function rowToExecution(row: ActionExecutionRow): ActionExecution {
  return {
    id: row.id,
    actionId: row.action_id,
    confirmationId: row.confirmation_id,
    idempotencyKey: row.idempotency_key,
    actor: { profesionalId: row.actor_profesional_id, role: row.actor_role },
    sucursalId: row.sucursal_id,
    pacienteId: row.paciente_id ?? undefined,
    input: JSON.parse(row.input_json),
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
    error: row.error ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    confirmedAt: row.confirmed_at.toISOString(),
    executedAt: row.executed_at?.toISOString(),
    rolledBackAt: row.rolled_back_at?.toISOString(),
    rollbackReason: row.rollback_reason ?? undefined,
  };
}

export function selectActionLedger(env: NodeJS.ProcessEnv = process.env): ActionLedger {
  return env.AI_ACTIONS_LEDGER_STORE === 'sql' ? new SqlActionLedger() : inMemoryActionLedger;
}

export const inMemoryActionLedger = new InMemoryActionLedger();