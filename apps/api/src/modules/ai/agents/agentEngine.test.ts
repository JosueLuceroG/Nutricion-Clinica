import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Role } from '@nutriclinica/shared';
import type { AIGateway } from '../aiGateway.js';
import { type GatewayResult } from '../aiGateway.js';
import { AIToolRegistry } from '../tools/toolRegistry.js';
import { defineTool } from '../tools/toolDefinition.js';
import { ToolExecutionService } from '../tools/toolExecutionService.js';
import { InMemoryAgentLedger } from './agentLedger.js';
import { BoundedAgentEngine, type BoundedAgentEngineOptions } from './agentEngine.js';
import type { AgentsConfig } from './config.js';
import type { AgentBudget, AgentRun, BoundedAgentDefinition } from './agentTypes.js';

const NOW = new Date('2026-08-14T12:00:00.000Z');
const PACIENTE_ID = '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f';
const ACTOR = { profesionalId: 'prof-1', role: 'nutriologa' as Role };
const SUCURSAL_ID = 'suc-1';
const ENV = { AI_TOOLS_ENABLED: 'true', AI_TOOLS_ALLOWLIST: 'patient_profile', AI_MODEL: 'llama3.2' };

function agentsConfig(overrides: Partial<AgentsConfig> = {}): AgentsConfig {
  return {
    enabled: true,
    store: 'memory',
    defaultBudget: { maxSteps: 8, maxToolCalls: 8, maxTokens: 4096, maxCost: 1, timeoutMs: 60000 },
    maxActiveRunsPerActor: 2,
    ...overrides,
  };
}

function budget(overrides: Partial<AgentBudget> = {}): AgentBudget {
  return { maxSteps: 4, maxToolCalls: 3, maxTokens: 2048, maxCost: 0.5, timeoutMs: 45000, ...overrides };
}

function agent(overrides: Partial<BoundedAgentDefinition> = {}): BoundedAgentDefinition {
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
    confirmationPolicy: 'none',
    inputSchema: z.object({ task: z.string() }),
    ...overrides,
  };
}

function makeGateway(sequence: Array<{ content: string; tokens?: number; model?: string }>): { gateway: AIGateway; completions: ReturnType<typeof vi.fn> } {
  const completions = vi.fn(async (): Promise<GatewayResult> => {
    const next = sequence.shift();
    if (!next) throw new Error('no more completions');
    return {
      ok: true,
      provider: 'openai',
      model: next.model ?? 'gpt-4o-mini',
      result: {
        content: next.content,
        model: next.model ?? 'gpt-4o-mini',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: next.tokens ?? 5, totalTokens: next.tokens ?? 15 },
      },
      attempts: [],
      executionId: 'exec-1',
      correlationId: 'corr-1',
    };
  });
  const gateway = { complete: completions } as unknown as AIGateway;
  return { gateway, completions };
}

function toolService(): ToolExecutionService {
  const registry = new AIToolRegistry();
  registry.register(
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
      execute: async () => ({ nombre: 'Ana', edad: 30 }),
    }),
  );
  return new ToolExecutionService(registry);
}

interface BuildOptions {
  now?: () => Date;
  config?: () => AgentsConfig;
  gateway?: AIGateway;
  ledger?: InMemoryAgentLedger;
  consentChecker?: (pacienteId: string, sucursalId: string, tipo: string) => Promise<boolean>;
}

function build(overrides: BuildOptions = {}): { engine: BoundedAgentEngine; ledger: InMemoryAgentLedger; completions: ReturnType<typeof vi.fn> } {
  const ledger = overrides.ledger ?? new InMemoryAgentLedger();
  const { gateway: defaultGateway, completions } = makeGateway([]);
  const options: BoundedAgentEngineOptions = {
    ledger,
    toolService: toolService(),
    gateway: overrides.gateway ?? defaultGateway,
    consentChecker: overrides.consentChecker ?? (async () => true),
    config: overrides.config ?? (() => agentsConfig()),
    now: overrides.now ?? (() => NOW),
  };
  return { engine: new BoundedAgentEngine(options), ledger, completions };
}

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    agentId: 'nutrition_support_agent',
    actor: ACTOR,
    sucursalId: SUCURSAL_ID,
    pacienteId: PACIENTE_ID,
    status: 'running',
    steps: [],
    budgetUsed: { steps: 0, toolCalls: 0, tokens: 0, cost: 0 },
    input: { task: 'hola' },
    startedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 45000).toISOString(),
    ...overrides,
  };
}

