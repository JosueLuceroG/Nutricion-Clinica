import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { getManifest, pullChanges, pushBatch } from './application/syncService.js';
import { SYNCABLE_ENTITIES, type SyncPushBatch } from '@nutriclinica/shared';

const router: Router = ExpressRouter();

router.get('/manifest', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const manifest = await getManifest();
    res.json(manifest);
  } catch (err) {
    next(err);
  }
});

router.get('/pull', requireAuth, requireSucursalAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sucursalId = String(req.sucursalId);
    const sinceParam = typeof req.query.since === 'string' ? req.query.since : null;
    const since = sinceParam ? new Date(sinceParam) : new Date(0);
    if (isNaN(since.getTime())) {
      res.status(400).json({ error: 'since debe ser ISO 8601 timestamp' });
      return;
    }
    const entitiesParam = typeof req.query.entities === 'string' ? req.query.entities : null;
    const entityFilter = entitiesParam
      ? (entitiesParam.split(',').filter((e): e is typeof SYNCABLE_ENTITIES[number] =>
          (SYNCABLE_ENTITIES as readonly string[]).includes(e)) as typeof SYNCABLE_ENTITIES[number][])
      : null;
    const result = await pullChanges(sucursalId, since, entityFilter);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const PushOpSchema = z.object({
  entity: z.enum(SYNCABLE_ENTITIES),
  id: z.string().uuid(),
  op: z.enum(['create', 'update', 'delete']),
  payload: z.unknown(),
  clientUpdatedAt: z.string().datetime(),
  expectedRowVersion: z.string().optional(),
});

const PushBodySchema = z.object({
  sucursalId: z.string().uuid(),
  operations: z.array(PushOpSchema).min(1).max(500),
});

router.post('/push', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = PushBodySchema.parse(req.body) as SyncPushBatch;
    if (req.user.rol !== 'admin' && !req.user.sucursalIds.includes(body.sucursalId)) {
      res.status(403).json({ error: 'No tienes acceso a esa sucursal' });
      return;
    }
    const result = await pushBatch(body, req.user.sub);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
