import { describe, expect, it } from 'vitest';
import { validateAiConfig } from './aiConfigValidation.js';
import { ModelRegistry } from '../models/modelRegistry.js';
import { ProviderRegistry } from '../providers/providerRegistry.js';
import { ModelQualificationRegistry } from '../evaluation/certification.js';

const adapter = {
  id: 'openai',
  complete: async () => ({ content: '', model: '', finishReason: 'stop' as const, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }),
};

function build() {
  const registry = new ModelRegistry();
  const providers = new ProviderRegistry();
  providers.register(adapter);
  providers.register({ ...adapter, id: 'ollama' });
  const qualifications = new ModelQualificationRegistry();
  return { registry, providers, qualifications };
}

const baseEnv = { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_PROVIDERS: 'openai,ollama' } as NodeJS.ProcessEnv;

describe('validateAiConfig', () => {
  it('passes with a coherent default configuration', () => {
    const { registry, providers, qualifications } = build();
    const issues = validateAiConfig(baseEnv, registry, providers, qualifications);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('fails fast when the default provider is unknown (no model default, provider not allowed)', () => {
    const { providers, qualifications } = build();
    const registry = new ModelRegistry([{
      id: 'mystery-model',
      provider: 'provider-x',
      providerModelName: 'mystery-model',
      enabled: true,
      supportedCapabilities: ['chat_general'],
      supportsStructuredOutput: false,
      supportsTools: false,
      supportsEmbeddings: false,
      supportsVision: false,
      maxContextTokens: 4096,
      isDefault: true,
      respectsRequestedModel: true,
    }]);
    const issues = validateAiConfig({ ...baseEnv, AI_PROVIDER: 'provider-x', AI_ALLOWED_PROVIDERS: 'provider-x' }, registry, providers, qualifications);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('AI_ALLOWED_PROVIDERS'))).toBe(true);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('No hay modelo default'))).toBe(true);
  });

  it('fails fast when an enabled model has no registered adapter', () => {
    const { registry, providers, qualifications } = build();
    providers.register({ ...adapter, id: 'ollama' });
    const issues = validateAiConfig({ ...baseEnv, AI_ALLOWED_MODELS: 'llama3.2' }, registry, providers, qualifications);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('ModelRegistry'))).toBe(false);
  });

  it('fails fast when qualification is enforced but certification metadata is missing', () => {
    const { registry, providers } = build();
    const qualifications = new ModelQualificationRegistry({});
    const issues = validateAiConfig({ ...baseEnv, AI_QUALIFICATION_ENFORCED: 'true' }, registry, providers, qualifications);
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('metadata de calificación'))).toBe(true);
  });

  it('does not block boot for a disabled optional provider without credentials', () => {
    const { registry, providers, qualifications } = build();
    const issues = validateAiConfig(
      { ...baseEnv, AI_ALLOWED_PROVIDERS: 'openai', OPENAI_API_KEY: '', AI_MODEL: 'llama3.2' },
      registry,
      providers,
      qualifications,
    );
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('warns (not errors) when the fallback provider is not registered', () => {
    const { registry, providers, qualifications } = build();
    const issues = validateAiConfig({ ...baseEnv, AI_FALLBACK_PROVIDERS: 'openai,grok' }, registry, providers, qualifications);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});