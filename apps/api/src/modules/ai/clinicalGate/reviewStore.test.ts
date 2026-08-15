import { describe, expect, it } from 'vitest';
import { InMemoryClinicalReviewStore } from './reviewStore.js';
import type { ShadowRun } from './shadowMode.js';

function run(id: string, served: boolean, sucursalId = 's1'): ShadowRun {
  return {
    id,
    requestId: 'req',
    pacienteId: 'p1',
    sucursalId,
    actor: 'prof-1',
    runAt: '2026-08-10T00:00:00.000Z',
    served,
    result: {
      status: served ? 'advice' : 'abstained',
      envelope: {
        version: '1.0',
        generatedAt: '2026-08-10T00:00:00.000Z',
        patient: { pacienteId: 'p1', sucursalId },
        sources: [],
        calculators: [],
        safetyFlags: [],
        reviewRequired: true,
      },
      ...(served ? { advice: { content: 'x' } } : {}),
    },
  };
}

describe('InMemoryClinicalReviewStore', () => {
  it('saves and retrieves shadow runs', async () => {
    const store = new InMemoryClinicalReviewStore();
    await store.saveShadowRun(run('r1', true));
    expect((await store.getShadowRun('r1'))?.id).toBe('r1');
    expect(await store.getShadowRun('nope')).toBeUndefined();
  });

  it('lists shadow runs per sucursal ordered by runAt desc', async () => {
    const store = new InMemoryClinicalReviewStore();
    await store.saveShadowRun({ ...run('r1', false), runAt: '2026-08-01T00:00:00.000Z' });
    await store.saveShadowRun({ ...run('r2', false), runAt: '2026-08-15T00:00:00.000Z' });
    await store.saveShadowRun({ ...run('r3', false, 's2'), runAt: '2026-08-15T00:00:00.000Z' });
    const runs = await store.listShadowRuns({ sucursalId: 's1' });
    expect(runs.map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('counts critical disagreements within the window and sucursal', async () => {
    const store = new InMemoryClinicalReviewStore();
    await store.saveShadowRun(run('r1', true));
    await store.saveShadowRun(run('r2', true, 's2'));
    await store.saveComparison({ id: 'c1', shadowRunId: 'r1', professionalId: 'p', sucursalId: 's1', reviewedAt: '2026-08-14T00:00:00.000Z', verdict: 'critical_disagreement' });
    await store.saveComparison({ id: 'c2', shadowRunId: 'r2', professionalId: 'p', sucursalId: 's2', reviewedAt: '2026-08-14T00:00:00.000Z', verdict: 'critical_disagreement' });
    await store.saveComparison({ id: 'c3', shadowRunId: 'r1', professionalId: 'p', sucursalId: 's1', reviewedAt: '2026-08-01T00:00:00.000Z', verdict: 'critical_disagreement' });
    await store.saveComparison({ id: 'c4', shadowRunId: 'r1', professionalId: 'p', sucursalId: 's1', reviewedAt: '2026-08-14T00:00:00.000Z', verdict: 'aligned' });

    const since = new Date('2026-08-05T00:00:00.000Z');
    expect(await store.countCriticalDisagreements({ sucursalId: 's1', since })).toBe(1);
    expect(await store.countCriticalDisagreements({ sucursalId: null, since })).toBe(2);
  });
});