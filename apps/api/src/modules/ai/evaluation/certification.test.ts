import { describe, expect, it } from 'vitest';
import { ModelQualificationRegistry, GOLDEN_DATASET_V1_FINGERPRINT, modelQualificationRegistry } from './certification.js';
import { getDatasetFingerprint } from './nutritionGoldenDataset.js';

const CURRENT = getDatasetFingerprint();

describe('ModelQualificationRegistry', () => {
  it('seeded certifications are not stale against the current golden dataset', () => {
    expect(modelQualificationRegistry.isStale('openai/gpt-4o-mini', 'chat_general', CURRENT)).toBe(false);
    expect(modelQualificationRegistry.isStale('ollama/llama3.2', 'chat_general', CURRENT)).toBe(false);
  });

  it('certifications are stale when the golden dataset fingerprint changes', () => {
    const registry = new ModelQualificationRegistry({
      'openai/gpt-4o-mini': {
        certifications: {
          chat_general: {
            capability: 'chat_general',
            status: 'certified',
            evaluatedAt: '2026-01-01T00:00:00.000Z',
            datasetFingerprint: 'nutrition-golden-v0-old',
            reportRef: 'x.json',
          },
        },
      },
    });
    expect(registry.isStale('openai/gpt-4o-mini', 'chat_general', CURRENT)).toBe(true);
  });

  it('stale check ignores non-certified statuses', () => {
    const registry = new ModelQualificationRegistry();
    expect(registry.isStale('ollama/llama3.2', 'structured_json', CURRENT)).toBe(false);
  });

  it('certify() upgrades a capability to certified', () => {
    const registry = new ModelQualificationRegistry();
    registry.certify('ollama/llama3.2', {
      capability: 'structured_json',
      status: 'certified',
      evaluatedAt: '2026-08-13T00:00:00.000Z',
      datasetFingerprint: CURRENT,
      reportRef: 'llama3.2-structured-json-v1.json',
    });
    expect(registry.isCertified('ollama/llama3.2', 'structured_json')).toBe(true);
    expect(registry.isStale('ollama/llama3.2', 'structured_json', CURRENT)).toBe(false);
  });

  it('reports qualified models as not certified', () => {
    expect(modelQualificationRegistry.isCertified('openai/gpt-4o', 'nutrition_reasoning')).toBe(false);
    expect(modelQualificationRegistry.getCertification('openai/gpt-4o', 'nutrition_reasoning')?.status).toBe('qualified');
  });

  it('frozen fingerprint constant matches the dataset fingerprint', () => {
    expect(GOLDEN_DATASET_V1_FINGERPRINT).toBe(CURRENT);
  });
});