import { randomUUID } from 'node:crypto';
import { Router as ExpressRouter, type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { requireAuth } from '../../auth/middleware/requireAuth.js';
import { requireSucursalAccess } from '../../tenancy/middleware/requireSucursalAccess.js';
import { roleSatisfies } from '../tools/toolAuthorization.js';
import { approveDoc, selectKnowledgeDocStore, type KnowledgeDocStore } from './knowledgeGovernance.js';
import { retrieve } from './retrieval.js';

const TIER_ENUM = ['clinical_guideline', 'institutional_protocol', 'peer_reviewed', 'educational', 'unverified'] as const;
const ROLE_ENUM = ['admin', 'nutriologa', 'asistente', 'soporte_tecnico', 'auditor', 'facturacion'] as const;

const DocumentSchema = z
  .object({
    title: z.string().min(1).max(300),
    category: z.string().min(1).max(100),
    tier: z.enum(TIER_ENUM),
    content: z.string().min(1).max(20000),
    expiresAt: z.string().datetime().optional(),
    allowedRoles: z.array(z.enum(ROLE_ENUM)).min(1).max(6),
  })
  .strict();

const RetrieveSchema = z
  .object({
    query: z.string().min(1).max(500),
    topK: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export function createRagRouter(deps: {
  store?: KnowledgeDocStore;
  now?: () => Date;
} = {}): Router {
  const router: Router = ExpressRouter();
  const ragRateLimit = rateLimit({ windowMs: 60 * 1000, max: 60, keyPrefix: 'ai-rag' });
  const store = deps.store ?? selectKnowledgeDocStore();
  const now = deps.now ?? (() => new Date());

  router.use(requireAuth, requireSucursalAccess, ragRateLimit);

  router.post('/documents', async (req: Request, res: Response) => {
    const parsed = DocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Documento invalido', details: parsed.error.flatten() });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para gestionar documentos' });
      return;
    }

    const doc = {
      id: randomUUID(),
      sucursalId: req.sucursalId ?? null,
      title: parsed.data.title,
      category: parsed.data.category,
      tier: parsed.data.tier,
      content: parsed.data.content,
      status: 'draft' as const,
      expiresAt: parsed.data.expiresAt,
      allowedRoles: parsed.data.allowedRoles,
      createdAt: now().toISOString(),
    };

    try {
      await store.save(doc);
    } catch (err) {
      console.warn('[rag] document save failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de documentos no disponible' });
      return;
    }

    res.json({ id: doc.id, status: doc.status });
  });

  router.post('/documents/:id/approve', async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (req.user.rol !== 'admin') {
      res.status(403).json({ error: 'Solo admin puede aprobar documentos' });
      return;
    }

    let doc;
    try {
      doc = await store.get(String(req.params.id));
    } catch (err) {
      console.warn('[rag] document lookup failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Almacen de documentos no disponible' });
      return;
    }
    if (!doc) {
      res.status(404).json({ error: 'Documento no encontrado' });
      return;
    }
    if (doc.status !== 'draft') {
      res.status(409).json({ error: `El documento ya no es un borrador (${doc.status})` });
      return;
    }

    let approved;
    try {
      approved = approveDoc(doc, { by: req.user.sub, now: now() });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Vigencia invalida' });
      return;
    }
    await store.save(approved);

    res.json({ id: approved.id, status: approved.status, approvedAt: approved.approvedAt, approvedBy: approved.approvedBy });
  });

  router.post('/retrieve', async (req: Request, res: Response) => {
    const parsed = RetrieveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Consulta de retrieval invalida', details: parsed.error.flatten() });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roleSatisfies(req.user.rol, 'nutriologa')) {
      res.status(403).json({ error: 'Rol sin permiso para retrieval' });
      return;
    }

    let sources;
    try {
      sources = await retrieve({
        store,
        query: parsed.data.query,
        topK: parsed.data.topK,
        now: now(),
        actor: { role: req.user.rol, sucursalId: req.sucursalId ?? '' },
      });
    } catch (err) {
      console.warn('[rag] retrieve failed:', err instanceof Error ? err.message : err);
      res.status(503).json({ error: 'Retrieval no disponible' });
      return;
    }

    res.json({ query: parsed.data.query, sources });
  });

  return router;
}

export default createRagRouter();