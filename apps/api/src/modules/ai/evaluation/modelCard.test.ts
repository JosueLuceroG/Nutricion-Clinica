import { describe, expect, it } from 'vitest';
import { modelCardRegistry } from './modelCard.js';
import { modelQualificationRegistry } from './certification.js';

describe('Model Card Registry', () => {
  it('has a card for every default model', () => {
    for (const key of ['openai/gpt-4o-mini', 'openai/gpt-4o', 'ollama/llama3.2']) {
      expect(modelCardRegistry.get(key)).toBeDefined();
    }
  });

  it('every card has version, license, developer and risks', () => {
    for (const card of modelCardRegistry.list()) {
      expect(card.version.length).toBeGreaterThan(0);
      expect(card.license.length).toBeGreaterThan(0);
      expect(card.developer.length).toBeGreaterThan(0);
      expect(card.risks.length).toBeGreaterThan(0);
    }
  });

  it('certifies chat_general for the default models (gateway enforces by default)', () => {
    expect(modelQualificationRegistry.isCertified('openai/gpt-4o-mini', 'chat_general')).toBe(true);
    expect(modelQualificationRegistry.isCertified('ollama/llama3.2', 'chat_general')).toBe(true);
  });

  it('only certifies structured_json for JSON-capable models', () => {
    expect(modelQualificationRegistry.isCertified('openai/gpt-4o-mini', 'structured_json')).toBe(true);
    expect(modelQualificationRegistry.isCertified('ollama/llama3.2', 'structured_json')).toBe(false);
  });
});