import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../../middleware/rateLimit.js';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { roleSatisfies } from '../ai/tools/toolAuthorization.js';
import { getMetric, listDimensions, listMetrics } from './catalog.js';
import { readDwhConfig } from './config.js';
import { selectDwhStore } from './dwhStore.js';
import type { DwhStore, MetricSnapshot } from './dwhTypes.js';
import { runIncrementalLoad, type DailyMetricSource } from './etl.js';
import { computeFreshness } from './freshness.js';
import { sqlDailyMetricSource } from './sqlDailyMetricSource.js';

const SeriesQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export function createAnalyticsRouter(deps: {
  store?: DwhStore;
  source?: DailyMetricSource;
  now?: () => Date;
} = {}): Router {
  const router: Router = ExpressRouter();
  const analyticsRateLimit = rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'dwh' });
  const store = deps.store ?? selectDwhStore();
  const source = deps.source ?? sqlDailyMetricSource;
  const now = deps.now ?? (() => new Date());

  function gate(_req: Request, res: Response): boolean {
    const config = readDwhConfig();
    if (!config.enabled) {
      res.status(503).json({ error: 'DWH deshabilitado' });
      return false;
    }
    return true;
  }

  router.use(requireAuth, requireSucursalAccess, analyticsRateLimit);

  router.get('/catalog', (_req: Request, res: Response) => {
    if (!gate(_req, res)) return;
    res.json({
      dimensions: listDimensions(),
      metrics: listMetrics().map((metric) => ({
        id: metric.id,
        name: metric.name,
        description: metric.description,
        aggregation: metric.aggregation,
        unit: metric.unit,
        source: metric.source,
      })),
    });
  });

  router.get('/freshness', async (req: Request, res: Response) => {
    if (!gate(req, res)) return;
    const config = readDwhConfig();
    try {
      const freshness = await computeFreshness({
        store,
        now: now(),
        maxAgeMs: config.maxFreshnessDays * 24 * 60 * 60 * 1000,
      });
      res.json({ freshness });
    } catch (err) {
      console.warn('[dwh] freshness failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen DWH no disponible' });
    }
  });

  router.get('/runs', async (req: Request, res: Response) => {
    if (!gate(req, res)) return;
    try {
      const runs = await store.listLoadRuns(20);
      res.json({ runs });
    } catch (err) {
      console.warn('[dwh] runs failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen DWH no disponible' });
    }
  });

  router.get('/metrics/:metricId', async (req: Request, res: Response) => {
    if (!gate(req, res)) return;
    const metric = getMetric(String(req.params.metricId));
    if (!metric) {
      res.status(404).json({ error: 'Metrica no existe en el catalogo' });
      return;
    }
    const parsed = SeriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Filtros de serie invalidos', details: parsed.error.flatten() });
      return;
    }

    const from = parsed.data.from ?? '1970-01-01';
    const to = parsed.data.to ?? now().toISOString().slice(0, 10);

    try {
      const snapshots: MetricSnapshot[] = await store.listSnapshots({ metricId: metric.id });
      const series = snapshots
        .filter((snapshot) => snapshot.dimensionKey >= from && snapshot.dimensionKey <= to)
        .sort((a, b) => a.dimensionKey.localeCompare(b.dimensionKey))
        .map((snapshot) => ({
          date: snapshot.dimensionKey,
          value: snapshot.value,
          sourceRunId: snapshot.sourceRunId,
          loadedAt: snapshot.loadedAt,
        }));
      res.json({ metric, series });
    } catch (err) {
      console.warn('[dwh] series failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen DWH no disponible' });
    }
  });

  router.post('/load', async (req: Request, res: Response) => {
    if (!gate(req, res)) return;
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roleSatisfies(req.user.rol, 'admin')) {
      res.status(403).json({ error: 'Solo admin puede disparar cargas DWH' });
      return;
    }

    const config = readDwhConfig();
    try {
      const run = await runIncrementalLoad({
        store,
        source,
        sucursalId: req.sucursalId ?? '',
        now: now(),
        windowDays: config.loadWindowDays,
        runId: randomUUID(),
      });
      await store.saveLoadRun(run);
      res.json({ run });
    } catch (err) {
      console.warn('[dwh] load failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Carga DWH fallo' });
    }
  });

  return router;
}

export default createAnalyticsRouter();