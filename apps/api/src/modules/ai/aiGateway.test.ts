import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIGateway } from './aiGateway.js';
import { clinicalCertificationRegistry } from './certification/clinicalCertification.js';
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

describe('AIGateway', () => {
  let openAi: AIProviderAdapter;
  let ollama: AIProviderAdapter;
  let gateway: AIGateway;

  const req = { model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' };

  beforeEach(() => {
    modelCircuitBreaker.reset();
    clinicalCertificationRegistry.clearRequalificationRequired('openai', 'gpt-4o-mini', 'chat_general');
    clinicalCertificationRegistry.clearRequalificationRequired('openai', 'gpt-4o-mini', 'structured_json');
    clinicalCertificationRegistry.clearRequalificationRequired('ollama', 'llama3.2', 'chat_general');
    openAi = fakeAdapter('openai', async () => SUCCESS);
    ollama = fakeAdapter('ollama', async () => SUCCESS);
    gateway = new AIGateway({
      getProviderAdapter: (provider) => (provider === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED' } as NodeJS.ProcessEnv,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('succeeds through the primary provider', async () => {
    const result = await gateway.complete(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('openai');
      expect(result.attempts).toEqual([expect.objectContaining({ provider: 'openai', outcome: 'success' })]);
    }
    expect(openAi.complete).toHaveBeenCalledTimes(1);
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('is fail-closed: kill switch denial is terminal and never falls back', async () => {
    const result = await new AIGateway({ getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama) }).complete(req);

    expect(result).toMatchObject({ ok: false, status: 503, message: 'IA deshabilitada' });
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('policy denials (model/provider) are terminal and never fall back', async () => {
    const deniedGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_MODELS: 'gpt-4o-mini' } as NodeJS.ProcessEnv,
    });

    const result = await deniedGateway.complete({ ...req, model: 'gpt-4o' });

    expect(result).toMatchObject({ ok: false, status: 403, message: 'Politica de egress IA deniega la solicitud' });
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('falls back to the next provider on operational failures', async () => {
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'boom', 502); });

    const result = await gateway.complete(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('ollama');
      expect(result.attempts.map((a) => a.outcome)).toEqual(['provider_error', 'success']);
    }
  });

  it('returns 502 when every candidate fails', async () => {
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'boom', 502); });
    ollama.complete = vi.fn(async () => { throw new ProviderCallError('ollama', 'network', 'ECONNREFUSED'); });

    const result = await gateway.complete(req);

    expect(result).toMatchObject({ ok: false, status: 502, message: 'Proveedor de IA no disponible' });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['provider_error', 'provider_error']);
  });

  it('returns 503 when the primary lacks server credentials and fallback also fails', async () => {
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'IA no configurada en el servidor', 503); });
    ollama.complete = vi.fn(async () => { throw new ProviderCallError('ollama', 'network', 'ECONNREFUSED'); });

    const result = await gateway.complete(req);

    expect(result).toMatchObject({ ok: false, status: 503, message: 'IA no configurada en el servidor' });
  });

  it('skips a provider whose circuit breaker is open', async () => {
    const config = { threshold: 2, cooldownMs: 60_000 };
    modelCircuitBreaker.recordFailure('openai:gpt-4o-mini', config);
    modelCircuitBreaker.recordFailure('openai:gpt-4o-mini', config);
    const breakerGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_CIRCUIT_BREAKER_THRESHOLD: '2' } as NodeJS.ProcessEnv,
    });

    const result = await breakerGateway.complete(req);

    expect(result.ok).toBe(true);
    expect(openAi.complete).not.toHaveBeenCalled();
    if (result.ok) expect(result.provider).toBe('ollama');
    expect(result.attempts.map((a) => a.outcome)).toEqual(['breaker_open', 'success']);
  });

  it('opens the circuit after repeated failures', async () => {
    const breakerGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_CIRCUIT_BREAKER_THRESHOLD: '2' } as NodeJS.ProcessEnv,
    });
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'boom', 502); });

    await breakerGateway.complete(req);
    await breakerGateway.complete(req);
    expect(openAi.complete).toHaveBeenCalledTimes(2);

    const third = await breakerGateway.complete(req);
    expect(openAi.complete).toHaveBeenCalledTimes(2);
    expect(third.attempts.map((a) => a.outcome)).toEqual(['breaker_open', 'success']);
  });

  it('allows a half-open probe after cooldown and recovers on success', async () => {
    const breakerGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_CIRCUIT_BREAKER_THRESHOLD: '1', AI_CIRCUIT_BREAKER_COOLDOWN_MS: '0' } as NodeJS.ProcessEnv,
    });
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'boom', 502); });

    await breakerGateway.complete(req);
    expect(openAi.complete).toHaveBeenCalledTimes(1);

    openAi.complete = vi.fn(async () => SUCCESS);
    const recovered = await breakerGateway.complete(req);

    expect(recovered.ok).toBe(true);
    expect(openAi.complete).toHaveBeenCalledTimes(1);
    if (recovered.ok) expect(recovered.provider).toBe('openai');
  });

  it('reports unregistered providers as failed attempts', async () => {
    const unregistered = new AIGateway({
      getProviderAdapter: () => undefined,
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED' } as NodeJS.ProcessEnv,
    });

    const result = await unregistered.complete(req);

    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['provider_error', 'provider_error']);
  });

  it('audits every candidate attempt with normalized outcomes', async () => {
    openAi.complete = vi.fn(async () => { throw new ProviderCallError('openai', 'http', 'boom', 502); });

    const result = await gateway.complete(req);

    expect(result.attempts).toEqual([
      { provider: 'openai', model: 'gpt-4o-mini', outcome: 'provider_error', status: 502, message: 'boom' },
      { provider: 'ollama', model: 'llama3.2', outcome: 'success', usage: SUCCESS.usage },
    ]);
  });

  it('denies with 403 when no candidate is certified for the required capability', async () => {
    const deniedGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_FALLBACK_PROVIDERS: 'ollama' } as NodeJS.ProcessEnv,
    });

    const result = await deniedGateway.complete(req, { preferredProvider: 'ollama', requiredCapability: 'structured_json' });

    expect(result).toMatchObject({ ok: false, status: 403, message: expect.stringContaining('no certificado') });
    expect(result.attempts.map((a) => a.outcome)).toEqual(['policy_denied']);
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('falls back to a certified candidate when the primary is not certified', async () => {
    const result = await gateway.complete({ ...req, model: 'gpt-4o-mini' }, { preferredProvider: 'ollama', requiredCapability: 'structured_json' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('openai');
    expect(result.attempts.map((a) => a.outcome)).toEqual(['policy_denied', 'success']);
  });

  it('denies with 403 when resolved models are not the pinned version', async () => {
    const pinnedGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: {
        AI_EGRESS_ENABLED: 'true',
        AI_MODEL_MODE: 'ORGANIZATION_PREFERRED',
        AI_PINNED_MODEL_VERSIONS: '{"openai":"gpt-4o-2024-08-06","ollama":"llama3.2-x"}',
      } as NodeJS.ProcessEnv,
    });

    const result = await pinnedGateway.complete(req);

    expect(result).toMatchObject({ ok: false, status: 403, message: expect.stringContaining('Version de modelo no permitida') });
    expect(openAi.complete).not.toHaveBeenCalled();
    expect(ollama.complete).not.toHaveBeenCalled();
  });

  it('skips qualification checks when AI_QUALIFICATION_ENFORCED=false', async () => {
    const lenientGateway = new AIGateway({
      getProviderAdapter: (p) => (p === 'openai' ? openAi : ollama),
      env: { AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_QUALIFICATION_ENFORCED: 'false' } as NodeJS.ProcessEnv,
    });

    const result = await lenientGateway.complete(req, { preferredProvider: 'ollama', requiredCapability: 'structured_json' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.provider).toBe('ollama');
  });
});