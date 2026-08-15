import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type sql from 'mssql';
import type { GatewayResult } from '../aiGateway.js';
import { InMemoryKnowledgeDocStore, type KnowledgeDoc } from '../rag/knowledgeGovernance.js';
import type { PortalAccessRow } from '../../patientPortal/patientPortalRoutes.js';
import { createPatientAiRouter } from './patientRoutes.js';
import { PatientWorkflow } from './patientWorkflow.js';

const TOKEN = 'portal-token-0123456789abcdef0123456789abcdef';
const DOC_ID = '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routeHandlers(router: ReturnType<typeof createPatientAiRouter>, path: string, method: string) {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? [];
}

function makeResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    body: {},
    header: vi.fn(),
    get: vi.fn(),
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function portalAccess(overrides: Partial<PortalAccessRow> = {}): PortalAccessRow {
  return {
    token_id: 'token-id-1',
    sucursal_id: 'suc-1',
    paciente_id: 'pac-1',
    expires_at: new Date('2099-01-01T00:00:00.000Z'),
    scopes_json: '["ai_support"]',
    nombres: 'Ana',
    apellido_paterno: 'Lopez',
    apellido_materno: null,
    fecha_nacimiento: new Date('1990-01-01T00:00:00.000Z'),
    sexo: 'femenino',
    email: null,
    telefono: null,
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function educationalDoc(): KnowledgeDoc {
  return {
    id: DOC_ID,
    sucursalId: null,
    title: 'Fruta y desayuno saludable',
    category: 'educacion',
    tier: 'educational',
    content: 'Incluir una porcion de fruta en el desayuno ayuda a una alimentacion equilibrada.',
    status: 'approved',
    allowedRoles: ['nutriologa', 'admin', 'asistente'],
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

function adviceWorkflow(): PatientWorkflow {
  const store = new InMemoryKnowledgeDocStore();
  void store.save(educationalDoc());
  return new PatientWorkflow({
    knowledgeStore: store,
    completeAi: async (): Promise<GatewayResult> => ({
      ok: true,
      provider: 'ollama',
      model: 'llama3.2',
      result: { content: `La fruta es una buena opcion en el desayuno [${DOC_ID}].`, model: 'llama3.2', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } },
      attempts: [],
    }),
  });
}

function failingPool(): () => Promise<sql.ConnectionPool> {
  return async () =>
    ({
      request: () => ({
        input: () => ({
          query: async () => {
            throw new Error('fake db down');
          },
        }),
      }),
    }) as unknown as sql.ConnectionPool;
}

describe('patient AI routes', () => {
  beforeEach(() => {
    vi.stubEnv('AI_PATIENT_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled by kill switch with 503', async () => {
    vi.stubEnv('AI_PATIENT_ENABLED', 'false');
    const router = createPatientAiRouter();
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'que fruta comer?' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('rejects invalid bodies with 400', async () => {
    const router = createPatientAiRouter();
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: {} }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for unknown or malformed portal tokens', async () => {
    const router = createPatientAiRouter({ loadAccess: async () => null, getPool: failingPool() });
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;

    const missing = makeResponse();
    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'hola' } }), missing, vi.fn());
    expect(missing.status).toHaveBeenCalledWith(404);

    const malformed = makeResponse();
    await controller(baseReq({ params: { token: 'corto' }, body: { query: 'hola' } }), malformed, vi.fn());
    expect(malformed.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 when the portal link lacks the ai_support scope', async () => {
    const router = createPatientAiRouter({
      loadAccess: async () => portalAccess({ scopes_json: '["summary"]' }),
      getPool: failingPool(),
    });
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'que fruta comer?' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 without the ai_patient consent', async () => {
    const router = createPatientAiRouter({
      loadAccess: async () => portalAccess(),
      consentChecker: async () => false,
      getPool: failingPool(),
    });
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'que fruta comer?' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('serves educational advice on the happy path', async () => {
    const router = createPatientAiRouter({
      workflow: adviceWorkflow(),
      loadAccess: async () => portalAccess(),
      consentChecker: async () => true,
      getPool: failingPool(),
    });
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'que fruta comer?' } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { status: string; envelope: { kind: string; sources: unknown[] } };
    expect(payload.status).toBe('advice');
    expect(payload.envelope.kind).toBe('patient_support');
    expect(payload.envelope.sources).toHaveLength(1);
  });

  it('maps ai_unavailable to 503', async () => {
    const store = new InMemoryKnowledgeDocStore();
    void store.save(educationalDoc());
    const router = createPatientAiRouter({
      workflow: new PatientWorkflow({
        knowledgeStore: store,
        completeAi: async (): Promise<GatewayResult> => ({ ok: false, status: 503, message: 'IA no configurada', attempts: [] }),
      }),
      loadAccess: async () => portalAccess(),
      consentChecker: async () => true,
      getPool: failingPool(),
    });
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'que fruta comer?' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 503 when the store is unavailable', async () => {
    const router = createPatientAiRouter({
      loadAccess: async () => portalAccess(),
      consentChecker: async () => true,
      getPool: async () => {
        throw new Error('db down');
      },
    });
    const controller = routeHandlers(router, '/:token/support', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { token: TOKEN }, body: { query: 'que fruta comer?' } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });
});