describe('bounded agent engine', () => {
  it('runs a loop with tool calls and stops on answer', async () => {
    const { engine, completions } = build();
    completions
      .mockResolvedValueOnce(makeCompletion('{"tool":"patient_profile","args":{"pacienteId":"7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f"}}', 40))
      .mockResolvedValueOnce(makeCompletion('{"answer":"El paciente tiene buen plan"}', 10));

    const result = await engine.run(agent(), { task: 'resume el caso' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.run.status).toBe('completed');
    expect(result.value.run.stopReason).toBe('answer');
    expect(result.value.run.answer).toBe('El paciente tiene buen plan');
    expect(result.value.run.steps).toHaveLength(3);
    expect(result.value.run.steps[1]?.kind).toBe('tool');
    expect(result.value.run.steps[1]?.toolResult).toEqual({ nombre: 'Ana', edad: 30 });
    expect(result.value.run.budgetUsed.toolCalls).toBe(1);
    expect(result.value.run.budgetUsed.tokens).toBe(70);
    expect(completions).toHaveBeenCalledTimes(2);
  });

  it('fails closed when agents are disabled', async () => {
    const { engine } = build({ config: () => agentsConfig({ enabled: false }) });
    const result = await engine.run(agent(), { task: 'x' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    expect(result).toEqual({ ok: false, status: 503, error: 'Agentes deshabilitados' });
  });

  it('rejects roles without permission', async () => {
    const { engine } = build();
    const result = await engine.run(agent(), { task: 'x' }, { profesionalId: 'prof-2', role: 'asistente' }, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    expect(result).toEqual({ ok: false, status: 403, error: 'Rol insuficiente' });
  });

  it('requires a paciente when the agent needs it', async () => {
    const { engine } = build();
    const result = await engine.run(agent(), { task: 'x' }, ACTOR, SUCURSAL_ID, { env: ENV });
    expect(result).toEqual({ ok: false, status: 400, error: 'Se requiere paciente' });
  });

  it('rejects missing consent', async () => {
    const { engine } = build({ consentChecker: async () => false });
    const result = await engine.run(agent(), { task: 'x' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    expect(result).toEqual({ ok: false, status: 403, error: "Consentimiento 'ai_opt_in' no aceptado" });
  });

  it('rejects invalid input', async () => {
    const { engine } = build();
    const result = await engine.run(agent(), { nope: 1 }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    expect(result).toEqual({ ok: false, status: 400, error: 'Input del agente invalido' });
  });

  it('refuses tools outside the allowlist (fail-closed)', async () => {
    const { engine, completions } = build();
    completions.mockResolvedValueOnce(makeCompletion('{"tool":"meal_plan","args":{}}'));

    const result = await engine.run(agent(), { task: 'x' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });

    expect(result).toEqual({ ok: false, status: 502, error: "Herramienta 'meal_plan' no permitida para este agente" });
  });

  it('stops gracefully on budget exhaustion', async () => {
    const { engine, completions } = build();
    completions
      .mockResolvedValueOnce(makeCompletion('{"tool":"patient_profile","args":{"pacienteId":"7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f"}}', 40))
      .mockResolvedValueOnce(makeCompletion('{"answer":"nunca deberia llegar"}'));

    const result = await engine.run(agent({ budget: budget({ maxSteps: 1 }) }), { task: 'x' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.run.status).toBe('completed');
    expect(result.value.run.stopReason).toBe('budget');
    expect(result.value.run.budgetUsed.toolCalls).toBe(1);
    expect(completions).toHaveBeenCalledTimes(1);
  });

  it('limits active runs per actor with 429', async () => {
    const ledger = new InMemoryAgentLedger();
    await ledger.createRun(makeRun({ status: 'running' }));
    const { engine } = build({ ledger, config: () => agentsConfig({ maxActiveRunsPerActor: 1 }) });

    const result = await engine.run(agent(), { task: 'x' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });

    expect(result).toEqual({ ok: false, status: 429, error: 'Limite de ejecuciones activas alcanzado' });
  });

  it('step_confirm policy pauses the run and confirmStep resumes it', async () => {
    const { engine, completions } = build();
    completions
      .mockResolvedValueOnce(makeCompletion('{"tool":"patient_profile","args":{"pacienteId":"7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f"}}', 40))
      .mockResolvedValueOnce(makeCompletion('{"answer":"resumen listo"}', 10));

    const definition = agent({ confirmationPolicy: 'step_confirm' });
    const first = await engine.run(definition, { task: 'resume' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.run.status).toBe('awaiting_confirmation');
    expect(first.value.pending).toBeDefined();
    expect(first.value.pending?.toolId).toBe('patient_profile');

    const confirmed = await engine.confirmStep(definition, first.value.run.id, first.value.pending!.stepIndex, ACTOR, SUCURSAL_ID, { env: ENV });

    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.run.status).toBe('completed');
    expect(confirmed.value.run.stopReason).toBe('answer');
    expect(confirmed.value.run.steps.filter((s) => s.kind === 'tool')).toHaveLength(1);
    expect(completions).toHaveBeenCalledTimes(2);
  });

  it('confirmStep rejects actors that do not own the run', async () => {
    const { engine, completions } = build();
    completions.mockResolvedValueOnce(makeCompletion('{"tool":"patient_profile","args":{"pacienteId":"7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f"}}', 40));
    const definition = agent({ confirmationPolicy: 'step_confirm' });
    const first = await engine.run(definition, { task: 'resume' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    if (!first.ok) return;

    const confirmed = await engine.confirmStep(definition, first.value.run.id, first.value.pending!.stepIndex, { profesionalId: 'prof-2', role: 'nutriologa' }, SUCURSAL_ID, { env: ENV });

    expect(confirmed).toEqual({ ok: false, status: 403, error: 'No autorizado para esta ejecucion' });
  });

  it('confirmStep rejects runs that are not awaiting confirmation', async () => {
    const { engine, completions } = build();
    completions.mockResolvedValueOnce(makeCompletion('{"answer":"directo"}'));
    const definition = agent({ confirmationPolicy: 'step_confirm' });
    const first = await engine.run(definition, { task: 'resume' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    if (!first.ok) return;

    const confirmed = await engine.confirmStep(definition, first.value.run.id, 0, ACTOR, SUCURSAL_ID, { env: ENV });

    expect(confirmed).toEqual({ ok: false, status: 409, error: 'La ejecucion no espera confirmacion' });
  });

  it('confirmStep rejects expired runs with 410', async () => {
    let current = new Date(NOW.getTime());
    const { engine, completions } = build({ now: () => current });
    completions.mockResolvedValueOnce(makeCompletion('{"tool":"patient_profile","args":{"pacienteId":"7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f"}}', 40));
    const definition = agent({ confirmationPolicy: 'step_confirm' });
    const first = await engine.run(definition, { task: 'resume' }, ACTOR, SUCURSAL_ID, { env: ENV, pacienteId: PACIENTE_ID });
    if (!first.ok) return;
    current = new Date(NOW.getTime() + 60000);

    const confirmed = await engine.confirmStep(definition, first.value.run.id, first.value.pending!.stepIndex, ACTOR, SUCURSAL_ID, { env: ENV });

    expect(confirmed).toEqual({ ok: false, status: 410, error: 'La ejecucion expiro' });
  });

  it('rejects unknown runs and foreign runs in fetchRun', async () => {
    const { engine } = build();
    const unknown = await engine.fetchRun(agent(), '99999999-9999-9999-9999-999999999999', ACTOR, SUCURSAL_ID);
    expect(unknown).toEqual({ ok: false, status: 404, error: 'Ejecucion no encontrada' });
    const ledger = new InMemoryAgentLedger();
    await ledger.createRun(makeRun());
    const withLedger = build({ ledger });
    const foreign = await withLedger.engine.fetchRun(agent(), '11111111-1111-1111-1111-111111111111', { profesionalId: 'prof-2', role: 'nutriologa' }, SUCURSAL_ID);
    expect(foreign).toEqual({ ok: false, status: 403, error: 'No autorizado para esta ejecucion' });
  });
});

function makeCompletion(content: string, tokens = 5): GatewayResult {
  return {
    ok: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    result: { content, model: 'gpt-4o-mini', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: tokens, totalTokens: 10 + tokens } },
    attempts: [],
    executionId: 'exec-1',
    correlationId: 'corr-1',
  };
}