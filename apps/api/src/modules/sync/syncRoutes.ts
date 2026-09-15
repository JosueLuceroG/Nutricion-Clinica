import { Router as ExpressRouter, type Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../tenancy/middleware/requireSucursalAccess.js';
import { getManifest, pullChanges, pushBatch } from './application/syncService.js';
import { canonicalSyncId, isSyncRowVersion, SYNCABLE_ENTITIES, SYNC_OPERATION_CONTRACT, type SyncPullCursors, type SyncPushBatch } from '@nutriclinica/shared';
import { auditLog } from '../../middleware/auditMiddleware.js';

const router: Router = ExpressRouter();

export function requireSyncOperationContract(req: Request, res: Response, next: NextFunction): void {
  if (req.get('X-Sync-Operation-Contract') !== SYNC_OPERATION_CONTRACT) {
    res.status(409).json({
      error: 'SYNC_OPERATION_CONTRACT_MISMATCH',
      required: SYNC_OPERATION_CONTRACT,
    });
    return;
  }
  next();
}

router.get('/manifest', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const manifest = await getManifest();
    res.json(manifest);
  } catch (err) {
    next(err);
  }
});

router.get('/pull', requireAuth, requireSyncOperationContract, requireSucursalAccess, auditLog('read', 'sync_pull'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const branch = z.string().uuid().safeParse(req.sucursalId);
    if (!branch.success) {
      res.status(400).json({ error: 'La sucursal activa debe ser UUID' });
      return;
    }
    const sucursalId = canonicalSyncId(branch.data);
    const sinceParam = typeof req.query.since === 'string' ? req.query.since : null;
    let since: SyncPullCursors | null = null;
    if (sinceParam) {
      try {
        const parsed: unknown = JSON.parse(sinceParam);
        if (parsed === null) {
          since = null;
        } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const entries = Object.entries(parsed as Record<string, unknown>);
          if (entries.some(([entity, cursor]) =>
            !(SYNCABLE_ENTITIES as readonly string[]).includes(entity) || typeof cursor !== 'string')) {
            res.status(400).json({ error: 'since contiene entidades o cursors inválidos' });
            return;
          }
          since = Object.fromEntries(entries) as SyncPullCursors;
        } else {
          res.status(400).json({ error: 'since debe ser un JSON con cursors por entidad o null' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'since debe ser un JSON con cursors por entidad o null' });
        return;
      }
    }
    if (req.query.entities !== undefined && typeof req.query.entities !== 'string') {
      res.status(400).json({ error: 'entities debe ser una lista separada por comas' });
      return;
    }
    const entitiesParam = typeof req.query.entities === 'string' ? req.query.entities : null;
    let entityFilter: (typeof SYNCABLE_ENTITIES)[number][] | null = null;
    if (entitiesParam !== null) {
      const requested = entitiesParam.split(',').map((entity) => entity.trim());
      if (requested.length === 0 || requested.some((entity) =>
        !entity || !(SYNCABLE_ENTITIES as readonly string[]).includes(entity))) {
        res.status(400).json({ error: 'entities contiene valores no sincronizables' });
        return;
      }
      entityFilter = [...new Set(requested)] as (typeof SYNCABLE_ENTITIES)[number][];
    }
    const result = await pullChanges(
      sucursalId,
      since,
      entityFilter,
      { id: req.user.sub, role: req.user.rol },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const UuidSchema = z.string().uuid().transform((value) => canonicalSyncId(value));

const PushOpSchema = z.object({
  operationId: UuidSchema,
  restoreDeleted: z.boolean().optional(),
  entity: z.enum(SYNCABLE_ENTITIES),
  id: UuidSchema,
  op: z.enum(['create', 'update', 'delete']),
  payload: z.unknown(),
  clientUpdatedAt: z.string().datetime(),
  expectedRowVersion: z.string().refine(isSyncRowVersion).optional(),
});

const PushBodySchema = z.object({
  sucursalId: UuidSchema,
  operations: z.array(PushOpSchema).min(1).max(500),
});

router.post('/push', requireAuth, requireSyncOperationContract, requireSucursalAccess, auditLog('sync', 'sync_batch'), async (req: Request, res: Response, next: NextFunction) => {
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
    const activeBranch = z.string().uuid().safeParse(req.sucursalId);
    if (!activeBranch.success) {
      res.status(400).json({ error: 'La sucursal activa debe ser UUID' });
      return;
    }
    const sucursalId = canonicalSyncId(activeBranch.data);
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
