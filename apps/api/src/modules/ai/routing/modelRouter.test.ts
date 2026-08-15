import { describe, expect, it } from 'vitest';
import { ModelRouter } from './modelRouter.js';

const defaults = {
  defaultProvider: 'openai' as const,
  defaultModelByProvider: (provider: 'openai' | 'ollama') => provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini',
};

describe('ModelRouter', () => {
  it('uses the requested model for OpenAI when provided', () => {
    expect(new ModelRouter().resolve({ provider: 'openai', model: 'gpt-4o' }, defaults))
      .toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('falls back to the server default model for OpenAI', () => {
    expect(new ModelRouter().resolve({ provider: 'openai' }, defaults))
      .toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
  });

  it('never lets the client pick the Ollama model', () => {
    expect(new ModelRouter().resolve({ provider: 'ollama', model: 'custom' }, defaults))
      .toEqual({ provider: 'ollama', model: 'llama3.2' });
  });

  it('uses the default provider when none is requested', () => {
    expect(new ModelRouter().resolve({ model: 'gpt-4o' }, defaults))
      .toEqual({ provider: 'openai', model: 'gpt-4o' });
  });
});