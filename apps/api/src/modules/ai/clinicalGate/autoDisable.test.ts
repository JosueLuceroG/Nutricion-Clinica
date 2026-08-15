import { describe, expect, it, vi } from 'vitest';
import { ClinicalAutoDisable } from './autoDisable.js';
import { InMemoryClinicalReviewStore } from './reviewStore.js';

const now = new Date('2026-08-14T00:00:00.000Z');

describe('ClinicalAutoDisable', () => {
  it('stays enabled below the threshold', async () => {
    const store = new InMemoryClinicalReviewStore();
    await store.saveComparison({ id: 'c1', shadowRunId: 'r1', professionalId: 'p', sucursalId: 's1', reviewedAt: now.toISOString(), verdict: 'critical_disagreement' });
    const gate = new ClinicalAutoDisable(store, () => ({ expertEnabled: true, shadowModeEnabled: true, shadowSampleRate: 0.1, disagreementThreshold: 3, windowDays: 7, reviewStore: 'memory' }), () => now);
    vi.stubEnv('AI_CLINICAL_WINDOW_DAYS', '7');
    expect(await gate.isAutoDisabled('s1')).toBe(false);
    vi.unstubAllEnvs();
  });

  it('auto-disables when the threshold is reached', async () => {
    const store = new InMemoryClinicalReviewStore();
    for (let i = 0; i < 3; i += 1) {
      await store.saveComparison({ id: `c${i}`, shadowRunId: 'r1', professionalId: 'p', sucursalId: 's1', reviewedAt: now.toISOString(), verdict: 'critical_disagreement' });
    }
    const gate = new ClinicalAutoDisable(store, () => ({ expertEnabled: true, shadowModeEnabled: true, shadowSampleRate: 0.1, disagreementThreshold: 3, windowDays: 7, reviewStore: 'memory' }), () => now);
    expect(await gate.isAutoDisabled('s1')).toBe(true);
  });

  it('respects the window and sucursal scope', async () => {
    const store = new InMemoryClinicalReviewStore();
    await store.saveComparison({ id: 'old', shadowRunId: 'r1', professionalId: 'p', sucursalId: 's1', reviewedAt: '2026-08-01T00:00:00.000Z', verdict: 'critical_disagreement' });
    await store.saveComparison({ id: 'other', shadowRunId: 'r1', professionalId: 'p', sucursalId: 's2', reviewedAt: now.toISOString(), verdict: 'critical_disagreement' });
    const gate = new ClinicalAutoDisable(store, () => ({ expertEnabled: true, shadowModeEnabled: true, shadowSampleRate: 0.1, disagreementThreshold: 1, windowDays: 7, reviewStore: 'memory' }), () => now);
    expect(await gate.isAutoDisabled('s1')).toBe(false);
  });

  it('fails closed when the store is unavailable', async () => {
    const failingStore = {
      countCriticalDisagreements: async () => {
        throw new Error('db down');
      },
    } as unknown as InMemoryClinicalReviewStore;
    const gate = new ClinicalAutoDisable(failingStore, () => ({ expertEnabled: true, shadowModeEnabled: true, shadowSampleRate: 0.1, disagreementThreshold: 3, windowDays: 7, reviewStore: 'memory' }), () => now);
    expect(await gate.isAutoDisabled('s1')).toBe(true);
  });
});