import { randomUUID } from 'node:crypto';
import type { Role } from '@nutriclinica/shared';
import { isConsentAccepted, type ConsentChecker } from '../aiConsent.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import type { ActionRegistry } from './actionRegistry.js';
import { inMemoryActionLedger } from './actionLedger.js';
import { readActionsConfig, type ConfirmableActionsConfig } from './config.js';
import type { ActionConfirmation, ActionContext, ActionExecution, ActionLedger, ActionPreview, ConfirmableActionDefinition } from './actionTypes.js';
import { defaultActionRegistry } from './seeds.js';

export type ActionServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

export interface ConfirmableActionsServiceOptions {
  registry?: ActionRegistry;
  ledger?: ActionLedger;
  consentChecker?: ConsentChecker;
  config?: (env?: NodeJS.ProcessEnv) => ConfirmableActionsConfig;
  now?: () => Date;
}

export class ConfirmableActionsService {
  private readonly registry: ActionRegistry;
  private readonly ledger: ActionLedger;
  private readonly consentChecker: ConsentChecker;
  private readonly configReader: (env?: NodeJS.ProcessEnv) => ConfirmableActionsConfig;
  private readonly clock: () => Date;

  constructor(options: ConfirmableActionsServiceOptions = {}) {
    this.registry = options.registry ?? defaultActionRegistry;
    this.ledger = options.ledger ?? inMemoryActionLedger;
    this.consentChecker = options.consentChecker ?? isConsentAccepted;
    this.configReader = options.config ?? readActionsConfig;
    this.clock = options.now ?? (() => new Date());
  }

  private fail(status: number, error: string): ActionServiceResult<never> {
    return { ok: false, status, error };
  }

  listActions(): ConfirmableActionDefinition[] {
    return this.registry.list();
  }

  async preview(
    input: { actionId: string; pacienteId?: string; idempotencyKey?: string; input: Record<string, unknown> },
    actor: { profesionalId: string; role: Role },
    sucursalId: string,
  ): Promise<ActionServiceResult<{ confirmationId: string; actionId: string; preview: ActionPreview; expiresAt: string }>> {
    if (!this.configReader().enabled) return this.fail(503, 'Acciones confirmables deshabilitadas');
    const action = this.registry.get(input.actionId);
    if (!action) return this.fail(404, 'Accion no encontrada');
    if (!roleSatisfies(actor.role, action.requiredRole)) return this.fail(403, 'Rol sin permiso para esta accion');

    if (action.requiredConsents.length > 0) {
      if (!input.pacienteId) return this.fail(400, 'Se requiere un paciente con consentimiento para esta accion');
      for (const tipo of action.requiredConsents) {
        const accepted = await this.consentChecker(input.pacienteId, sucursalId, tipo);
        if (!accepted) return this.fail(403, `Consentimiento '${tipo}' no otorgado`);
      }
    }

    const parsed = action.inputSchema.safeParse(input.input);
    if (!parsed.success) return this.fail(400, 'Entrada invalida para la accion');

    const now = this.clock();
    const pending = await this.ledger.countPendingConfirmations(actor.profesionalId);
    if (pending >= this.configReader().maxPendingConfirmations) {
      return this.fail(429, 'Demasiadas confirmaciones pendientes');
    }

    const ctx: ActionContext = { actor, sucursalId, pacienteId: input.pacienteId, now };
    const preview = await action.preview(parsed.data, ctx);
    const confirmation: ActionConfirmation = {
      id: randomUUID(),
      actionId: action.id,
      actor,
      sucursalId,
      pacienteId: input.pacienteId,
      input: parsed.data,
      idempotencyKey: input.idempotencyKey ?? null,
      previewSummary: preview.summary,
      expiresAt: new Date(now.getTime() + this.configReader().confirmationTtlMin * 60 * 1000).toISOString(),
      used: false,
      createdAt: now.toISOString(),
    };
    try {
      await this.ledger.createConfirmation(confirmation);
    } catch {
      return this.fail(503, 'Almacen de acciones no disponible');
    }
    return { ok: true, value: { confirmationId: confirmation.id, actionId: action.id, preview, expiresAt: confirmation.expiresAt } };
  }

