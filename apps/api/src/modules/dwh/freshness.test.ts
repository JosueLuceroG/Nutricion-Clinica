import { describe, expect, it } from 'vitest';
import { computeFreshness } from './freshness.js';
import { InMemoryDwhStore } from './dwhStore.js';

const now = new Date('2026-08-14T12:00:00.000Z');

describe('computeFreshness', () => {
  it('reports stale metrics without snapshots', async () => {
    const store = new InMemoryDwhStore();
    const freshness = await computeFreshness({ store, now, maxAgeMs: 3 * 24 * 60 * 60 * 1000 });
    expect(freshness.length).toBeGreaterThanOrEqual(5);
    expect(freshness.every((f) => f.stale)).toBe(true);
    expect(freshness.every((f) => f.lastLoadedAt === null)).toBe(true);
  });

  it('marks fresh metrics whose latest snapshot is recent', async () => {
    const store = new InMemoryDwhStore();
    await store.saveSnapshot({
      metricId: 'consultas_diarias',
      dimensionKey: '2026-08-14',
      value: 12,
      loadedAt: '2026-08-14T11:00:00.000Z',
      sourceRunId: 'run-1',
    });
    await store.saveSnapshot({
      metricId: 'consultas_diarias',
      dimensionKey: '2026-08-01',
      value: 5,
      loadedAt: '2026-08-01T11:00:00.000Z',
      sourceRunId: 'run-0',
    });
    const freshness = await computeFreshness({ store, now, maxAgeMs: 3 * 24 * 60 * 60 * 1000 });
    const consultas = freshness.find((f) => f.metricId === 'consultas_diarias');
    expect(consultas?.stale).toBe(false);
    expect(consultas?.lastValue).toBe(12);
  });

  it('marks stale metrics whose latest snapshot is older than the max age', async () => {
    const store = new InMemoryDwhStore();
    await store.saveSnapshot({
      metricId: 'consultas_diarias',
      dimensionKey: '2026-08-01',
      value: 5,
      loadedAt: '2026-08-01T11:00:00.000Z',
      sourceRunId: 'run-0',
    });
    const freshness = await computeFreshness({ store, now, maxAgeMs: 3 * 24 * 60 * 60 * 1000 });
    expect(freshness.find((f) => f.metricId === 'consultas_diarias')?.stale).toBe(true);
  });
});