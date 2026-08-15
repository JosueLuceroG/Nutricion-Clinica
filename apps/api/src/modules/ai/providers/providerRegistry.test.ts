import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from './providerRegistry.js';
import { ModelRegistry } from '../models/modelRegistry.js';

const adapter = { id: 'openai' as const, complete: async () => ({ content: '', model: '', finishReason: 'stop' as const, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }) };

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
    const replacement = { ...adapter, id: 'openai' as const };
    registry.register(adapter);
    registry.register(replacement);

    expect(registry.get('openai')).toBe(replacement);
    expect(registry.list()).toHaveLength(1);
  });
});

describe('ModelRegistry', () => {
  it('seeds the default models with metadata', () => {
    const registry = new ModelRegistry();

    expect(registry.get('gpt-4o-mini')).toMatchObject({ id: 'gpt-4o-mini', provider: 'openai', supportsJson: true });
    expect(registry.get('llama3.2')).toMatchObject({ id: 'llama3.2', provider: 'ollama', supportsJson: false });
    expect(registry.list()).toHaveLength(2);
  });

  it('registers custom models and returns undefined for unknown ids', () => {
    const registry = new ModelRegistry();
    registry.register({ id: 'gpt-4o', provider: 'openai', supportsJson: true, maxTokens: 8192 });

    expect(registry.get('gpt-4o')).toMatchObject({ maxTokens: 8192 });
    expect(registry.get('unknown-model')).toBeUndefined();
  });
});