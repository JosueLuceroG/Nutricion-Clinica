import { describe, expect, it, vi } from 'vitest';
import { NutritionWorkflow } from './nutritionWorkflow.js';
import type { ContextDataSources } from './contextBuilder.js';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import type { GatewayResult } from '../aiGateway.js';
import type { MemoryEntry } from '../memory/memoryTypes.js';

const DOC_101 = '00000000-0000-4000-8000-000000000101';
const MEMORY_ID = '00000000-0000-4000-8000-000000000777';

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

function memoryEntry(id: string, content: string): MemoryEntry {
  return {
    id,
    pacienteId: 'pid',
    sucursalId: 'sid',
    actorId: 'prof-1',
    content,
    visibility: 'shared',
    source: 'ai_conversation',
    createdAt: '2026-08-01T00:00:00.000Z',
    expiresAt: '2026-12-31T00:00:00.000Z',
  };
}

describe('NutritionWorkflow con memoria', () => {
  it('renders the non-authoritative memory section into the prompt', async () => {
    const captured: AICompletionRequest[] = [];
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: (req) => {
        captured.push(req);
        return aiWith('Consejo general.')(req);
      },
      memoryRetriever: async () => [memoryEntry('mem-1', 'Prefiere consultas en la tarde')],
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);

    expect(result.status).toBe('advice');
    expect(captured[0]?.systemPrompt).toContain('## Memoria del paciente (NO autoritativa)');
    expect(captured[0]?.systemPrompt).toContain('Prefiere consultas en la tarde');
    expect(captured[0]?.systemPrompt).toContain('NO autoritativo');
    expect(result.envelope.sources.some((s) => s.type === 'memory' && s.ref === 'mem-1')).toBe(true);
  });

  it('treats memory as non-citable: citing a memory id abstains as ungrounded', async () => {
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: aiWith(`Consejo segun [${MEMORY_ID}] y respaldado por [${DOC_101}].`),
      memoryRetriever: async () => [memoryEntry(MEMORY_ID, 'Prefiere consultas en la tarde')],
      retrieveKnowledge: async () => [{ docId: DOC_101, title: 't', tier: 'clinical_guideline', category: 'c', chunkIndex: 0, snippet: 's', score: 1 }],
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('ungrounded');
    expect(result.envelope.citations?.missing).toContain(MEMORY_ID);
  });

  it('degrades gracefully when memory retrieval fails', async () => {
    const workflow = new NutritionWorkflow({
      dataSources: fullSources,
      completeAi: aiWith('Consejo general.'),
      memoryRetriever: async () => {
        throw new Error('db down');
      },
      now: () => new Date('2026-08-14T00:00:00.000Z'),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await workflow.run({ pacienteId: 'pid', sucursalId: 'sid' }, actor);

    expect(result.status).toBe('advice');
    expect(result.envelope.sources.some((s) => s.type === 'memory')).toBe(false);
    warn.mockRestore();
  });
});