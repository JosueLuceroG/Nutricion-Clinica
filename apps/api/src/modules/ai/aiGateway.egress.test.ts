import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIGateway } from './aiGateway.js';
import { AIDataEgressPolicy, InMemoryEgressManifestStore } from './egress/index.js';
import { modelCircuitBreaker } from './resilience/modelCircuitBreaker.js';
import { ProviderCallError, type AICompletionResult, type AIProviderAdapter } from './providers/aiProviderAdapter.js';

const SUCCESS: AICompletionResult = {
  content: 'ok',
  model: 'm',
  finishReason: 'stop',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

function fakeAdapter(id: 'openai' | 'ollama', impl: AIProviderAdapter['complete']): AIProviderAdapter {
  return { id, complete: vi.fn(impl) };
}

function egressEnv(): NodeJS.ProcessEnv {
  return {
    AI_EGRESS_ENABLED: 'true',
    AI_ALLOWED_PROVIDERS: 'openai,ollama',
    AI_ALLOWED_MODELS: '',
    AI_FALLBACK_PROVIDERS: 'ollama',
    AI_MODEL_MODE: 'ORGANIZATION_PREFERRED',
  } as NodeJS.ProcessEnv;
}

describe('AIGateway + egress (Build 03)', () => {
  let openAi: AIProviderAdapter;
  let ollama: AIProviderAdapter;
  let store: InMemoryEgressManifestStore;
  let gateway: AIGateway;

  beforeEach(() => {
    modelCircuitBreaker.reset();
    openAi = fakeAdapter('openai', async () => SUCCESS);
    ollama = fakeAdapter('ollama', async () => SUCCESS);
    store = new InMemoryEgressManifestStore();
    gateway = new AIGateway({
      getProviderAdapter: (provider) => (provider === 'openai' ? openAi : ollama),
      env: egressEnv(),
      egressPolicy: AIDataEgressPolicy.withInMemoryStore({
        env: egressEnv,
        manifestStore: store,
        consentStatusProvider: async () => ({ status: 'valid', reference: 'cons-1' }),
        namesProvider: async () => ['Ana Gómez'],
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('aplica la política por candidato y cae a un provider local cuando el externo niega PHI', async () => {
    const req = { model: 'gpt-4o-mini', systemPrompt: 'Eres experto', userPrompt: 'Consejo' };
    const result = await gateway.complete(req, {
      requiredCapability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      egress: {
        capability: 'nutrition_reasoning',
        patientId: '11111111-1111-1111-1111-111111111111',
        sucursalId: '22222222-2222-2222-2222-222222222222',
        actor: { profesionalId: '33333333-3333-3333-3333-333333333333' },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('ollama');
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0]).toMatchObject({ provider: 'openai', outcome: 'policy_denied' });
      expect(result.attempts[1]).toMatchObject({ provider: 'ollama', outcome: 'success' });
    }
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).toHaveBeenCalledTimes(1);
    expect(store.all().length).toBe(2);
    expect(store.all().map((m) => m.decision)).toEqual(['DENY', 'ALLOW']);
  });

  it('el adapter solo recibe el prompt filtrado/redactado (boundary)', async () => {
    const req = {
      model: 'gpt-4o-mini',
      systemPrompt: 'Paciente Ana Gómez, email ana@test.com',
      userPrompt: 'user',
    };
    const result = await gateway.complete(req, {
      preferredProvider: 'openai',
      egress: {
        capability: 'generic_assistant',
      },
    });

    expect(result.ok).toBe(true);
    const sentRequest = (openAi.complete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(sentRequest.systemPrompt).not.toContain('ana@test.com');
    expect(sentRequest.systemPrompt).toContain('[REDACTADO]');
  });

  it('fail-closed: patient_support exige APPROVED_PATIENT (nunca APPROVED_GENERAL)', async () => {
    const req = {
      model: 'gpt-4o-mini',
      systemPrompt: 'Paciente Ana Gómez, email ana@test.com',
      userPrompt: 'user',
    };
    const result = await gateway.complete(req, {
      preferredProvider: 'openai',
      egress: {
        capability: 'patient_support',
        patientId: '11111111-1111-1111-1111-111111111111',
        sucursalId: '22222222-2222-2222-2222-222222222222',
      },
    });

    if (result.ok) throw new Error('patient_support no debe ejecutarse sin APPROVED_PATIENT');
    expect(result.status).toBe(403);
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('denegación total de la política nunca invoca el adapter', async () => {
    const req = { model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' };
    const result = await gateway.complete(req, {
      preferredProvider: 'openai',
      egress: { capability: 'nutrition_reasoning', patientId: '11111111-1111-1111-1111-111111111111' },
    });

    if (result.ok) throw new Error('se esperaba denegación');
    expect(result.status).toBe(403);
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('sin contexto egress conserva el comportamiento fail-closed del gateway', async () => {
    const result = await gateway.complete({ model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' }, { preferredProvider: 'openai' });
    expect(result.ok).toBe(true);
    expect(openAi.complete).toHaveBeenCalledTimes(1);
  });

  it('fallback operativo (provider error) re-evalúa la política del siguiente candidato', async () => {
    const failing = fakeAdapter('openai', async () => {
      throw new ProviderCallError('openai', 'http', 'boom', 502);
    });
    const localGateway = new AIGateway({
      getProviderAdapter: (provider) => (provider === 'openai' ? failing : ollama),
      env: egressEnv(),
      egressPolicy: AIDataEgressPolicy.withInMemoryStore({
        env: egressEnv,
        manifestStore: store,
        consentStatusProvider: async () => ({ status: 'valid' }),
      }),
    });
    const result = await localGateway.complete(
      { model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' },
      { preferredProvider: 'openai', egress: { capability: 'generic_assistant' } },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('ollama');
    expect(store.all().map((m) => m.provider)).toEqual(['openai', 'ollama']);
  });
});