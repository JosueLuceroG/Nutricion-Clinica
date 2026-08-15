import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { isConsentAccepted, type ConsentChecker } from '../aiConsent.js';
import { ClinicalAutoDisable } from '../clinicalGate/autoDisable.js';
import { classifyComparison, COMPARISON_VERDICTS, type ComparisonVerdict } from '../clinicalGate/comparison.js';
import { readClinicalGateConfig } from '../clinicalGate/config.js';
import { selectClinicalReviewStore, type ClinicalReviewStore } from '../clinicalGate/reviewStore.js';
import { shadowMode, type ShadowMode } from '../clinicalGate/shadowMode.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import { readMemoryConfig } from '../memory/config.js';
import { selectMemoryStore, type MemoryStore } from '../memory/memoryStore.js';
import type { MemoryEntry } from '../memory/memoryTypes.js';
import type { EvidenceEnvelope } from './evidenceEnvelope.js';
import { NutritionWorkflow, type NutritionAdviceResult, type NutritionWorkflow as NutritionWorkflowType } from './nutritionWorkflow.js';

const AdviceSchema = z
  .object({
    pacienteId: z.string().uuid(),
    goal: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const ReviewSchema = z
  .object({
    shadowRunId: z.string().uuid(),
    verdict: z.enum(COMPARISON_VERDICTS as unknown as [ComparisonVerdict, ...ComparisonVerdict[]]),
    notes: z.string().max(1000).optional(),
  })
  .strict();

async function auditAdvice(req: Request, event: { status: NutritionAdviceResult['status']; pacienteId: string; actor: string; envelope: EvidenceEnvelope }): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), event.envelope.patient.sucursalId)
      .input('profesional_id', sql.UniqueIdentifier(), event.actor)
      .input('entity_type', sql.NVarChar(60), 'ai_advice')
      .input('operacion', sql.NVarChar(20), 'generate')
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify(event))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, NULL, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[expert] audit failed:', err instanceof Error ? err.message : err);
  }
}

function sendResult(res: Response, result: NutritionAdviceResult): void {
  if (result.status === 'ai_unavailable') {
    res.status(503).json({ error: 'IA no disponible' });
    return;
  }
  res.json({ status: result.status, advice: result.advice ?? null, envelope: result.envelope });
}

