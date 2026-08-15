import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { getManifest, pullChanges, pushBatch } from './application/syncService.js';
import { SYNCABLE_ENTITIES, type SyncPullCursors, type SyncPushBatch } from '@nutriclinica/shared';
import { auditLog } from '../../middleware/auditMiddleware.js';

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
    let since: SyncPullCursors | null = null;
    if (sinceParam) {
      try {
        const parsed: unknown = JSON.parse(sinceParam);
        if (parsed === null) {
          since = null;
        } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          since = parsed as SyncPullCursors;
        } else {
          res.status(400).json({ error: 'since debe ser un JSON con cursors por entidad o null' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'since debe ser un JSON con cursors por entidad o null' });
        return;
      }
    }
    const entitiesParam = typeof req.query.entities === 'string' ? req.query.entities : null;
    const entityFilter = entitiesParam
      ? (entitiesParam.split(',').filter((e): e is (typeof SYNCABLE_ENTITIES)[number] => (SYNCABLE_ENTITIES as readonly string[]).includes(e)) as (typeof SYNCABLE_ENTITIES)[number][])
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

router.post('/push', requireAuth, requireSucursalAccess, auditLog('sync', 'sync_batch'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = PushBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Batch de sincronización inválido', details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data as SyncPushBatch;
    const sucursalId = String(req.sucursalId);
    if (body.sucursalId !== sucursalId) {
      res.status(400).json({ error: 'sucursalId del body debe coincidir con la sucursal activa' });
      return;
    }
    const result = await pushBatch({ ...body, sucursalId }, { id: req.user.sub, role: req.user.rol });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
