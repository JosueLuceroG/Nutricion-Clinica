import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { canAccessTelemetry } from '../observability/accessControl.js';
import { evaluateShadowPrerequisites } from './shadowPrerequisites.js';
import { runShadow } from './shadowRunner.js';
import { canTransition, type ShadowState, type ShadowTransitionKind } from './shadowStateMachine.js';
import { validatesReviewInput, type ShadowReviewInput } from './shadowReview.js';
import { evaluateAutoDisable, readShadowAutoDisableConfig, type ShadowReviewMetric } from './shadowAutoDisable.js';
import { emitTelemetry } from '../observability/telemetryService.js';

/**
 * API del shadow (Build 09). Rutas de administracion: admin/auditor/soporte_tecnico.
 * Rutas de revision: profesionales con rol clinico autorizado (reviewer scope).
 * Las transiciones de estado las ejecuta el SERVIDOR; el cliente solo las solicita.
 */

const router: Router = ExpressRouter();

router.use(requireAuth);

function adminGate(req: Request): void {
  if (!canAccessTelemetry(req.user?.rol ?? '')) {
    const err = new Error('no autorizado para shadow') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

router.get('/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    adminGate(req);
    res.json({ readiness: await evaluateShadowPrerequisites() });
  } catch (err) { next(err); }
});

router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    adminGate(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const executionId = typeof body.executionId === 'string' && body.executionId ? body.executionId : `shadow-${randomUUID()}`;
    const capability = typeof body.capability === 'string' ? body.capability : 'unknown';
    const riskLevel = typeof body.riskLevel === 'string' ? body.riskLevel : 'unknown';
    const executionModel = typeof body.executionModel === 'string' ? body.executionModel : '';
    const result = await runShadow({
      executionId,
      correlationId: typeof body.correlationId === 'string' ? body.correlationId : undefined,
      capability,
      riskLevel,
      executionModel,
      executionPrompt: '',
      promptVersion: typeof body.promptVersion === 'string' ? body.promptVersion : 'n/a',
      toolsetVersion: typeof body.toolsetVersion === 'string' ? body.toolsetVersion : 'n/a',
      policyVersion: typeof body.policyVersion === 'string' ? body.policyVersion : 'n/a',
      outputSchemaVersion: typeof body.outputSchemaVersion === 'string' ? body.outputSchemaVersion : 'n/a',
      knowledgePolicyVersion: typeof body.knowledgePolicyVersion === 'string' ? body.knowledgePolicyVersion : 'n/a',
      memoryPolicyVersion: typeof body.memoryPolicyVersion === 'string' ? body.memoryPolicyVersion : 'n/a',
      catalogVersion: typeof body.catalogVersion === 'string' ? body.catalogVersion : 'n/a',
      evalDatasetVersion: typeof body.evalDatasetVersion === 'string' ? body.evalDatasetVersion : 'n/a',
      cohortKey: typeof body.cohortKey === 'string' && body.cohortKey ? body.cohortKey : 'engineering-golden',
    });
    res.json({ result });
  } catch (err) { next(err); }
});

router.post('/transition', (req: Request, res: Response, next: NextFunction) => {
  try {
    adminGate(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const from = (body.from ?? null) as ShadowState | null;
    const to = body.to as ShadowState;
    const kind = (body.kind ?? 'manual') as ShadowTransitionKind;
    const decision = canTransition(from, to, kind);
    if (!decision.allowed) {
      res.status(409).json({ allowed: false, reason: decision.reason });
      return;
    }
    emitTelemetry({
      eventType: 'shadow.state_transition',
      executionId: `state-${to}-${Date.now()}`,
      status: 'transitioned',
      reasonCode: decision.reason,
      capability: 'shadow',
      versionBundle: undefined,
    });
    res.json({ allowed: true, from, to, kind });
  } catch (err) { next(err); }
});

router.post('/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    adminGate(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const input: ShadowReviewInput = {
      shadowRunId: Number(body.shadowRunId),
      reviewerKey: String(body.reviewerKey ?? ''),
      reviewerSucursalId: String(body.reviewerSucursalId ?? ''),
      label: body.label as ShadowReviewInput['label'],
      criticalDisagreement: Boolean(body.criticalDisagreement),
      unsafe: Boolean(body.unsafe),
      evidenceSuffient: body.evidenceSufficient === undefined ? undefined : Boolean(body.evidenceSufficient),
      citationValid: body.citationValid === undefined ? undefined : Boolean(body.citationValid),
      commentRef: typeof body.commentRef === 'string' ? body.commentRef.slice(0, 500) : undefined,
    };
    const check = validatesReviewInput(input);
    if (!check.ok) {
      res.status(400).json({ error: check.reason });
      return;
    }
    emitTelemetry({
      eventType: 'shadow.review',
      executionId: `review-${input.shadowRunId}-${Date.now()}`,
      status: input.criticalDisagreement ? 'critical_disagreement' : input.unsafe ? 'unsafe' : 'reviewed',
      capability: 'shadow',
    });
    res.json({ accepted: true, review: input });
  } catch (err) { next(err); }
});

router.get('/autodisable/check', (req: Request, res: Response, next: NextFunction) => {
  try {
    adminGate(req);
    const samples = Array.isArray(req.query.samples)
      ? (req.query.samples as unknown as ShadowReviewMetric[])
      : (req.query.samples ? [req.query.samples as unknown as ShadowReviewMetric] : []);
    const decision = evaluateAutoDisable(samples, readShadowAutoDisableConfig());
    res.json({ decision });
  } catch (err) { next(err); }
});

router.get('/eligibility/:model', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    adminGate(_req);
    const { resolveShadowModel } = await import('./shadowGate.js');
    const result = resolveShadowModel(String(_req.params.model));
    res.json({ gate: result });
  } catch (err) { next(err); }
});

export default router;