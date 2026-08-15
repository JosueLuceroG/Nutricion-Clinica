import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import '../tools/toolRoutes.js';
import type { AIGateway } from '../aiGateway.js';
import { type GatewayResult } from '../aiGateway.js';
import { AIToolRegistry } from '../tools/toolRegistry.js';
import { defineTool } from '../tools/toolDefinition.js';
import { ToolExecutionService } from '../tools/toolExecutionService.js';
import { InMemoryAgentLedger } from './agentLedger.js';
import { BoundedAgentEngine } from './agentEngine.js';
import { createAgentRouter } from './agentRoutes.js';
import { AgentRegistry } from './agentRegistry.js';
import type { AgentBudget, BoundedAgentDefinition } from './agentTypes.js';

interface ExpressLayerLike {
  handle?: ((req: Request, res: Response, next: NextFunction) => void | Promise<void>) & { name?: string };
  route?: { path?: string; methods?: Record<string, boolean>; stack?: ExpressLayerLike[] };
}

function routeHandlers(router: ReturnType<typeof createAgentRouter>, path: string, method: string) {
  return ((router as unknown as { stack: ExpressLayerLike[] }).stack)
    .find((layer) => layer.route?.path === path && layer.route.methods?.[method])
    ?.route?.stack?.map((layer) => layer.handle)
    .filter((handler): handler is NonNullable<ExpressLayerLike['handle']> => Boolean(handler)) ?? [];
}

