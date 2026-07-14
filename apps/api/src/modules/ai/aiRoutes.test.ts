import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import router, { mapOpenAiResponse, resolveOpenAiApiKey } from './aiRoutes.js';

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
      provider: 'openai',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  });

  it('preserves the configured Ollama provider in the public response', () => {
    const mapped = mapOpenAiResponse({
      choices: [{ message: { content: '{"name":"KPI"}' }, finish_reason: 'stop' }],
      model: 'llama3.2:latest',
    }, 'llama3.2', 'ollama');

    expect(mapped.provider).toBe('ollama');
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
});
