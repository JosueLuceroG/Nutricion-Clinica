import { describe, expect, it } from 'vitest';
import { ModelRouter } from './modelRouter.js';
import type { ModelInfo, ModelRegistry } from '../models/modelRegistry.js';
import { ModelRegistry as RealModelRegistry } from '../models/modelRegistry.js';
import type { ProviderDataPolicy } from '../egress/providerDataPolicy.js';

const SEED: ModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    providerModelName: 'gpt-4o-mini',
    enabled: true,
    supportedCapabilities: ['chat_general', 'structured_json'],
    supportsStructuredOutput: true,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: true,
    respectsRequestedModel: true,
  },
  {
    id: 'llama3.2',
    provider: 'ollama',
    providerModelName: 'llama3.2',
    enabled: true,
    supportedCapabilities: ['chat_general'],
    supportsStructuredOutput: false,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: true,
    respectsRequestedModel: false,
  },
  {
    id: 'disabled-model',
    provider: 'openai',
    providerModelName: 'disabled',
    enabled: false,
    supportedCapabilities: ['chat_general'],
    supportsStructuredOutput: true,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: false,
    respectsRequestedModel: true,
  },
];

const providerDataPolicy = (): ProviderDataPolicy => ({
  provider: 'openai',
  phiAllowed: false,
  locationType: 'external',
  approvedForClinicalData: false,
  dataResidency: 'any',
  retentionPolicyKnown: true,
  trainingUseAllowed: false,
});

function baseInput(registry: ModelRegistry, overrides: Partial<Parameters<ModelRouter['route']>[0]> = {}): Parameters<ModelRouter['route']>[0] {
  return {
    capability: 'chat_general',
    preferredProvider: undefined,
    preferredModel: undefined,
    providerOrder: ['openai', 'ollama'],
    env: { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_PROVIDERS: 'openai,ollama' },
    registry,
    defaultModelByProvider: (provider) => (provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini'),
    clinicalDataPossible: false,
    structuredOutputRequired: false,
    toolsRequired: false,
    ...overrides,
  };
}

describe('ModelRouter', () => {
  it('returns the ordered candidate list: primary first, then the fallback chain', () => {
    const router = new ModelRouter();
    const result = router.route(baseInput(new RealModelRegistry(SEED)));
    expect(result.candidates).toEqual([
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'ollama', model: 'llama3.2' },
    ]);
  });

  it('keeps the preferred provider first when allowed by egress policy', () => {
    const router = new ModelRouter();
    const result = router.route(baseInput(new RealModelRegistry(SEED), { preferredProvider: 'ollama' }));
    expect(result.candidates.map((c) => c.provider)).toEqual(['ollama', 'openai']);
  });

  it('ignores an invalid provider preference (no privilege elevation)', () => {
    const router = new ModelRouter();
    const result = router.route(
      baseInput(new RealModelRegistry(SEED), { preferredProvider: 'not-allowed', env: { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_PROVIDERS: 'openai' } }),
    );
    expect(result.rejected.some((r) => r.reason === 'invalid_preference')).toBe(true);
    expect(result.candidates.map((c) => c.provider)).toEqual(['openai']);
  });

  it('uses the requested model when it is registered for the primary provider', () => {
    const registry = new RealModelRegistry([...SEED, {
      id: 'gpt-4o',
      provider: 'openai',
      providerModelName: 'gpt-4o',
      enabled: true,
      supportedCapabilities: ['chat_general'],
      supportsStructuredOutput: true,
      supportsTools: false,
      supportsEmbeddings: false,
      supportsVision: false,
      maxContextTokens: 8192,
      isDefault: false,
      respectsRequestedModel: true,
    }]);
    const router = new ModelRouter();
    const result = router.route(baseInput(registry, { preferredModel: 'gpt-4o' }));
    expect(result.candidates[0]).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('never lets a client pick a model for a provider that ignores requested models', () => {
    const router = new ModelRouter();
    const result = router.route(baseInput(new RealModelRegistry(SEED), { preferredProvider: 'ollama', preferredModel: 'custom' }));
    expect(result.rejected.some((r) => r.reason === 'unknown_model' || r.reason === 'invalid_preference')).toBe(true);
    expect(result.candidates[0]).toEqual({ provider: 'ollama', model: 'llama3.2' });
  });

  it('falls back to the default model when the requested model is unknown', () => {
    const router = new ModelRouter();
    const result = router.route(baseInput(new RealModelRegistry(SEED), { preferredModel: 'nonexistent-model' }));
    expect(result.rejected.some((r) => r.reason === 'unknown_model')).toBe(true);
    expect(result.candidates[0]).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
  });

  it('excludes disabled models from the candidate list', () => {
    const router = new ModelRouter();
    const result = router.route(baseInput(new RealModelRegistry(SEED), { preferredModel: 'disabled-model' }));
    expect(result.rejected.some((r) => r.reason === 'disabled_model')).toBe(true);
    expect(result.candidates.some((c) => c.model === 'disabled-model')).toBe(false);
  });

  it('flags structured-output-incompatible candidates as ineligible', () => {
    const router = new ModelRouter();
    const result = router.route(baseInput(new RealModelRegistry(SEED), { structuredOutputRequired: true }));
    const ollama = result.ineligible.find((n) => n.model === 'llama3.2');
    expect(ollama?.reason).toBe('structured_output_unsupported');
    expect(result.ineligible.some((n) => n.model === 'gpt-4o-mini' && n.reason === 'structured_output_unsupported')).toBe(false);
  });

  it('flags PHI-incompatible candidates as ineligible when clinical data is possible', () => {
    const router = new ModelRouter();
    const result = router.route(
      baseInput(new RealModelRegistry(SEED), {
        clinicalDataPossible: true,
        providerDataPolicy: () => providerDataPolicy(),
        requiredResidency: null,
      }),
    );
    expect(result.ineligible.some((n) => n.reason === 'phi_not_allowed')).toBe(true);
  });

  it('returns no candidates (safe abstention) when no provider is allowed', () => {
    const router = new ModelRouter();
    const result = router.route(
      baseInput(new RealModelRegistry(SEED), { preferredProvider: 'ollama', env: { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_PROVIDERS: 'none' } }),
    );
    expect(result.rejected.some((r) => r.reason === 'provider_not_allowed')).toBe(true);
    expect(result.candidates).toEqual([]);
  });
});
