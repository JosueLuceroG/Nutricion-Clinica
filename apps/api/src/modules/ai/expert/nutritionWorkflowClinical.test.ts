import { describe, expect, it } from 'vitest';
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
  executionId: 'exec-1',
  correlationId: 'corr-1',
});

function workflowWith(ai: (req: AICompletionRequest) => Promise<GatewayResult>, sources: ContextDataSources = fullSources) {
  return new NutritionWorkflow({
    dataSources: sources,
    completeAi: ai,
    now: () => new Date('2026-08-14T00:00:00.000Z'),
  });
}

describe('NutritionWorkflow contrato clinico (Build 05)', () => {
  it('el consejo lleva contrato clinico: riesgo, claims con procedencia real, confianza y revision', async () => {
    const result = await workflowWith(okAi, fullSources).run(
      { pacienteId: 'p-1', sucursalId: 's-1', goal: 'plan semanal' },
      actor,
    );

    expect(result.status).toBe('advice');
    const clinical = result.envelope.clinical;
    expect(clinical).toBeDefined();
    expect(clinical!.capability).toBe('nutrition_reasoning');
    expect(clinical!.baseRisk).toBe('RISK_3');
    expect(clinical!.effectiveRisk).toBe('RISK_3');
    expect(clinical!.requiresProfessionalReview).toBe(true);

    const types = clinical!.claims.map((c) => c.claimType);
    expect(types).toContain('CALCULATED_VALUE');
    expect(types).toContain('AI_RECOMMENDATION');
    expect(types).not.toContain('OBSERVED_FACT');

    const calc = clinical!.claims.find((c) => c.claimType === 'CALCULATED_VALUE');
    expect(calc?.evidence[0]).toMatchObject({ sourceType: 'CALCULATOR', calculationId: expect.any(String), calculationVersion: 'v1' });

    expect(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_EVIDENCE']).toContain(clinical!.confidence);
  });

  it('la abstencion por datos faltantes lleva abstencion formal con codigo mapeado', async () => {
    const result = await workflowWith(okAi, noAnthropometrySources).run(
      { pacienteId: 'p-1', sucursalId: 's-1', goal: 'plan semanal' },
      actor,
    );

    expect(result.status).toBe('abstained');
    const clinical = result.envelope.clinical;
    expect(clinical?.abstention?.status).toBe('ABSTAINED');
    expect(clinical?.abstention?.reasonCodes).toContain('MISSING_REQUIRED_DATA');
    expect(clinical?.abstention?.requiresProfessionalReview).toBe(true);
    expect(clinical?.effectiveRisk).toBe('RISK_3');
  });

  it('la abstencion por numeros sin respaldo mapea a INSUFFICIENT_EVIDENCE', async () => {
    const unverifiableAi = async (): Promise<GatewayResult> => ({
      ok: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      result: { content: 'Tu peso ideal es 99.9 kg segun mi analisis avanzado', model: 'gpt-4o-mini', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
      attempts: [],
      executionId: 'e1',
      correlationId: 'c1',
    });
    const result = await workflowWith(unverifiableAi).run(
      { pacienteId: 'p-1', sucursalId: 's-1', goal: 'plan semanal' },
      actor,
    );

    expect(result.status).toBe('abstained');
    expect(result.envelope.clinical?.abstention?.reasonCodes).toContain('INSUFFICIENT_EVIDENCE');
  });

  it('los claims del modelo son AI_RECOMMENDATION/AI_INTERPRETATION, nunca hechos observados', async () => {
    const result = await workflowWith(okAi).run(
      { pacienteId: 'p-1', sucursalId: 's-1', goal: 'plan semanal' },
      actor,
    );
    const aiClaims = result.envelope.clinical?.claims.filter((c) => c.evidence.some((e) => e.sourceType === 'MODEL_INFERENCE'));
    for (const claim of aiClaims ?? []) {
      expect(['AI_RECOMMENDATION', 'AI_INTERPRETATION']).toContain(claim.claimType);
    }
  });

  it('el envelope sigue siendo serializable (JSON) sin perder el contrato clinico', async () => {
    const result = await workflowWith(okAi).run(
      { pacienteId: 'p-1', sucursalId: 's-1', goal: 'plan semanal' },
      actor,
    );
    const roundTrip = JSON.parse(JSON.stringify(result.envelope)) as typeof result.envelope;
    expect(roundTrip.clinical?.effectiveRisk).toBe('RISK_3');
    expect(roundTrip.clinical?.claims.length).toBeGreaterThan(0);
    expect(roundTrip.clinical?.confidence).toBeTruthy();
  });
});