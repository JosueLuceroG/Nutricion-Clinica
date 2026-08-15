import { listMetrics } from './catalog.js';
import type { DwhStore } from './dwhTypes.js';

export interface MetricFreshness {
  metricId: string;
  lastLoadedAt: string | null;
  lastValue: number | null;
  stale: boolean;
  maxAgeMs: number;
}

export async function computeFreshness(input: { store: DwhStore; now: Date; maxAgeMs: number }): Promise<MetricFreshness[]> {
  const result: MetricFreshness[] = [];
  for (const metric of listMetrics()) {
    const snapshots = await input.store.listSnapshots({ metricId: metric.id });
    const latest = snapshots
      .filter((snapshot) => snapshot.dimensionKey !== 'latest')
      .sort((a, b) => b.dimensionKey.localeCompare(a.dimensionKey))[0];
    const lastLoadedAt = latest ? latest.loadedAt : null;
    const stale = lastLoadedAt === null || input.now.getTime() - new Date(lastLoadedAt).getTime() > input.maxAgeMs;
    result.push({
      metricId: metric.id,
      lastLoadedAt,
      lastValue: latest ? latest.value : null,
      stale,
      maxAgeMs: input.maxAgeMs,
    });
  }
  return result;
}