  async confirm(
    input: { actionId: string; confirmationId: string; idempotencyKey?: string; input: Record<string, unknown> },
    actor: { profesionalId: string; role: Role },
    sucursalId: string,
  ): Promise<ActionServiceResult<{ execution: ActionExecution; replayed: boolean }>> {
    if (!this.configReader().enabled) return this.fail(503, 'Acciones confirmables deshabilitadas');
    const action = this.registry.get(input.actionId);
    if (!action) return this.fail(404, 'Accion no encontrada');
    if (!roleSatisfies(actor.role, action.requiredRole)) return this.fail(403, 'Rol sin permiso para esta accion');

    const confirmation = await this.ledger.getConfirmation(input.confirmationId);
    if (!confirmation || confirmation.actionId !== input.actionId) return this.fail(404, 'Confirmacion no encontrada');
    if (confirmation.actor.profesionalId !== actor.profesionalId) return this.fail(403, 'La confirmacion pertenece a otro profesional');
    if (confirmation.sucursalId !== sucursalId) return this.fail(403, 'La confirmacion pertenece a otra sucursal');

    const now = this.clock();
    if (new Date(confirmation.expiresAt).getTime() < now.getTime()) return this.fail(410, 'Confirmacion expirada');
    if (confirmation.used) return this.fail(409, 'Confirmacion ya utilizada');

    const idempotencyKey = input.idempotencyKey ?? confirmation.idempotencyKey;
    if (idempotencyKey) {
      const existing = await this.ledger.findExecutionByIdempotencyKey(idempotencyKey, input.actionId, sucursalId);
      if (existing) return { ok: true, value: { execution: existing, replayed: true } };
    }

    const parsed = action.inputSchema.safeParse(input.input);
    if (!parsed.success) return this.fail(400, 'Entrada invalida para la accion');
    if (JSON.stringify(parsed.data) !== JSON.stringify(confirmation.input)) {
      return this.fail(400, 'La entrada no coincide con el preview confirmado');
    }

    const used = await this.ledger.markUsed(confirmation.id);
    if (!used) return this.fail(409, 'Confirmacion ya utilizada');

    const ctx: ActionContext = { actor, sucursalId, pacienteId: confirmation.pacienteId, now };
    const base: ActionExecution = {
      id: randomUUID(),
      actionId: input.actionId,
      confirmationId: confirmation.id,
      idempotencyKey,
      actor,
      sucursalId,
      pacienteId: confirmation.pacienteId,
      input: parsed.data,
      status: 'confirmed',
      createdAt: now.toISOString(),
      confirmedAt: now.toISOString(),
    };

    try {
      const result = await action.execute(parsed.data, ctx);
      const execution: ActionExecution = { ...base, status: 'executed', result, executedAt: now.toISOString() };
      await this.ledger.recordExecution(execution);
      return { ok: true, value: { execution, replayed: false } };
    } catch (err) {
      const execution: ActionExecution = {
        ...base,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
      try {
        await this.ledger.recordExecution(execution);
      } catch {
        // la falla de registro no oculta el error original
      }
      return this.fail(502, 'La accion fallo al ejecutarse');
    }
  }

  async rollback(
    input: { actionId: string; executionId: string; reason?: string },
    actor: { profesionalId: string; role: Role },
    sucursalId: string,
  ): Promise<ActionServiceResult<{ execution: ActionExecution }>> {
    if (!this.configReader().enabled) return this.fail(503, 'Acciones confirmables deshabilitadas');
    const action = this.registry.get(input.actionId);
    if (!action) return this.fail(404, 'Accion no encontrada');
    if (!roleSatisfies(actor.role, action.requiredRole)) return this.fail(403, 'Rol sin permiso para esta accion');
    if (!action.compensate) return this.fail(400, 'Esta accion no soporta rollback');

    const execution = await this.ledger.getExecution(input.executionId);
    if (!execution || execution.actionId !== input.actionId) return this.fail(404, 'Ejecucion no encontrada');
    if (execution.sucursalId !== sucursalId) return this.fail(403, 'La ejecucion pertenece a otra sucursal');
    if (execution.status !== 'executed') return this.fail(409, 'La accion no esta en estado ejecutada');

    const now = this.clock();
    const ctx: ActionContext = { actor, sucursalId, pacienteId: execution.pacienteId, now };
    try {
      const compensation = await action.compensate(execution, ctx);
      const reason = input.reason ?? 'Rollback solicitado';
      const rolledBack = await this.ledger.markRolledBack(execution.id, reason, now.toISOString());
      if (!rolledBack) return this.fail(409, 'La accion ya no puede revertirse');
      const updated: ActionExecution = {
        ...execution,
        status: 'rolled_back',
        rollbackReason: reason,
        rolledBackAt: now.toISOString(),
        result: { ...(execution.result ?? {}), compensation },
      };
      return { ok: true, value: { execution: updated } };
    } catch {
      return this.fail(502, 'La compensacion fallo');
    }
  }
}