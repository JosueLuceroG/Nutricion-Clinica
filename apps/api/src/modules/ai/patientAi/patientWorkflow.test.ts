import { describe, expect, it, vi } from 'vitest';
import type { AICompletionRequest } from '../providers/aiProviderAdapter.js';
import type { GatewayResult } from '../aiGateway.js';
import { InMemoryKnowledgeDocStore, type KnowledgeDoc } from '../rag/knowledgeGovernance.js';
import { PatientWorkflow } from './patientWorkflow.js';

const DOC_ID = '7f3f2d1a-6b2e-4a9c-9c5e-1a2b3c4d5e6f';

function educationalDoc(overrides: Partial<KnowledgeDoc> = {}): KnowledgeDoc {
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
    ...overrides,
  };
}

function okGateway(content: string): GatewayResult {
  return {
    ok: true,
    provider: 'ollama',
    model: 'llama3.2',
    result: { content, model: 'llama3.2', usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }, finishReason: 'stop' },
    attempts: [],
    executionId: 'exec-1',
    correlationId: 'corr-1',
  };
}

function storeWith(...docs: KnowledgeDoc[]): InMemoryKnowledgeDocStore {
  const store = new InMemoryKnowledgeDocStore();
  for (const doc of docs) void store.save(doc);
  return store;
}

describe('PatientWorkflow', () => {
  it('escalates urgent queries without calling the AI', async () => {
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway('respuesta'));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'tengo dolor intenso y sangrado' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('escalated');
    expect(result.envelope.escalated?.matchedTerms).toEqual(['sangrado', 'dolor intenso']);
    expect(result.response?.content).toContain('nutriologa');
    expect(completeAi).not.toHaveBeenCalled();
  });

  it('returns educational advice grounded in knowledge', async () => {
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway(`La fruta es una buena opcion en el desayuno [${DOC_ID}].`));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'que fruta puedo comer en el desayuno?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('advice');
    expect(result.envelope.sources).toEqual([{ type: 'knowledge', docId: DOC_ID, title: 'Fruta y desayuno saludable', tier: 'educational' }]);
    expect(result.envelope.citations?.ok).toBe(true);
    expect(result.envelope.ai?.model).toBe('llama3.2');
  });

  it('abstains when the knowledge store is unavailable', async () => {
    const store = storeWith();
    store.list = vi.fn(async () => {
      throw new Error('store down');
    });
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway('respuesta'));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: store });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('knowledge_unavailable');
    expect(completeAi).not.toHaveBeenCalled();
  });

  it('abstains when no educational sources match', async () => {
    const clinicalDoc = educationalDoc({ id: '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e', tier: 'clinical_guideline', title: 'Guia clinica hospitalaria' });
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway('respuesta'));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(clinicalDoc) });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('ungrounded');
    expect(completeAi).not.toHaveBeenCalled();
  });

  it('abstains when the output cites sources without backing', async () => {
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway('Consejo [aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee].'));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('ungrounded');
    expect(result.envelope.citations?.ok).toBe(false);
  });

  it('abstains when the output contains unverifiable numbers', async () => {
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway(`Toma 100 mg de suplemento [${DOC_ID}].`));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('unverifiable');
  });

  it('abstains when the output uses unsafe patient language', async () => {
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway(`Usted tiene diabetes, suspenda el azucar [${DOC_ID}].`));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('abstained');
    expect(result.envelope.abstention?.kind).toBe('unsafe_language');
  });

  it('reports ai_unavailable when the gateway fails', async () => {
    const completeAi = vi.fn(async (): Promise<GatewayResult> => ({ ok: false, status: 503, code: 'PROVIDER_UNAVAILABLE', message: 'IA no configurada', attempts: [], executionId: 'exec-1', correlationId: 'corr-1' }));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('ai_unavailable');
    expect(result.response).toBeUndefined();
  });

  it('never leaks patient identifiers into the AI prompt', async () => {
    const completeAi = vi.fn(async (req: AICompletionRequest): Promise<GatewayResult> => {
      expect(req.systemPrompt).not.toContain('pac-1');
      expect(req.systemPrompt).not.toContain('Ana');
      expect(req.systemPrompt).not.toContain('suc-1');
      return okGateway(`Respuesta segura [${DOC_ID}].`);
    });
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()) });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.status).toBe('advice');
  });

  it('uses the injected clock for the envelope', async () => {
    const now = new Date('2026-08-14T12:00:00.000Z');
    const completeAi = vi.fn(async (): Promise<GatewayResult> => okGateway(`La fruta es buena opcion [${DOC_ID}].`));
    const workflow = new PatientWorkflow({ completeAi, knowledgeStore: storeWith(educationalDoc()), now: () => now });

    const result = await workflow.run({ query: 'que fruta comer?' }, { sucursalId: 'suc-1' });

    expect(result.envelope.generatedAt).toBe('2026-08-14T12:00:00.000Z');
  });
});