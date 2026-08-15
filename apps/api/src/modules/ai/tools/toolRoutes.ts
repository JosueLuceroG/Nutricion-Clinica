import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { isConsentAccepted } from '../aiConsent.js';
import { ERP_TOOLS } from './erpToolExecutors.js';
import { aiToolRegistry } from './toolRegistry.js';
import { toolExecutionService, type ToolAuditEvent } from './toolExecutionService.js';

for (const tool of ERP_TOOLS) {
  aiToolRegistry.register(tool);
}

const InvokeSchema = z
  .object({
    toolId: z.string().min(1).max(60),
    args: z.record(z.string(), z.unknown()).default({}),
    pacienteId: z.string().uuid().optional(),
  })
  .strict();

async function auditToolEvent(req: Request, event: ToolAuditEvent): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), event.sucursalId)
      .input('profesional_id', sql.UniqueIdentifier(), event.profesionalId)
      .input('entity_type', sql.NVarChar(60), 'ai_tool')
      .input('operacion', sql.NVarChar(20), 'read')
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify(event))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, NULL, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[tools] audit failed:', err instanceof Error ? err.message : err);
  }
}

const router: Router = ExpressRouter();
const toolsRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'ai-tools' });

router.use(requireAuth, requireSucursalAccess, toolsRateLimit);

router.post('/invoke', async (req: Request, res: Response) => {
  const parsed = InvokeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Solicitud de herramienta invalida', details: parsed.error.flatten() });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const result = await toolExecutionService.invoke(
    {
      toolId: parsed.data.toolId,
      args: parsed.data.args,
      actor: { profesionalId: req.user.sub, role: req.user.rol },
      sucursalId: req.sucursalId ?? '',
      pacienteId: parsed.data.pacienteId,
    },
    {
      consent: parsed.data.pacienteId
        ? { pacienteId: parsed.data.pacienteId, checker: isConsentAccepted }
        : undefined,
      audit: (event) => auditToolEvent(req, event),
    },
  );

  if (!result.ok) {
    res.status(result.status).json({ error: result.error, ...(result.status === 400 && 'details' in result ? { details: result.details } : {}) });
    return;
  }

  res.json(result);
});

export default router;