import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireTelemetryRole } from './accessControl.js';
import { buildHealthReport } from './health.js';
import { evaluateAlerts, persistAlerts, readAlertingConfig } from './alerting.js';
import { readTelemetryRetention } from './retention.js';
import { telemetryRecentEvents, observabilitySummary, flushTelemetryAggregates } from './telemetryService.js';
import { selectTelemetryStore } from './telemetryStore.js';

const router: Router = ExpressRouter();

router.use(requireAuth);

function roleGate(req: Request): void {
  requireTelemetryRole(req.user?.rol ?? '');
}

router.get('/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({ summary: observabilitySummary() });
  } catch (err) { next(err); }
});

router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    const limit = Math.min(Number(req.query.limit ?? 50), 500);
    const events = await telemetryRecentEvents(limit);
    res.json({ events });
  } catch (err) { next(err); }
});

router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    const report = await buildHealthReport();
    res.json({ health: report });
  } catch (err) { next(err); }
});

router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    const events = await telemetryRecentEvents(200);
    const cfg = readAlertingConfig();
    const alerts = evaluateAlerts(events, cfg);
    await persistAlerts(alerts);
    res.json({ alerts, config: cfg });
  } catch (err) { next(err); }
});

router.post('/aggregates/flush', async (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    await flushTelemetryAggregates();
    res.json({ flushed: true });
  } catch (err) { next(err); }
});

router.get('/config', (req: Request, res: Response, next: NextFunction) => {
  try {
    roleGate(req);
    res.json({
      store: selectTelemetryStore().kind,
      retention: readTelemetryRetention(),
      percentileMinSamples: Number(process.env.AI_TELEMETRY_PERCENTILE_MIN_SAMPLES ?? 5),
      maxEventBytes: Number(process.env.AI_TELEMETRY_MAX_EVENT_BYTES ?? 2048),
    });
  } catch (err) { next(err); }
});

export default router;