import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from './providerRegistry.js';
import { ModelRegistry } from '../models/modelRegistry.js';

const adapter = { id: 'openai', complete: async () => ({ content: '', model: '', finishReason: 'stop' as const, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }) };

describe('ProviderRegistry', () => {
  it('registers, resolves and lists providers', () => {
    const registry = new ProviderRegistry();
    registry.register(adapter);

    expect(registry.get('openai')).toBe(adapter);
    expect(registry.get('ollama')).toBeUndefined();
    expect(registry.list()).toEqual([adapter]);
  });

  it('re-registering the same provider overwrites it', () => {
    const registry = new ProviderRegistry();
    const replacement = { ...adapter, id: 'openai' };
    registry.register(adapter);
    registry.register(replacement);

    expect(registry.get('openai')).toBe(replacement);
    expect(registry.list()).toHaveLength(1);
  });

  it('accepts arbitrary provider ids and stores capability metadata', () => {
    const registry = new ProviderRegistry();
    registry.register({ ...adapter, id: 'provider-x' }, { capabilities: ['chat_general'] });

    expect(registry.get('provider-x')).toBeDefined();
    expect(registry.capabilities('provider-x')).toEqual(['chat_general']);
    expect(registry.listMeta()).toHaveLength(1);
  });

  it('isEnabled reflects the provider allowlist', () => {
    const registry = new ProviderRegistry();
    expect(registry.isEnabled('openai', { AI_ALLOWED_PROVIDERS: 'openai,ollama' })).toBe(true);
    expect(registry.isEnabled('x', { AI_ALLOWED_PROVIDERS: 'openai,ollama' })).toBe(false);
    expect(registry.isEnabled('openai', {})).toBe(true);
  });
});

describe('ModelRegistry', () => {
  it('seeds the default models with runtime metadata', () => {
    const registry = new ModelRegistry();

    expect(registry.get('gpt-4o-mini')).toMatchObject({
      id: 'gpt-4o-mini',
      provider: 'openai',
      providerModelName: 'gpt-4o-mini',
      enabled: true,
      supportsStructuredOutput: true,
      isDefault: true,
      respectsRequestedModel: true,
    });
    expect(registry.get('llama3.2')).toMatchObject({
      id: 'llama3.2',
      provider: 'ollama',
      supportsStructuredOutput: false,
      respectsRequestedModel: false,
    });
    expect(registry.list()).toHaveLength(3);
  });

  it('registers custom models and returns undefined for unknown ids', () => {
    const registry = new ModelRegistry();
    registry.register({
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
    });

    expect(registry.get('gpt-4o')).toMatchObject({ maxContextTokens: 8192 });
    expect(registry.get('unknown-model')).toBeUndefined();
  });

  it('resolves the default model per provider', () => {
    const registry = new ModelRegistry();
    expect(registry.getDefaultModel('openai')).toBe('gpt-4o-mini');
    expect(registry.getDefaultModel('ollama')).toBe('llama3.2');
    expect(registry.getDefaultModelFor('openai', () => 'fallback')).toBe('gpt-4o-mini');
    expect(registry.getDefaultModelFor('provider-x', () => 'fallback')).toBe('fallback');
  });

  it('syncs env-configured models into the registry without overriding seeds', () => {
    const registry = new ModelRegistry();
    registry.syncFromEnv({ OPENAI_MODEL: 'gpt-4o', AI_MODEL: 'llama3.3' });

    expect(registry.get('gpt-4o')?.provider).toBe('openai');
    expect(registry.get('llama3.3')).toMatchObject({ provider: 'ollama', enabled: true });
    expect(registry.get('gpt-4o-mini')?.provider).toBe('openai');
  });
});
