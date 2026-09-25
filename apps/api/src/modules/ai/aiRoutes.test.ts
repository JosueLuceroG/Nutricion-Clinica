import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import router, { mapOpenAiResponse, resolveOpenAiApiKey } from './aiRoutes.js';
import { clinicalCertificationRegistry } from './certification/clinicalCertification.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: ExpressLayerLike[];
  };
}

function routerStack(): ExpressLayerLike[] {
  return (router as unknown as { stack: ExpressLayerLike[] }).stack;
}

function routeHandlers(path: string, method: string) {
  return routerStack()
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

const validBody = {
  model: 'gpt-4o-mini',
  systemPrompt: 'Eres un nutricionista',
  userPrompt: 'Resume la consulta',
  maxTokens: 300,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubEnv('AI_MODEL_MODE', 'ORGANIZATION_PREFERRED');
  clinicalCertificationRegistry.clearRequalificationRequired('openai', 'gpt-4o-mini', 'chat_general');
  clinicalCertificationRegistry.clearRequalificationRequired('ollama', 'llama3.2', 'chat_general');
});

describe('aiRoutes', () => {
  it('resolves only server-side AI API keys', () => {
    expect(resolveOpenAiApiKey({ OPENAI_API_KEY: 'server-key', VITE_AI_API_KEY: 'client-key' } as NodeJS.ProcessEnv)).toBe('server-key');
    expect(resolveOpenAiApiKey({ AI_API_KEY: 'generic-key' } as NodeJS.ProcessEnv)).toBe('generic-key');
    expect(resolveOpenAiApiKey({ VITE_AI_API_KEY: 'client-key' } as NodeJS.ProcessEnv)).toBe('');
  });

  it('maps OpenAI response without leaking provider payload shape', () => {
    const mapped = mapOpenAiResponse({
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      model: 'gpt-test',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }, 'fallback-model');

    expect(mapped).toEqual({
      content: '{"ok":true}',
      model: 'gpt-test',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it('preserves the configured Ollama model in the public response', () => {
    const mapped = mapOpenAiResponse({
      choices: [{ message: { content: '{"name":"KPI"}' }, finish_reason: 'stop' }],
      model: 'llama3.2:latest',
    }, 'llama3.2');

    expect(mapped.model).toBe('llama3.2:latest');
  });

  it('requires auth and branch access before AI routes', () => {
    const firstRouteIndex = routerStack().findIndex((layer) => layer.route);
    const middlewareNames = routerStack().slice(0, firstRouteIndex).map((layer) => layer.handle?.name);

    expect(middlewareNames).toContain('requireAuth');
    expect(middlewareNames).toContain('requireSucursalAccess');
    expect(middlewareNames.indexOf('requireAuth')).toBeLessThan(middlewareNames.indexOf('requireSucursalAccess'));
  });

  it('rejects invalid complete requests before provider calls', async () => {
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: { systemPrompt: '', userPrompt: '' } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Solicitud IA invalida' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects client-supplied API keys as unknown fields (strict schema)', async () => {
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: { ...validBody, apiKey: 'sk-client-supplied' } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects client overrides of risk/review/certification fields (spec 67: server authoritative)', async () => {
    const controller = routeHandlers('/complete', 'post')[0]!;
    for (const overrideKey of ['riskLevel', 'effectiveRisk', 'professionalReview', 'requiresProfessionalReview', 'claimType', 'confidence', 'certificationState', 'certificationId', 'promptVersion', 'toolsetVersion', 'policyVersion', 'outputSchemaVersion']) {
      const res = makeResponse();
      const next = vi.fn();
      await controller({ body: { ...validBody, [overrideKey]: 'APPROVED_CLINICAL_SUPPORT' } } as Request, res, next);
      expect(res.status, overrideKey).toHaveBeenCalledWith(400);
      expect(next, overrideKey).not.toHaveBeenCalled();
    }
  });

  it('fails closed with 503 when the egress kill switch is off', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'false');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await controller({ body: validBody } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'IA deshabilitada' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('denies with 403 when the model is not in the egress allowlist', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await controller({ body: { ...validBody, model: 'gpt-4o' } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Politica de egress IA deniega la solicitud' }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('denies with 403 when the provider is not allowed', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    vi.stubEnv('AI_ALLOWED_PROVIDERS', 'openai');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await controller({ body: { ...validBody, provider: 'ollama' } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls the provider with server-side credentials when egress is enabled', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    vi.stubEnv('OPENAI_API_KEY', 'sk-server-secret');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await controller({ body: validBody } as Request, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ content: '{"ok":true}', provider: 'openai' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-server-secret');
    expect(next).not.toHaveBeenCalled();
  });

  it('never forwards a client model for Ollama; uses the server default', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    vi.stubEnv('AI_MODEL', 'llama3.2');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], model: 'llama3.2' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await controller({ body: { ...validBody, provider: 'ollama', model: 'custom-ollama-model' } } as Request, res, next);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe('llama3.2');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a normalized 502 when every provider fails', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    vi.stubEnv('OPENAI_API_KEY', 'sk-server-secret');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => 'boom' }));

    await controller({ body: validBody } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Proveedor de IA no disponible' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('denies JSON capability for models not certified for structured_json', async () => {
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    vi.stubEnv('AI_FALLBACK_PROVIDERS', 'ollama');
    const controller = routeHandlers('/complete', 'post')[0]!;
    const res = makeResponse();
    const next = vi.fn();

    await controller({ body: { ...validBody, provider: 'ollama', responseFormat: 'json' } } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('no certificado') }));
    expect(next).not.toHaveBeenCalled();
  });
});