export function createExpertRouter(deps: {
  workflow?: NutritionWorkflowType;
  consentChecker?: ConsentChecker;
  store?: ClinicalReviewStore;
  autoDisable?: ClinicalAutoDisable;
  shadowModeRunner?: ShadowMode;
  memoryStore?: MemoryStore;
} = {}): Router {
  const router: Router = ExpressRouter();
  const expertRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'ai-expert' });
  const consentChecker = deps.consentChecker ?? isConsentAccepted;
  const store = deps.store ?? selectClinicalReviewStore();
  const gate = deps.autoDisable ?? new ClinicalAutoDisable(store);
  const shadowRunner = deps.shadowModeRunner ?? shadowMode;
  const memoryStore = deps.memoryStore ?? selectMemoryStore();
  const workflow = deps.workflow ?? new NutritionWorkflow({
    memoryRetriever: async (input): Promise<MemoryEntry[]> => {
      const config = readMemoryConfig();
      if (!config.enabled) return [];
      const consent = await consentChecker(input.pacienteId, input.sucursalId, 'ai_memory');
      if (!consent) return [];
      try {
        const entries = await memoryStore.list({ pacienteId: input.pacienteId, sucursalId: input.sucursalId, actorId: input.actor.profesionalId, now: new Date() });
        return entries.slice(0, config.maxEntries);
      } catch (err) {
        console.warn('[expert] memory retrieval failed:', err instanceof Error ? err.message : err);
        return [];
      }
    },
  });

  async function gateCheck(res: Response, sucursalId: string): Promise<boolean> {
    const config = readClinicalGateConfig();
    if (!config.expertEnabled) {
      res.status(503).json({ error: 'Expert deshabilitado' });
      return false;
    }
    if (await gate.isAutoDisabled(sucursalId)) {
      res.status(503).json({ error: 'Expert deshabilitado por revision clinica' });
      return false;
    }
    return true;
  }

  router.use(requireAuth, requireSucursalAccess, expertRateLimit);

  router.post('/advice', async (req: Request, res: Response) => {
    const parsed = AdviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Solicitud de consejo invalida', details: parsed.error.flatten() });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const sucursalId = req.sucursalId ?? '';
    if (!(await gateCheck(res, sucursalId))) return;

    const consent = await consentChecker(parsed.data.pacienteId, sucursalId, 'ai_opt_in');
    if (!consent) {
      res.status(403).json({ error: "Consentimiento 'ai_opt_in' no otorgado" });
      return;
    }

    const result = await workflow.run(
      {
        pacienteId: parsed.data.pacienteId,
        sucursalId,
        goal: parsed.data.goal,
        notes: parsed.data.notes,
      },
      { profesionalId: req.user.sub, role: req.user.rol },
    );

    await auditAdvice(req, {
      status: result.status,
      pacienteId: parsed.data.pacienteId,
      actor: req.user.sub,
      envelope: result.envelope,
    });

    const config = readClinicalGateConfig();
    if (config.shadowModeEnabled && result.status !== 'ai_unavailable') {
      const run = await shadowRunner.run(
        {
          pacienteId: parsed.data.pacienteId,
          sucursalId,
          goal: parsed.data.goal,
          notes: parsed.data.notes,
        },
        { profesionalId: req.user.sub, role: req.user.rol },
        { served: true },
      );
      if (run) {
        try {
          await store.saveShadowRun(run);
        } catch (err) {
          console.warn('[expert] shadow save failed:', err instanceof Error ? err.message : err);
        }
      }
    }

    sendResult(res, result);
  });

  router.post('/shadow', async (req: Request, res: Response) => {
    const parsed = AdviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Solicitud de shadow invalida', details: parsed.error.flatten() });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para shadow mode' });
      return;
    }

    const sucursalId = req.sucursalId ?? '';
    if (!(await gateCheck(res, sucursalId))) return;

    const consent = await consentChecker(parsed.data.pacienteId, sucursalId, 'ai_opt_in');
    if (!consent) {
      res.status(403).json({ error: "Consentimiento 'ai_opt_in' no otorgado" });
      return;
    }

    const run = await shadowRunner.run(
      {
        pacienteId: parsed.data.pacienteId,
        sucursalId,
        goal: parsed.data.goal,
        notes: parsed.data.notes,
      },
      { profesionalId: req.user.sub, role: req.user.rol },
      { served: false, force: true },
    );

    if (!run) {
      res.status(503).json({ error: 'IA no disponible' });
      return;
    }

    try {
      await store.saveShadowRun(run);
    } catch (err) {
      console.warn('[expert] shadow save failed:', err instanceof Error ? err.message : err);
    }

    res.json({ status: 'shadow', runId: run.id, result: run.result });
  });

  router.post('/review', async (req: Request, res: Response) => {
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Revision clinica invalida', details: parsed.error.flatten() });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para revision clinica' });
      return;
    }

    const sucursalId = req.sucursalId ?? '';
    let run;
    try {
      run = await store.getShadowRun(parsed.data.shadowRunId);
    } catch (err) {
      console.warn('[expert] shadow lookup failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de revision no disponible' });
      return;
    }
    if (!run || run.sucursalId !== sucursalId) {
      res.status(404).json({ error: 'Run de shadow no encontrado' });
      return;
    }

    const classification = classifyComparison({ verdict: parsed.data.verdict, served: run.served });
    await store.saveComparison({
      id: randomUUID(),
      shadowRunId: run.id,
      professionalId: req.user.sub,
      sucursalId,
      reviewedAt: new Date().toISOString(),
      verdict: parsed.data.verdict,
      notes: parsed.data.notes,
    });

    const autoDisabled = await gate.isAutoDisabled(sucursalId);
    res.json({
      critical: classification.isCritical,
      reason: classification.reason,
      autoDisabled,
    });
  });

  return router;
}

export default createExpertRouter();