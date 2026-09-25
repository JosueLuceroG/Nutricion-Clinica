import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import type sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { isConsentAccepted, type ConsentChecker } from '../aiConsent.js';
import { loadPortalAccess, parsePortalScopes, recordPortalAudit, type PortalAccessRow } from '../../patientPortal/patientPortalRoutes.js';
import { readPatientAiConfig } from './config.js';
import { PatientWorkflow } from './patientWorkflow.js';

const PortalTokenParam = z
  .string()
  .min(32)
  .max(256)
  .regex(/^[A-Za-z0-9._~-]+$/);

const SupportBody = z
  .object({
    query: z.string().trim().min(1).max(500),
  })
  .strict();

export function createPatientAiRouter(deps: {
  workflow?: PatientWorkflow;
  consentChecker?: ConsentChecker;
  loadAccess?: (pool: sql.ConnectionPool, token: string) => Promise<PortalAccessRow | null>;
  getPool?: () => Promise<sql.ConnectionPool>;
} = {}): Router {
  const router: Router = ExpressRouter();
  const patientRateLimit = rateLimit({ windowMs: 60 * 1000, max: 30, keyPrefix: 'ai-patient' });
  const consentChecker = deps.consentChecker ?? isConsentAccepted;
  const loadAccess = deps.loadAccess ?? loadPortalAccess;
  const acquirePool = deps.getPool ?? getPool;
  const workflow = deps.workflow ?? new PatientWorkflow();

  router.use(patientRateLimit);

  router.post('/:token/support', async (req: Request, res: Response) => {
    const config = readPatientAiConfig();
    if (!config.enabled) {
      res.status(503).json({ error: 'Soporte de IA para pacientes deshabilitado' });
      return;
    }

    const token = PortalTokenParam.safeParse(req.params.token);
    if (!token.success) {
      res.status(404).json({ error: 'Enlace del portal no encontrado' });
      return;
    }

    const parsed = SupportBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Solicitud de soporte invalida', details: parsed.error.flatten() });
      return;
    }

    let pool: sql.ConnectionPool;
    try {
      pool = await acquirePool();
    } catch (err) {
      console.warn('[patient-ai] store unavailable:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen no disponible' });
      return;
    }
    const access = await loadAccess(pool, token.data);
    if (!access) {
      res.status(404).json({ error: 'Enlace del portal no encontrado' });
      return;
    }

    const scopes = new Set(parsePortalScopes(access.scopes_json));
    if (!scopes.has('ai_support')) {
      res.status(403).json({ error: 'Este enlace no permite soporte de IA' });
      return;
    }

    const consent = await consentChecker(access.paciente_id, access.sucursal_id, 'ai_patient');
    if (!consent) {
      res.status(403).json({ error: "Consentimiento 'ai_patient' no otorgado" });
      return;
    }

    const result = await workflow.run({ query: parsed.data.query }, { sucursalId: access.sucursal_id });

    try {
      await recordPortalAudit(pool, {
        tokenId: access.token_id,
        sucursalId: access.sucursal_id,
        pacienteId: access.paciente_id,
        eventType: 'ai_support_requested',
        req,
        details: { status: result.status, queryLength: parsed.data.query.length },
        auditEntityType: 'patient_ai_support',
        auditEntityId: access.token_id,
        auditOperation: 'create',
      });
    } catch (err) {
      console.warn('[patient-ai] audit failed:', err instanceof Error ? err.message : err);
    }

    if (result.status === 'ai_unavailable') {
      res.status(503).json({ error: 'IA no disponible' });
      return;
    }
    res.json({ status: result.status, response: result.response ?? null, envelope: result.envelope });
  });

  return router;
}

export default createPatientAiRouter();