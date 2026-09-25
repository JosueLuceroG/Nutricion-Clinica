import { describe, expect, it } from 'vitest';
import { computeLoadWindow, runIncrementalLoad, type DailyMetricSource } from './etl.js';
import { InMemoryDwhStore } from './dwhStore.js';

const now = new Date('2026-08-14T12:00:00.000Z');

const source: DailyMetricSource = {
  async getDailyValues(input) {
    if (input.metricId === 'adherencia_promedio_diaria') {
      return [
        { date: '2026-08-13', value: 78.5 },
        { date: '2026-08-14', value: 80 },
      ];
    }
    if (input.metricId === 'consultas_diarias') {
      return [{ date: '2026-08-14', value: 12 }];
    }
    return [];
  },
};

describe('computeLoadWindow', () => {
  it('computes an inclusive daily window ending today', () => {
    const { from, to } = computeLoadWindow(now, 7);
    expect(from).toBe('2026-08-07T00:00:00.000Z');
    expect(to).toBe('2026-08-14T00:00:00.000Z');
  });
});

describe('runIncrementalLoad', () => {
  it('loads snapshots for every catalog metric and records the run', async () => {
    const store = new InMemoryDwhStore();
    const run = await runIncrementalLoad({ store, source, sucursalId: 's1', now, windowDays: 7, runId: 'run-1' });

    expect(run.status).toBe('success');
    expect(run.rowsLoaded).toBeGreaterThan(0);
    expect(run.metrics.length).toBeGreaterThanOrEqual(5);
    const snapshots = await store.listSnapshots({});
    expect(snapshots.length).toBe(run.rowsLoaded);
    for (const snapshot of snapshots) {
      expect(snapshot.sourceRunId).toBe('run-1');
    }
  });

  it('is idempotent: re-running upserts without duplicating snapshots', async () => {
    const store = new InMemoryDwhStore();
    await runIncrementalLoad({ store, source, sucursalId: 's1', now, windowDays: 7, runId: 'run-1' });
    const first = await store.listSnapshots({});
    await runIncrementalLoad({ store, source, sucursalId: 's1', now, windowDays: 7, runId: 'run-2' });
    const second = await store.listSnapshots({});
    expect(second.length).toBe(first.length);
    const consulted = await store.listSnapshots({ metricId: 'consultas_diarias' });
    expect(consulted).toHaveLength(1);
    expect(consulted[0]?.sourceRunId).toBe('run-2');
  });

  it('records a failed run when a metric source throws', async () => {
    const store = new InMemoryDwhStore();
    const brokenSource: DailyMetricSource = {
      async getDailyValues(input) {
        if (input.metricId === 'consultas_diarias') throw new Error('db down');
        return [];
      },
    };
    const run = await runIncrementalLoad({ store, source: brokenSource, sucursalId: 's1', now, windowDays: 7, runId: 'run-fail' });
    expect(run.status).toBe('failed');
    expect(run.error).toContain('consultas_diarias');
  });

  it('writes only to the dwh store, never to the source', async () => {
    let sourceReads = 0;
    const countingSource: DailyMetricSource = {
      async getDailyValues(input) {
        sourceReads += 1;
        return input.metricId === 'consultas_diarias' ? [{ date: '2026-08-14', value: 1 }] : [];
      },
    };
    const store = new InMemoryDwhStore();
    await runIncrementalLoad({ store, source: countingSource, sucursalId: 's1', now, windowDays: 7, runId: 'run-3' });
    expect(sourceReads).toBeGreaterThan(0);
    const after = await store.listSnapshots({});
    expect(after.length).toBeGreaterThan(0);
  });
});