import { describe, expect, it, vi } from 'vitest';
import { buildKnowledgeQuery, NutritionWorkflow } from './nutritionWorkflow.js';
import type { ContextDataSources, PatientContext } from './contextBuilder.js';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import type { GatewayResult } from '../aiGateway.js';
import { InMemoryKnowledgeDocStore } from '../rag/knowledgeGovernance.js';
import { buildGoldenDocs } from '../rag/retrievalGoldenSet.js';

const DOC_101 = '00000000-0000-4000-8000-000000000101';

const actor = { profesionalId: 'prof-1', role: 'nutriologa' as const };

const fullSources: ContextDataSources = {
  getProfile: async () => ({ genero: 'Femenino', fecha_nacimiento: '1990-06-15' }),
  getAnthropometry: async () => ({ weightKg: 70, heightM: 1.7, measuredAt: '2026-07-01T00:00:00.000Z' }),
  getActivePlan: async () => ({ name: 'Plan base', kcalTarget: 1700 }),
  getRecentLabs: async () => [],
  getAdherence: async () => [],
  getRecentConsultations: async () => [],
};

function aiWith(content: string): (req: AICompletionRequest) => Promise<GatewayResult> {
  return async (): Promise<GatewayResult> => ({
    ok: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    result: {
      content,
      model: 'gpt-4o-mini',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
    },
    attempts: [],
    executionId: 'exec-1',
    correlationId: 'corr-1',
  });
}

function storeWithGoldenDocs(): InMemoryKnowledgeDocStore {
  const store = new InMemoryKnowledgeDocStore();
  return store;
}

describe('NutritionWorkflow con RAG', () => {
  it('retrieves usable knowledge, renders it in the prompt and verifies citations', async () => {
    const store = storeWithGoldenDocs();
    for (const doc of buildGoldenDocs('nutriologa', true)) {
      await store.save(doc);
    }
    const captured: AICompletionRequest[] = [];
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: (req) => {
        captured.push(req);
        return aiWith(`Mantener una hidratacion adecuada es parte del consejo [${DOC_101}].`)(req);
      },
      knowledgeStore: store,
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid', goal: 'hidratacion agua recomendada adultos' }, actor);

    expect(result.status).toBe('advice');
    expect(captured[0]?.systemPrompt).toContain('## Conocimiento de respaldo');
    expect(captured[0]?.systemPrompt).toContain(`[${DOC_101}]`);
    expect(result.envelope.sources.some((s) => s.type === 'knowledge' && s.ref === DOC_101)).toBe(true);
    expect(result.envelope.citations).toEqual({
      ok: true,
      cited: [DOC_101],
      verified: [DOC_101],
      missing: [],
    });
  });

  it('abstains when the model cites a source without backing in the retrieved set', async () => {
    const store = storeWithGoldenDocs();
    for (const doc of buildGoldenDocs('nutriologa', true)) {
      await store.save(doc);
    }
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: aiWith(`Consejo basado en [${DOC_101}] y en [00000000-0000-4000-8000-000000000999].`),
      knowledgeStore: store,
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('ungrounded');
    expect(result.envelope.citations?.missing).toContain('00000000-0000-4000-8000-000000000999');
  });

  it('abstains when the knowledge store is unavailable', async () => {
    const audit = vi.fn();
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: aiWith('Consejo simple.'),
      retrieveKnowledge: async () => {
        throw new Error('db down');
      },
      now: () => new Date('2026-08-14T00:00:00.000Z'),
      audit: audit as never,
    });

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('knowledge_unavailable');
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status: 'abstained', error: 'db down' }));
  });

  it('produces advice without knowledge sources when nothing is retrieved', async () => {
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: aiWith('Consejo general sin citas.'),
      retrieveKnowledge: async () => [],
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid', goal: 'zzzz inexistente' }, actor);

    expect(result.status).toBe('advice');
    expect(result.envelope.sources.some((s) => s.type === 'knowledge')).toBe(false);
    expect(result.envelope.citations).toEqual({ ok: true, cited: [], verified: [], missing: [] });
  });

  it('builds the retrieval query from goal, notes and patient profile', () => {
    const ctx: PatientContext = {
      pacienteId: 'pid',
      sucursalId: 'sid',
      genero: 'masculino',
      ageYears: 40,
      profileMissing: false,
      anthropometry: undefined,
      activePlan: undefined,
      recentLabs: [],
      adherence: [],
      recentConsultations: [],
      conditions: [],
    };
    const query = buildKnowledgeQuery(ctx, 'subir de peso', 'revisar hidratacion');
    expect(query).toContain('subir de peso');
    expect(query).toContain('revisar hidratacion');
    expect(query).toContain('masculino');
    expect(query).toContain('adulto');
  });
});