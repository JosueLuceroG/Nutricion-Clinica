import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import { readActionsConfig } from './config.js';
import { ConfirmableActionsService } from './actionService.js';

const PreviewBody = z
  .object({
    input: z.record(z.string(), z.unknown()),
    pacienteId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const ConfirmBody = z
  .object({
    confirmationId: z.string().uuid(),
    input: z.record(z.string(), z.unknown()),
    idempotencyKey: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

const RollbackBody = z
  .object({
    executionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(400).optional(),
  })
  .strict();

async function auditAction(req: Request, event: { operacion: 'preview' | 'confirm' | 'rollback'; actionId: string; executionId?: string }): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), req.sucursalId ?? null)
      .input('profesional_id', sql.UniqueIdentifier(), req.user?.sub ?? null)
      .input('entity_type', sql.NVarChar(60), 'ai_action')
      .input('entity_id', sql.UniqueIdentifier(), event.executionId ?? null)
      .input('operacion', sql.NVarChar(20), event.operacion)
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ actionId: event.actionId, actor: req.user?.sub }))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[actions] audit failed:', err instanceof Error ? err.message : err);
  }
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

export function createActionRouter(deps: { service?: ConfirmableActionsService } = {}): Router {
  const router: Router = ExpressRouter();
  const actionsRateLimit = rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'ai-actions' });
  const service = deps.service ?? new ConfirmableActionsService();

  router.use(requireAuth, requireSucursalAccess, actionsRateLimit);

  router.get('/', (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const config = readActionsConfig();
    const user = req.user;
    const actions = service.listActions().map((action) => ({
      id: action.id,
      name: action.name,
      description: action.description,
      riskLevel: action.riskLevel,
      requiredRole: action.requiredRole,
      requiredConsents: action.requiredConsents,
      supportsRollback: Boolean(action.compensate),
      availability: {
        available: config.enabled && roleSatisfies(user.rol, action.requiredRole),
        reason: !config.enabled ? 'Acciones deshabilitadas' : undefined,
      },
    }));
    res.json({ actions });
  });

  router.post('/:actionId/preview', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const parsed = PreviewBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Solicitud de preview invalida');
      return;
    }
    const result = await service.preview(
      {
        actionId: String(req.params.actionId),
        pacienteId: parsed.data.pacienteId,
        idempotencyKey: parsed.data.idempotencyKey,
        input: parsed.data.input,
      },
      { profesionalId: req.user.sub, role: req.user.rol },
      req.sucursalId ?? '',
    );
    if (!result.ok) {
      sendError(res, result.status, result.error);
      return;
    }
    await auditAction(req, { operacion: 'preview', actionId: result.value.actionId });
    res.json({ actionId: result.value.actionId, confirmationId: result.value.confirmationId, preview: result.value.preview, expiresAt: result.value.expiresAt });
  });

  router.post('/:actionId/confirm', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const parsed = ConfirmBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Solicitud de confirmacion invalida');
      return;
    }
    const result = await service.confirm(
      {
        actionId: String(req.params.actionId),
        confirmationId: parsed.data.confirmationId,
        idempotencyKey: parsed.data.idempotencyKey,
        input: parsed.data.input,
      },
      { profesionalId: req.user.sub, role: req.user.rol },
      req.sucursalId ?? '',
    );
    if (!result.ok) {
      sendError(res, result.status, result.error);
      return;
    }
    await auditAction(req, { operacion: 'confirm', actionId: String(req.params.actionId), executionId: result.value.execution.id });
    res.json({ execution: result.value.execution, replayed: result.value.replayed });
  });

  router.post('/:actionId/rollback', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const parsed = RollbackBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Solicitud de rollback invalida');
      return;
    }
    const result = await service.rollback(
      {
        actionId: String(req.params.actionId),
        executionId: parsed.data.executionId,
        reason: parsed.data.reason,
      },
      { profesionalId: req.user.sub, role: req.user.rol },
      req.sucursalId ?? '',
    );
    if (!result.ok) {
      sendError(res, result.status, result.error);
      return;
    }
    await auditAction(req, { operacion: 'rollback', actionId: String(req.params.actionId), executionId: result.value.execution.id });
    res.json({ execution: result.value.execution });
  });

  return router;
}

export default createActionRouter();