import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import sql from 'mssql';
import { z } from 'zod';
import { getPool } from '../../../db/connection.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { isConsentAccepted, type ConsentChecker } from '../aiConsent.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import { readMemoryConfig } from './config.js';
import { buildMemoryEntry, type MemoryEntry, type MemorySource, type MemoryVisibility } from './memoryTypes.js';
import { selectMemoryStore, type MemoryStore } from './memoryStore.js';
import { emitTelemetry } from '../../observability/telemetryService.js';

const SaveSchema = z
  .object({
    pacienteId: z.string().uuid(),
    content: z.string().min(1).max(500),
    visibility: z.enum(['private', 'shared'] as const).optional(),
    source: z.enum(['ai_conversation', 'professional_note', 'system_observation'] as const).optional(),
  })
  .strict();

const MEMORY_CONSENT_TIPO = 'ai_memory';

async function auditMemory(req: Request, event: { operacion: 'create' | 'delete'; pacienteId?: string; entryId: string }): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), randomUUID())
      .input('sucursal_id', sql.UniqueIdentifier(), req.sucursalId ?? null)
      .input('profesional_id', sql.UniqueIdentifier(), req.user?.sub ?? null)
      .input('entity_type', sql.NVarChar(60), 'ai_memory')
      .input('entity_id', sql.UniqueIdentifier(), event.entryId)
      .input('operacion', sql.NVarChar(20), event.operacion)
      .input('detalles', sql.NVarChar(sql.MAX), JSON.stringify({ ...event, actor: req.user?.sub }))
      .input('ip_address', sql.NVarChar(45), req.ip ?? req.socket.remoteAddress ?? null)
      .input('user_agent', sql.NVarChar(500), req.header('user-agent') ?? null)
      .query(
        `INSERT INTO audit_log (id, sucursal_id, profesional_id, entity_type, entity_id, operacion, detalles, ip_address, user_agent)
         VALUES (@id, @sucursal_id, @profesional_id, @entity_type, @entity_id, @operacion, @detalles, @ip_address, @user_agent)`,
      );
  } catch (err) {
    console.warn('[memory] audit failed:', err instanceof Error ? err.message : err);
  }
}

export function createMemoryRouter(deps: {
  store?: MemoryStore;
  consentChecker?: ConsentChecker;
  now?: () => Date;
} = {}): Router {
  const router: Router = ExpressRouter();
  const memoryRateLimit = rateLimit({ windowMs: 60 * 1000, max: 120, keyPrefix: 'ai-memory' });
  const store = deps.store ?? selectMemoryStore();
  const consentChecker = deps.consentChecker ?? isConsentAccepted;
  const now = deps.now ?? (() => new Date());

  router.use(requireAuth, requireSucursalAccess, memoryRateLimit);

  router.post('/', async (req: Request, res: Response) => {
    const parsed = SaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Entrada de memoria invalida', details: parsed.error.flatten() });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para memoria del paciente' });
      return;
    }

    const config = readMemoryConfig();
    if (!config.enabled) {
      res.status(503).json({ error: 'Memoria deshabilitada' });
      return;
    }

    const sucursalId = req.sucursalId ?? '';
    const consent = await consentChecker(parsed.data.pacienteId, sucursalId, MEMORY_CONSENT_TIPO);
    if (!consent) {
      emitTelemetry({
        eventType: 'memory.access', executionId: `memory-${randomUUID()}`, capability: 'memory',
        status: 'consent_denied', counts: { denied: 1 },
      });
      res.status(403).json({ error: "Consentimiento 'ai_memory' no otorgado" });
      return;
    }

    const entry: MemoryEntry = buildMemoryEntry({
      id: randomUUID(),
      pacienteId: parsed.data.pacienteId,
      sucursalId,
      actorId: req.user.sub,
      content: parsed.data.content,
      visibility: (parsed.data.visibility ?? 'shared') as MemoryVisibility,
      source: (parsed.data.source ?? 'professional_note') as MemorySource,
      now: now(),
      retentionDays: config.retentionDays,
    });

    try {
      await store.save(entry);
      await store.purgeExpired(now());
    } catch (err) {
      console.warn('[memory] save failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de memoria no disponible' });
      return;
    }

    await auditMemory(req, { operacion: 'create', pacienteId: entry.pacienteId, entryId: entry.id });
    emitTelemetry({
      eventType: 'memory.access', executionId: `memory-${randomUUID()}`, capability: 'memory',
      status: 'created', counts: { created: 1 },
    });
    res.json({ entry });
  });

  router.get('/:pacienteId', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para memoria del paciente' });
      return;
    }

    const config = readMemoryConfig();
    if (!config.enabled) {
      res.status(503).json({ error: 'Memoria deshabilitada' });
      return;
    }

    const sucursalId = req.sucursalId ?? '';
    const consent = await consentChecker(String(req.params.pacienteId), sucursalId, MEMORY_CONSENT_TIPO);
    if (!consent) {
      emitTelemetry({
        eventType: 'memory.access', executionId: `memory-${randomUUID()}`, capability: 'memory',
        status: 'consent_denied', counts: { denied: 1 },
      });
      res.status(403).json({ error: "Consentimiento 'ai_memory' no otorgado" });
      return;
    }

    try {
      const entries = await store.list({ pacienteId: String(req.params.pacienteId), sucursalId, actorId: req.user.sub, now: now() });
      emitTelemetry({
        eventType: 'memory.access', executionId: `memory-${randomUUID()}`, capability: 'memory',
        status: 'listed', counts: { listed: entries.length },
      });
      res.json({ entries: entries.slice(0, config.maxEntries) });
    } catch (err) {
      console.warn('[memory] list failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de memoria no disponible' });
      return;
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para memoria del paciente' });
      return;
    }

    const config = readMemoryConfig();
    if (!config.enabled) {
      res.status(503).json({ error: 'Memoria deshabilitada' });
      return;
    }

    const sucursalId = req.sucursalId ?? '';
    let entry: MemoryEntry | undefined;
    try {
      entry = await store.get(String(req.params.id));
    } catch (err) {
      console.warn('[memory] delete lookup failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de memoria no disponible' });
      return;
    }
    if (!entry || entry.sucursalId !== sucursalId) {
      res.status(404).json({ error: 'Entrada de memoria no encontrada' });
      return;
    }
    if (entry.actorId !== req.user.sub && !roleSatisfies(req.user.rol, 'admin')) {
      res.status(403).json({ error: 'Solo el autor o un admin pueden eliminar esta entrada' });
      return;
    }

    try {
      await store.delete(entry.id);
    } catch (err) {
      console.warn('[memory] delete failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de memoria no disponible' });
      return;
    }

    await auditMemory(req, { operacion: 'delete', pacienteId: entry.pacienteId, entryId: entry.id });
    res.json({ deleted: true });
  });

  return router;
}

export default createMemoryRouter();