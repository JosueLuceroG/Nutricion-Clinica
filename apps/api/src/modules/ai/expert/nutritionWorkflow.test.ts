import { describe, expect, it, vi } from 'vitest';
import { NutritionWorkflow } from './nutritionWorkflow.js';
import type { ContextDataSources } from './contextBuilder.js';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import type { GatewayResult } from '../aiGateway.js';

const actor = { profesionalId: 'prof-1', role: 'nutriologa' as const };

const fullSources: ContextDataSources = {
  getProfile: async () => ({ genero: 'Femenino', fecha_nacimiento: '1990-06-15' }),
  getAnthropometry: async () => ({ weightKg: 70, heightM: 1.7, measuredAt: '2026-07-01T00:00:00.000Z' }),
  getActivePlan: async () => ({ name: 'Plan base', kcalTarget: 1700 }),
  getRecentLabs: async () => [],
  getAdherence: async () => [],
  getRecentConsultations: async () => [],
};

const noAnthropometrySources: ContextDataSources = {
  ...fullSources,
  getAnthropometry: async () => null,
  getActivePlan: async () => null,
};

const okAi = async (_req: AICompletionRequest): Promise<GatewayResult> => ({
  ok: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  result: {
    content: 'Tu requerimiento estimado es de 1700 kcal. Toma 2.1 litros de agua al dia.',
    model: 'gpt-4o-mini',
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
  },
  attempts: [],
});

const unavailableAi = async (): Promise<GatewayResult> => ({
  ok: false,
  status: 503,
  message: 'IA deshabilitada',
  attempts: [],
});

function workflowWith(ai: (req: AICompletionRequest) => Promise<GatewayResult>, sources: ContextDataSources = fullSources, audit?: (e: unknown) => Promise<void>) {
  return new NutritionWorkflow({
    dataSources: sources,
    completeAi: ai,
    now: () => new Date('2026-08-14T00:00:00.000Z'),
    audit: audit as never,
  });
}

describe('NutritionWorkflow', () => {
  it('produces an advice with evidence envelope when data and AI are available', async () => {
    const audit = vi.fn();
    const workflow = workflowWith(okAi, fullSources, audit);
    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid', goal: 'mantener peso' }, actor);
    expect(result.status).toBe('advice');
    expect(result.advice?.content).toContain('1700 kcal');
    expect(result.envelope.reviewRequired).toBe(true);
    expect(result.envelope.ai?.provider).toBe('openai');
    expect(result.envelope.calculators.some((c) => c.id === 'calc_bmi')).toBe(true);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status: 'advice' }));
  });

  it('abstains when anthropometry and plan targets are missing', async () => {
    const workflow = workflowWith(okAi, noAnthropometrySources);
    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);
    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('missing_data');
    expect(result.advice).toBeUndefined();
  });

  it('refers to professional review on safety blockers', async () => {
    const extremeSources: ContextDataSources = {
      ...fullSources,
      getAnthropometry: async () => ({ weightKg: 35, heightM: 1.7, measuredAt: '2026-07-01T00:00:00.000Z' }),
    };
    const workflow = workflowWith(okAi, extremeSources);
    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);
    expect(result.status).toBe('referral');
    expect(result.envelope.abstention?.kind).toBe('safety');
  });

  it('abstains when the output contains numbers without evidence backing', async () => {
    const fabricatingAi = async (): Promise<GatewayResult> => ({
      ok: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      result: {
        content: 'Tu hemoglobina glucosilada es 9.5 y deberias bajar 3.2 kg',
        model: 'gpt-4o-mini',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
      },
      attempts: [],
    });
    const workflow = workflowWith(fabricatingAi);
    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);
    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('unverifiable');
  });

  it('returns ai_unavailable when the gateway denies', async () => {
    const workflow = workflowWith(unavailableAi);
    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);
    expect(result.status).toBe('ai_unavailable');
    expect(result.advice).toBeUndefined();
  });

  it('renders calculator values into the prompt for the AI', async () => {
    const captured: AICompletionRequest[] = [];
    const spyAi = async (req: AICompletionRequest): Promise<GatewayResult> => {
      captured.push(req);
      return okAi(req);
    };
    const workflow = workflowWith(spyAi);
    await workflow.run({ pacienteId: 'pid', sucursalId: 'sid', notes: 'revisar plan' }, actor);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.systemPrompt).toContain('Indice de masa corporal');
    expect(captured[0]?.systemPrompt).toContain('revisar plan');
    expect(captured[0]?.systemPrompt).toContain('gsr-01');
  });
});