function makeResponse(): Response {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

function baseReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    body: {},
    user: { sub: 'prof-1', rol: 'nutriologa' },
    sucursalId: 'suc-1',
    header: vi.fn(),
    get: vi.fn(),
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

const NOW = new Date('2026-08-14T12:00:00.000Z');
const PACIENTE_ID = '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f';

function budget(): AgentBudget {
  return { maxSteps: 4, maxToolCalls: 3, maxTokens: 2048, maxCost: 0.5, timeoutMs: 45000 };
}

function agent(): BoundedAgentDefinition {
  return {
    id: 'nutrition_support_agent',
    name: 'Agente de soporte',
    description: 'desc',
    riskLevel: 'medium',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_opt_in'],
    requiresPaciente: true,
    allowedToolIds: ['patient_profile'],
    capability: 'nutrition_reasoning',
    systemPrompt: 'prompt',
    budget: budget(),
    confirmationPolicy: 'step_confirm',
    inputSchema: z.object({ task: z.string() }),
  };
}

function completion(content: string): GatewayResult {
  return {
    ok: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    result: { content, model: 'gpt-4o-mini', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    attempts: [],
  };
}

function fakeGateway(sequence: GatewayResult[]): AIGateway {
  return { complete: vi.fn(async (): Promise<GatewayResult> => sequence.shift() ?? completion('{"answer":"ok"}')) } as unknown as AIGateway;
}

function engineWith(sequence: GatewayResult[], enabled = true, toolRegistry?: AIToolRegistry): BoundedAgentEngine {
  const registry = toolRegistry ?? (() => {
    const r = new AIToolRegistry();
    r.register(
      defineTool({
        id: 'patient_profile',
        name: 'Perfil del paciente',
        description: 'Lee el perfil del paciente',
        readOnly: true,
        riskLevel: 'high',
        dataCategories: ['pii'],
        requiredConsent: 'ai_opt_in',
        minRole: 'nutriologa',
        maxAgeMs: 900000,
        schema: { pacienteId: z.string().uuid() },
        execute: async () => ({ nombre: 'Ana' }),
      }),
    );
    return r;
  })();
  return new BoundedAgentEngine({
    ledger: new InMemoryAgentLedger(),
    toolService: new ToolExecutionService(registry),
    gateway: fakeGateway(sequence),
    consentChecker: async () => true,
    config: () => ({ enabled, store: 'memory', defaultBudget: budget(), maxActiveRunsPerActor: 2 }),
    now: () => NOW,
  });
}

function buildRouter(sequence: GatewayResult[] = [], enabled = true) {
  const toolRegistry = new AIToolRegistry();
  toolRegistry.register(
    defineTool({
      id: 'patient_profile',
      name: 'Perfil del paciente',
      description: 'Lee el perfil del paciente',
      readOnly: true,
      riskLevel: 'high',
      dataCategories: ['pii'],
      requiredConsent: 'ai_opt_in',
      minRole: 'nutriologa',
      maxAgeMs: 900000,
      schema: { pacienteId: z.string().uuid() },
      execute: async () => ({ nombre: 'Ana' }),
    }),
  );
  const agentRegistry = new AgentRegistry(toolRegistry);
  agentRegistry.register(agent());
  return createAgentRouter({ engine: engineWith(sequence, enabled, toolRegistry), registry: agentRegistry });
}

describe('bounded agent routes', () => {
  beforeEach(() => {
    vi.stubEnv('AI_AGENTS_ENABLED', 'true');
    vi.stubEnv('AI_TOOLS_ENABLED', 'true');
    vi.stubEnv('AI_TOOLS_ALLOWLIST', 'patient_profile');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists agents with per-role availability', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq(), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { agents: Array<{ id: string; availability: { available: boolean } }> };
    expect(payload.agents).toHaveLength(1);
    expect(payload.agents[0]?.id).toBe('nutrition_support_agent');
    expect(payload.agents[0]?.availability.available).toBe(true);
  });

  it('shows agents as unavailable for roles without permission', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/', 'get')[0]!;
    const res = makeResponse();

    await controller(baseReq({ user: { sub: 'prof-2', rol: 'asistente' } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { agents: Array<{ availability: { available: boolean } }> };
    expect(payload.agents[0]?.availability.available).toBe(false);
  });

  it('run fails closed when agents are disabled', async () => {
    const router = buildRouter([], false);
    const controller = routeHandlers(router, '/:agentId/run', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { agentId: 'nutrition_support_agent' }, body: { input: { task: 'x' }, pacienteId: PACIENTE_ID } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('run rejects unknown agents with 404', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/:agentId/run', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { agentId: 'unknown' }, body: { input: { task: 'x' }, pacienteId: PACIENTE_ID } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('run executes the loop and returns the answer', async () => {
    const router = buildRouter([completion('{"answer":"resumen listo"}')]);
    const controller = routeHandlers(router, '/:agentId/run', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { agentId: 'nutrition_support_agent' }, body: { input: { task: 'x' }, pacienteId: PACIENTE_ID } }), res, vi.fn());

    const payload = vi.mocked(res.json).mock.calls[0]?.[0] as { status: string; answer: string };
    expect(payload.status).toBe('completed');
    expect(payload.answer).toBe('resumen listo');
  });

  it('run requires a paciente when the agent needs it', async () => {
    const router = buildRouter();
    const controller = routeHandlers(router, '/:agentId/run', 'post')[0]!;
    const res = makeResponse();

    await controller(baseReq({ params: { agentId: 'nutrition_support_agent' }, body: { input: { task: 'x' } } }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('confirm resumes a paused run with step_confirm policy', async () => {
    const router = buildRouter([
      completion('{"tool":"patient_profile","args":{"pacienteId":"7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f"}}'),
      completion('{"answer":"resumen con datos"}'),
    ]);
    const runController = routeHandlers(router, '/:agentId/run', 'post')[0]!;
    const runRes = makeResponse();
    await runController(baseReq({ params: { agentId: 'nutrition_support_agent' }, body: { input: { task: 'x' }, pacienteId: PACIENTE_ID } }), runRes, vi.fn());
    const runPayload = vi.mocked(runRes.json).mock.calls[0]?.[0] as { status: string; runId: string; pending: { stepIndex: number } };

    const confirmController = routeHandlers(router, '/:agentId/confirm', 'post')[0]!;
    const confirmRes = makeResponse();
    await confirmController(baseReq({ params: { agentId: 'nutrition_support_agent' }, body: { runId: runPayload.runId, stepIndex: runPayload.pending.stepIndex } }), confirmRes, vi.fn());

    const payload = vi.mocked(confirmRes.json).mock.calls[0]?.[0] as { status: string; answer: string; pending?: unknown };
    expect(payload.status).toBe('completed');
    expect(payload.answer).toBe('resumen con datos');
    expect(payload.pending).toBeUndefined();
  });

  it('fetch run returns the run state', async () => {
    const router = buildRouter([completion('{"answer":"ya"}')]);
    const runController = routeHandlers(router, '/:agentId/run', 'post')[0]!;
    const runRes = makeResponse();
    await runController(baseReq({ params: { agentId: 'nutrition_support_agent' }, body: { input: { task: 'x' }, pacienteId: PACIENTE_ID } }), runRes, vi.fn());
    const runPayload = vi.mocked(runRes.json).mock.calls[0]?.[0] as { runId: string };

    const fetchController = routeHandlers(router, '/:agentId/runs/:runId', 'get')[0]!;
    const fetchRes = makeResponse();
    await fetchController(baseReq({ params: { agentId: 'nutrition_support_agent', runId: runPayload.runId } }), fetchRes, vi.fn());

    const payload = vi.mocked(fetchRes.json).mock.calls[0]?.[0] as { runId: string; status: string };
    expect(payload.runId).toBe(runPayload.runId);
    expect(payload.status).toBe('completed');
  });
});