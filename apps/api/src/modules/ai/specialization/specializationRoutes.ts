import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import { SpecializationService } from './specializationService.js';

const specializationRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'ai-specialization' });

export function createSpecializationRouter(deps: { service?: SpecializationService } = {}): Router {
  const service = deps.service ?? new SpecializationService();
  const router: Router = ExpressRouter();

  router.use(requireAuth, requireSucursalAccess, specializationRateLimit);

  router.get('/', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    const result = await service.listSummaries();
    if (!result.ok) {
      sendError(res, result.status, result.error);
      return;
    }
    await auditSpecialization(req, { operacion: 'list', candidateId: 'catalog', ok: true });
    res.json({
      candidates: result.value.map(({ candidate, latestDecision }) => ({
        id: candidate.id,
        name: candidate.name,
        description: candidate.description,
        kind: candidate.kind,
        dataSource: candidate.dataSource,
        governance: candidate.governance,
        evidenceCriteria: candidate.evidenceCriteria,
        latestDecision: latestDecision ?? null,
      })),
    });
  });

  router.post('/:candidateId/evaluate', async (req: Request, res: Response) => {
    if (!req.user) {
      sendError(res, 401, 'No autenticado');
      return;
    }
    if (!roleSatisfies(req.user.rol, 'admin')) {
      sendError(res, 403, 'Rol insuficiente');
      return;
    }
    const result = await service.evaluate(String(req.params.candidateId));
    if (!result.ok) {
      await auditSpecialization(req, { operacion: 'evaluate', candidateId: String(req.params.candidateId), ok: false });
      sendError(res, result.status, result.error);
      return;
    }
    await auditSpecialization(req, { operacion: 'evaluate', candidateId: result.value.verdict.candidateId, ok: true });
    res.json({ verdict: result.value.verdict, evidence: result.value.evidence });
  });

  return router;
}

async function auditSpecialization(req: Request, event: { operacion: 'list' | 'evaluate'; candidateId: string; ok: boolean }): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), req.sucursalId ?? null)
      .input('profesional_id', sql.UniqueIdentifier(), req.user?.sub ?? null)
      .input('entity_type', sql.NVarChar(60), 'ai_specialization')
      .input('entity_id', sql.UniqueIdentifier(), null)
      .input('operacion', sql.NVarChar(20), event.operacion)
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ candidateId: event.candidateId, ok: event.ok, actor: req.user?.sub }))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[specialization] audit failed:', err instanceof Error ? err.message : err);
  }
}

function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error });
}

export default createSpecializationRouter();