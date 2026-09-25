import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import { readAgentsConfig } from './config.js';
import { BoundedAgentEngine, type AgentRunResult } from './agentEngine.js';
import { defaultAgentRegistry, type AgentRegistry } from './agentRegistry.js';

const RunBodySchema = z
  .object({
    input: z.record(z.string(), z.unknown()),
    pacienteId: z.string().uuid().optional(),
  })
  .strict();

const ConfirmBodySchema = z
  .object({
    runId: z.string().uuid(),
    stepIndex: z.number().int().min(0),
  })
  .strict();

const agentRateLimit = rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'ai-agents' });

export function createAgentRouter(deps: { engine?: BoundedAgentEngine; registry?: AgentRegistry } = {}): Router {
  const engine = deps.engine ?? new BoundedAgentEngine();
  const registry = deps.registry ?? defaultAgentRegistry;
  const router: Router = ExpressRouter();

  router.use(requireAuth, requireSucursalAccess, agentRateLimit);

  router.get('/', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const config = readAgentsConfig();
    const user = req.user;
    const agents = registry.list().map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      riskLevel: agent.riskLevel,
      requiredRole: agent.requiredRole,
      requiredConsents: agent.requiredConsents,
      requiresPaciente: agent.requiresPaciente,
      allowedToolIds: agent.allowedToolIds,
      confirmationPolicy: agent.confirmationPolicy,
      budget: agent.budget,
      availability: {
        available: config.enabled && roleSatisfies(user.rol, agent.requiredRole),
        reason: !config.enabled ? 'Agentes deshabilitados' : undefined,
      },
    }));
    res.json({ agents });
  });

  router.post('/:agentId/run', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const definition = registry.get(String(req.params.agentId));
    if (!definition) {
      sendError(res, 404, 'Agente desconocido');
      return;
    }
    const parsed = RunBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Solicitud de ejecucion invalida');
      return;
    }
    const result = await engine.run(
      definition,
      parsed.data.input,
      { profesionalId: req.user.sub, role: req.user.rol },
      req.sucursalId ?? '',
      { pacienteId: parsed.data.pacienteId },
    );
    await auditAgent(req, { operacion: 'run', agentId: definition.id, runId: result.ok ? result.value.run.id : undefined, ok: result.ok });
    sendAgentResult(res, result);
  });

  router.post('/:agentId/confirm', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const definition = registry.get(String(req.params.agentId));
    if (!definition) {
      sendError(res, 404, 'Agente desconocido');
      return;
    }
    const parsed = ConfirmBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Solicitud de confirmacion invalida');
      return;
    }
    const result = await engine.confirmStep(
      definition,
      parsed.data.runId,
      parsed.data.stepIndex,
      { profesionalId: req.user.sub, role: req.user.rol },
      req.sucursalId ?? '',
    );
    await auditAgent(req, { operacion: 'confirm', agentId: definition.id, runId: result.ok ? result.value.run.id : parsed.data.runId, ok: result.ok });
    sendAgentResult(res, result);
  });

  router.get('/:agentId/runs/:runId', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const definition = registry.get(String(req.params.agentId));
    if (!definition) {
      sendError(res, 404, 'Agente desconocido');
      return;
    }
    const result = await engine.fetchRun(
      definition,
      String(req.params.runId),
      { profesionalId: req.user.sub, role: req.user.rol },
      req.sucursalId ?? '',
    );
    await auditAgent(req, { operacion: 'fetch', agentId: definition.id, runId: String(req.params.runId), ok: result.ok });
    sendAgentResult(res, result);
  });

  return router;
}

function sendAgentResult(res: Response, result: AgentRunResult): void {
  if (!result.ok) {
    sendError(res, result.status, result.error);
    return;
  }
  const { run, pending } = result.value;
  res.json({
    runId: run.id,
    status: run.status,
    agentId: run.agentId,
    stopReason: run.stopReason,
    pending: pending
      ? { stepIndex: pending.stepIndex, toolId: pending.toolId, args: pending.args, summary: pending.summary }
      : undefined,
    answer: run.answer,
    steps: run.steps,
    budgetUsed: run.budgetUsed,
    error: run.error,
  });
}

async function auditAgent(req: Request, event: { operacion: 'run' | 'confirm' | 'fetch'; agentId: string; runId?: string; ok: boolean }): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), req.sucursalId ?? null)
      .input('profesional_id', sql.UniqueIdentifier(), req.user?.sub ?? null)
      .input('entity_type', sql.NVarChar(60), 'ai_agent')
      .input('entity_id', sql.UniqueIdentifier(), event.runId ?? null)
      .input('operacion', sql.NVarChar(20), event.operacion)
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ agentId: event.agentId, ok: event.ok, actor: req.user?.sub }))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[agents] audit failed:', err instanceof Error ? err.message : err);
  }
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

export default createAgentRouter();