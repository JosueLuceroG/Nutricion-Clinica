import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess, getRequestSucursalId } from '../../tenancy/middleware/requireSucursalAccess.js';
import { readDwhConfig } from '../config.js';
import { resolveScope, assertCanBreakdownByProfessional } from './authorization.js';
import { executeAnalyticsTool, listAnalyticsTools, getAnalyticsTool } from './tools.js';
import { listApprovedMetrics } from '../semantic/catalog.js';
import { computeMetric, comparePeriods } from '../semantic/metricService.js';
import { buildAnalyticsNarrative } from './aiNarrative.js';

/**
 * API analytics sobre el DWH real (Build 08).
 * - rutas SOLO leen del DWH (nunca OLTP crudo);
 * - el cliente pasa métricas/parámetros tipados; el alcance sale del token;
 * - números SIEMPRE disponibles (200 OK); la narrativa AI puede abstenerse.
 */

const router: Router = ExpressRouter();

router.use(requireAuth, requireSucursalAccess);

function assertDwhEnabled(): void {
  if (!readDwhConfig().enabled) {
    const err = new Error('DWH no habilitado (DWH_ENABLED=false)') as Error & { status?: number };
    err.status = 503;
    throw err;
  }
}

function parseDateRange(query: Record<string, unknown>): { from: string; to: string } {
  const from = typeof query.from === 'string' ? query.from : '';
  const to = typeof query.to === 'string' ? query.to : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('from/to requeridos como YYYY-MM-DD');
  }
  return { from, to };
}

router.get('/metrics', (_req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    res.json({ metrics: listApprovedMetrics().map((m) => ({ metricId: m.metricId, name: m.name, description: m.description, metricVersion: m.metricVersion, status: m.status, domain: m.domain })) });
  } catch (err) { next(err); }
});

router.get('/tools', (_req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    res.json({ tools: listAnalyticsTools() });
  } catch (err) { next(err); }
});

router.get('/metrics/:metricId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    const user = req.user!;
    const scope = await resolveScope(user, getRequestSucursalId(req), req.query.all === 'true');
    const { from, to } = parseDateRange(req.query as Record<string, unknown>);
    const metricId = String(req.params.metricId);
    const metric = await computeMetric({ metricId, from, to, scope });
    res.json(metric);
  } catch (err) { next(err); }
});

router.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    const user = req.user!;
    const scope = await resolveScope(user, getRequestSucursalId(req), req.query.all === 'true');
    const q = req.query as Record<string, unknown>;
    const from = typeof q.from === 'string' ? q.from : '';
    const to = typeof q.to === 'string' ? q.to : '';
    const priorFrom = typeof q.priorFrom === 'string' ? q.priorFrom : '';
    const priorTo = typeof q.priorTo === 'string' ? q.priorTo : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !/^\d{4}-\d{2}-\d{2}$/.test(priorFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(priorTo)) {
      throw new Error('from/to/priorFrom/priorTo requeridos como YYYY-MM-DD');
    }
    const metricId = typeof q.metricId === 'string' ? q.metricId : '';
    const result = await comparePeriods({ metricId, from, to, priorFrom, priorTo, scope });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/tools/:toolId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    const toolId = String(req.params.toolId);
    const tool = getAnalyticsTool(toolId);
    if (!tool) {
      res.status(404).json({ error: `herramienta no registrada: ${toolId}` });
      return;
    }
    const user = req.user!;
    const scope = await resolveScope(user, getRequestSucursalId(req), req.query.all === 'true');
    if (toolId === 'breakdown_by_professional') assertCanBreakdownByProfessional(scope);
    const params = { ...(req.query as Record<string, unknown>) };
    const result = await executeAnalyticsTool(toolId, params, scope);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/freshness', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    const tool = getAnalyticsTool('data_freshness')!;
    void tool;
    const { executeAnalyticsTool: exec } = await import('./tools.js');
    const user = _req.user!;
    const scope = await resolveScope(user, getRequestSucursalId(_req));
    const result = await exec('data_freshness', {}, scope);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/narrative/:metricId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertDwhEnabled();
    const user = req.user!;
    const scope = await resolveScope(user, getRequestSucursalId(req), req.query.all === 'true');
    const { from, to } = parseDateRange(req.query as Record<string, unknown>);
    const metricId = String(req.params.metricId);
    const metric = await computeMetric({ metricId, from, to, scope });
    const narrative = buildAnalyticsNarrative({
      metric,
      currentPeriod: `${from}..${to}`,
    });
    res.json({ metric, narrative });
  } catch (err) { next(err); }
});

export default router;