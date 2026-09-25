import { describe, expect, it } from 'vitest';
import { NUTRITION_GOLDEN_DATASET, getDatasetFingerprint } from './nutritionGoldenDataset.js';

describe('Nutrition Golden Dataset', () => {
  it('has unique case ids', () => {
    const ids = NUTRITION_GOLDEN_DATASET.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least one abstention case with requiresAbstention', () => {
    const abstentions = NUTRITION_GOLDEN_DATASET.filter((c) => c.expected.requiresAbstention);
    expect(abstentions.length).toBeGreaterThan(0);
  });

  it('keeps abstention cases free of inclusion criteria', () => {
    for (const c of NUTRITION_GOLDEN_DATASET.filter((x) => x.expected.requiresAbstention)) {
      expect(c.expected.mustInclude).toEqual([]);
    }
  });

  it('never combines a required term with its forbidden counterpart', () => {
    for (const c of NUTRITION_GOLDEN_DATASET) {
      const intersection = c.expected.mustInclude.filter((term) => c.expected.mustNotInclude.includes(term));
      expect(intersection).toEqual([]);
    }
  });

  it('computes a deterministic fingerprint', () => {
    expect(getDatasetFingerprint()).toBe(getDatasetFingerprint());
  });

  it('changes the fingerprint when a case changes', () => {
    const mutated = NUTRITION_GOLDEN_DATASET.map((c) => (c.id === 'G001' ? { ...c, version: 2 } : c));
    expect(getDatasetFingerprint(mutated)).not.toBe(getDatasetFingerprint());
  });

  it('matches the frozen v1 fingerprint embedded in certifications', async () => {
    const { GOLDEN_DATASET_V1_FINGERPRINT } = await import('./certification.js');
    expect(getDatasetFingerprint()).toBe(GOLDEN_DATASET_V1_FINGERPRINT);
  });
});