import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIOrchestrator } from './aiOrchestrator.js';
import { AIDataEgressPolicy } from './egress/index.js';
import { ModelRegistry } from './models/modelRegistry.js';
import { ProviderCallError, type AICompletionResult } from './providers/aiProviderAdapter.js';
import { modelCircuitBreaker } from './resilience/modelCircuitBreaker.js';

const SUCCESS: AICompletionResult = {
  content: 'ok',
  model: 'm',
  finishReason: 'stop',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

function fakeAdapter(id: string, impl: (req: unknown) => Promise<AICompletionResult>) {
  return { id, complete: vi.fn(impl) };
}

function runtimeEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    AI_EGRESS_ENABLED: 'true',
    AI_ALLOWED_PROVIDERS: 'openai,ollama',
    AI_QUALIFICATION_ENFORCED: 'false',
    AI_MODEL_MODE: 'ORGANIZATION_PREFERRED',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

function defaultRegistry(): ModelRegistry {
  return new ModelRegistry();
}

function egressPolicy(): AIDataEgressPolicy {
  return AIDataEgressPolicy.withInMemoryStore({
    env: () => runtimeEnv(),
    consentStatusProvider: async () => ({ status: 'valid', reference: 'cons-1' }),
    namesProvider: async () => ['Ana Gómez'],
  });
}

describe('AIOrchestrator runtime', () => {
  let openAi: ReturnType<typeof fakeAdapter>;
  let ollama: ReturnType<typeof fakeAdapter>;

  beforeEach(() => {
    modelCircuitBreaker.reset();
    openAi = fakeAdapter('openai', async () => SUCCESS);
    ollama = fakeAdapter('ollama', async () => SUCCESS);
  });

  function orchestrator(overrides: {
    env?: NodeJS.ProcessEnv;
    getProviderAdapter?: (provider: string) => { complete: (...args: any[]) => any } | undefined;
    registry?: ModelRegistry;
  } = {}) {
    return new AIOrchestrator({
      getProviderAdapter: overrides.getProviderAdapter ?? ((provider: string) => (provider === 'openai' ? openAi : ollama)),
      env: () => overrides.env ?? runtimeEnv(),
      egressPolicy: egressPolicy(),
      modelRegistry: overrides.registry ?? defaultRegistry(),
    });
  }

  it('executes the authoritative sequence: identity -> tenant -> consent -> capability -> router -> gates -> adapter -> result', async () => {
    const events: string[] = [];
    const savedManifests: Array<{ executionId: string; patientRef: string | null }> = [];
    const adapter = {
      id: 'openai',
      complete: vi.fn(async (_req: unknown) => {
        events.push('adapter');
        return SUCCESS;
      }),
    };
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: () => runtimeEnv(),
      consentStatusProvider: async () => { events.push('consent'); return { status: 'valid', reference: 'c' }; },
      manifestStore: {
        save: async (manifest: { executionId: string; patientRef: string | null }) => {
          events.push('audit-manifest');
          savedManifests.push({ executionId: manifest.executionId, patientRef: manifest.patientRef });
        },
      },
    });
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: () => adapter,
      env: () => runtimeEnv(),
      egressPolicy: policy,
      modelRegistry: defaultRegistry(),
    });

    const result = await orchestrator.execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      requiredCapability: 'nutrition_reasoning',
      egress: {
        capability: 'nutrition_reasoning',
        patientId: '11111111-1111-1111-1111-111111111111',
        sucursalId: '22222222-2222-2222-2222-222222222222',
        actor: { profesionalId: '33333333-3333-3333-3333-333333333333' },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.executionId).toBeTruthy();
      expect(result.correlationId).toBeTruthy();
      expect(result.provider).toBe('ollama');
      for (const manifest of savedManifests) {
        expect(manifest.executionId).toBe(result.executionId);
      }
      expect(savedManifests.some((m) => m.patientRef === '11111111-1111-1111-1111-111111111111')).toBe(false);
    }
    expect(events).toEqual(['audit-manifest', 'consent', 'audit-manifest', 'adapter']);
  });

  it('missing consent: 0 adapter calls and no fallback (terminal)', async () => {
    const policy = AIDataEgressPolicy.withInMemoryStore({
      env: () => runtimeEnv(),
      consentStatusProvider: async () => ({ status: 'missing' }),
    });
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: () => openAi,
      env: () => runtimeEnv(),
      egressPolicy: policy,
      modelRegistry: defaultRegistry(),
    });

    const result = await orchestrator.execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      requiredCapability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      egress: {
        capability: 'nutrition_reasoning',
        patientId: '11111111-1111-1111-1111-111111111111',
        sucursalId: '22222222-2222-2222-2222-222222222222',
      },
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: 'CONSENT_REQUIRED' });
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
    expect(result.attempts).toEqual([
      expect.objectContaining({ provider: 'openai', outcome: 'policy_denied', message: 'provider_phi_not_allowed' }),
      expect.objectContaining({ provider: 'ollama', outcome: 'policy_denied', message: 'consent_missing' }),
    ]);
  });

  it('unverifiable consent context: 0 adapter calls', async () => {
    const result = await orchestrator().execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      requiredCapability: 'nutrition_reasoning',
      egress: { capability: 'nutrition_reasoning', patientId: '11111111-1111-1111-1111-111111111111' },
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: 'CONSENT_REQUIRED' });
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('no eligible candidates: 0 adapter calls, safe NO_ELIGIBLE_MODEL', async () => {
    const result = await orchestrator({ env: runtimeEnv({ AI_ALLOWED_PROVIDERS: 'none' }) }).execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: 'NO_ELIGIBLE_MODEL' });
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('qualification failure: 0 adapter calls, fail closed', async () => {
    const result = await orchestrator({
      env: runtimeEnv({ AI_QUALIFICATION_ENFORCED: 'true', AI_FALLBACK_PROVIDERS: 'ollama' }),
    }).execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user', responseFormat: 'json' },
      requiredCapability: 'structured_json',
      preferredProvider: 'ollama',
    });

    expect(result).toMatchObject({ ok: false, status: 403, code: 'NO_ELIGIBLE_MODEL' });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['policy_denied']);
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('egress denial: 0 adapter calls, no provider leak to client', async () => {
    const result = await orchestrator({
      env: runtimeEnv({ AI_FALLBACK_PROVIDERS: 'openai' }),
    }).execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      requiredCapability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      egress: {
        capability: 'nutrition_reasoning',
        patientId: '11111111-1111-1111-1111-111111111111',
        sucursalId: '22222222-2222-2222-2222-222222222222',
      },
    });

    if (result.ok) throw new Error('se esperaba denegación');
    expect(result.status).toBe(403);
    expect(result.code).toBe('NO_ELIGIBLE_MODEL');
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(result.message).not.toContain('openai');
    expect(result.message).not.toContain('external');
  });

  it('breaker open with no alternative: 0 adapter calls', async () => {
    modelCircuitBreaker.recordFailure('openai:gpt-4o-mini', { threshold: 1, cooldownMs: 60_000 });
    const result = await orchestrator({ env: runtimeEnv({ AI_FALLBACK_PROVIDERS: 'openai' }) }).execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
    });

    expect(result).toMatchObject({ ok: false, status: 502, code: 'PROVIDER_UNAVAILABLE' });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['breaker_open']);
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('valid execution: exactly 1 adapter call, executionId + correlationId propagated', async () => {
    const result = await orchestrator().execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      correlationId: 'corr-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.executionId).toBeTruthy();
      expect(result.correlationId).toBe('corr-1');
      expect(result.model).toBe('gpt-4o-mini');
    }
    expect(openAi.complete).toHaveBeenCalledTimes(1);
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('operational failure on primary falls back to the next candidate (each re-gated)', async () => {
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'boom', 502); });
    const result = await orchestrator().execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      preferredProvider: 'openai',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('ollama');
    expect(openAi.complete).toHaveBeenCalledTimes(1);
    expect(ollama.complete).toHaveBeenCalledTimes(1);
    expect(result.attempts.map((a) => a.outcome)).toEqual(['provider_error', 'success']);
  });

  it('a future provider (Provider X / Model X1) is registrable without orchestrator changes', async () => {
    const providerX = fakeAdapter('x', async () => SUCCESS);
    const registry = new ModelRegistry([{
      id: 'X1',
      provider: 'x',
      providerModelName: 'X1',
      enabled: true,
      supportedCapabilities: ['chat_general'],
      supportsStructuredOutput: true,
      supportsTools: false,
      supportsEmbeddings: false,
      supportsVision: false,
      maxContextTokens: 4096,
      isDefault: true,
      respectsRequestedModel: true,
    }]);
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: (provider: string) => (provider === 'x' ? providerX : undefined),
      env: () => runtimeEnv({ AI_ALLOWED_PROVIDERS: 'x', AI_ALLOWED_MODELS: 'X1' }),
      egressPolicy: AIDataEgressPolicy.withInMemoryStore({
        env: () => runtimeEnv({ AI_ALLOWED_PROVIDERS: 'x', AI_ALLOWED_MODELS: 'X1' }),
      }),
      modelRegistry: registry,
    });

    const result = await orchestrator.execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
      preferredProvider: 'x',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('x');
      expect(result.model).toBe('X1');
    }
    expect(providerX.complete).toHaveBeenCalledTimes(1);
  });

  it('rejects unregistered adapters as failed attempts without crashing', async () => {
    const result = await orchestrator({ getProviderAdapter: () => undefined }).execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
    });

    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['provider_error', 'provider_error']);
  });

  it('maps all-timeout failures to the TIMEOUT error code', async () => {
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'timeout', 'timeout after 30s'); });
    ollama.complete = vi.fn(async () => { throw new ProviderCallError('ollama', 'timeout', 'timeout after 30s'); });
    const result = await orchestrator().execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user' },
    });

    expect(result).toMatchObject({ ok: false, status: 502, code: 'TIMEOUT' });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['provider_error', 'provider_error']);
  });

  it('policy denials never count toward the circuit breaker failure threshold', async () => {
    const env = runtimeEnv({ AI_QUALIFICATION_ENFORCED: 'true', AI_FALLBACK_PROVIDERS: 'ollama', AI_CIRCUIT_BREAKER_THRESHOLD: '2' });
    const orch = new AIOrchestrator({
      getProviderAdapter: () => ollama,
      env: () => env,
      egressPolicy: egressPolicy(),
      modelRegistry: defaultRegistry(),
    });
    const breakerConfig = { threshold: 2, cooldownMs: 30_000 };

    const denial = await orch.execute({
      request: { model: '', systemPrompt: 'sys', userPrompt: 'user', responseFormat: 'json' },
      requiredCapability: 'structured_json',
      preferredProvider: 'ollama',
    });
    expect(denial.ok).toBe(false);
    expect(ollama.complete).not.toHaveBeenCalled();
    expect(modelCircuitBreaker.isOpen('ollama:llama3.2', breakerConfig)).toBe(false);

    ollama.complete = vi.fn(async () => { throw new ProviderCallError('ollama', 'http', 'boom', 502); });
    await orch.execute({ request: { model: '', systemPrompt: 'sys', userPrompt: 'user' }, preferredProvider: 'ollama' });
    expect(modelCircuitBreaker.isOpen('ollama:llama3.2', breakerConfig)).toBe(false);

    await orch.execute({ request: { model: '', systemPrompt: 'sys', userPrompt: 'user' }, preferredProvider: 'ollama' });
    expect(modelCircuitBreaker.isOpen('ollama:llama3.2', breakerConfig)).toBe(true);
  });
});
