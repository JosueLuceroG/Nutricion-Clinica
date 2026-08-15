import type { DwhStore, LoadRun } from './dwhTypes.js';
import { listMetrics } from './catalog.js';

export const DWH_ENGINE_VERSION = 'dwh-etl-v1';

export interface DailyMetricSource {
  getDailyValues(input: { metricId: string; sucursalId: string; from: string; to: string }): Promise<Array<{ date: string; value: number }>>;
}

export interface RunIncrementalLoadInput {
  store: DwhStore;
  source: DailyMetricSource;
  sucursalId: string;
  now?: Date;
  windowDays?: number;
  runId?: string;
}

export function computeLoadWindow(now: Date, windowDays: number): { from: string; to: string } {
  const from = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setUTCHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function runIncrementalLoad(input: RunIncrementalLoadInput): Promise<LoadRun> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? 7;
  const startedAt = now.toISOString();
  const metrics = listMetrics().map((metric) => metric.id);
  const { from, to } = computeLoadWindow(now, windowDays);
  const rows: Array<{ metricId: string; dimensionKey: string; value: number }> = [];

  for (const metricId of metrics) {
    try {
      const values = await input.source.getDailyValues({ metricId, sucursalId: input.sucursalId, from, to });
      for (const value of values) {
        rows.push({ metricId, dimensionKey: value.date, value: value.value });
      }
    } catch (err) {
      console.warn('[dwh] metric load failed:', metricId, err instanceof Error ? err.message : err);
      for (const loaded of rows) {
        await input.store.saveSnapshot({
          metricId: loaded.metricId,
          dimensionKey: loaded.dimensionKey,
          value: loaded.value,
          loadedAt: now.toISOString(),
          sourceRunId: input.runId ?? '',
        });
      }
      return {
        id: input.runId ?? '',
        startedAt,
        finishedAt: new Date().toISOString(),
        rowsLoaded: rows.length,
        status: 'failed',
        error: `Fallo la carga de la metrica ${metricId}`,
        metrics,
        engineVersion: DWH_ENGINE_VERSION,
      };
    }
  }

  for (const loaded of rows) {
    await input.store.saveSnapshot({
      metricId: loaded.metricId,
      dimensionKey: loaded.dimensionKey,
      value: loaded.value,
      loadedAt: now.toISOString(),
      sourceRunId: input.runId ?? '',
    });
  }

  return {
    id: input.runId ?? '',
    startedAt,
    finishedAt: new Date().toISOString(),
    rowsLoaded: rows.length,
    status: 'success',
    metrics,
    engineVersion: DWH_ENGINE_VERSION,
  };
}