import { selectTelemetryStore } from './telemetryStore.js';
import { TERMINAL_EVENT_TYPES, type TelemetryEvent } from './telemetryTypes.js';

/**
 * Agregador interno en memoria: contadores + latencia (count/p50/p95) + estados.
 * - Percentiles SOLO con muestras suficientes (AI_TELEMETRY_PERCENTILE_MIN_SAMPLES,
 *   default 5): nunca se fabrica un percentil con una observacion.
 * - Duplicados: una ejecucion terminal se cuenta UNA vez por eventType (dedup TTL 1h).
 */

export interface LatencyBucket {
  samples: number[];
  count: number;
  p50: number | null;
  p95: number | null;
  last: number | null;
}

export interface TelemetrySummary {
  counters: Map<string, number>;
  latencies: Map<string, LatencyBucket>;
  breakerStates: Map<string, { state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'; reasonCategory?: string; transitions: number }>;
  dedupGuard: Map<string, number>;
}

const summary: TelemetrySummary = {
  counters: new Map(),
  latencies: new Map(),
  breakerStates: new Map(),
  dedupGuard: new Map(),
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]!;
}

function observeLatency(key: string, ms: number, minSamples: number): void {
  let bucket = summary.latencies.get(key);
  if (!bucket) {
    bucket = { samples: [], count: 0, p50: null, p95: null, last: null };
    summary.latencies.set(key, bucket);
  }
  bucket.samples.push(ms);
  bucket.count += 1;
  bucket.last = ms;
  if (bucket.samples.length >= minSamples) {
    const sorted = [...bucket.samples].sort((a, b) => a - b);
    bucket.p50 = percentile(sorted, 50);
    bucket.p95 = percentile(sorted, 95);
  }
}

function incCounter(key: string, by = 1): void {
  summary.counters.set(key, (summary.counters.get(key) ?? 0) + by);
}

function aggregateKey(parts: Array<string | undefined>): string {
  return parts.filter((p) => p !== undefined && p !== '').join('.');
}

export function aggregateEvent(event: TelemetryEvent, minSamples = Number(process.env.AI_TELEMETRY_PERCENTILE_MIN_SAMPLES ?? 5)): void {
  const dim = aggregateKey([event.eventType, event.provider, event.model, event.capability]);

  if (TERMINAL_EVENT_TYPES.includes(event.eventType)) {
    const dedupKey = `${event.eventType}:${event.executionId}`;
    const now = Date.now();
    const last = summary.dedupGuard.get(dedupKey) ?? 0;
    if (now - last < 3_600_000) {
      incCounter(`${dim}.duplicate_suppressed`);
      return;
    }
    summary.dedupGuard.set(dedupKey, now);
  }

  incCounter(dim);
  incCounter(`${dim}.${event.status}`);

  if (event.durationMs !== undefined) {
    observeLatency(`${dim}.duration`, event.durationMs, minSamples);
  }
  if (event.latencyMs) {
    for (const [phase, ms] of Object.entries(event.latencyMs)) {
      observeLatency(`${dim}.${phase}`, ms, minSamples);
    }
  }

  if (event.eventType === 'breaker.transition') {
    const key = aggregateKey([event.provider, event.model]);
    const prev = summary.breakerStates.get(key) ?? { state: 'CLOSED' as const, transitions: 0 };
    summary.breakerStates.set(key, {
      state: event.breakerState ?? prev.state,
      reasonCategory: event.breakerReasonCategory ?? prev.reasonCategory,
      transitions: prev.transitions + 1,
    });
  }
}

export async function flushAggregates(): Promise<void> {
  const store = selectTelemetryStore();
  for (const [key, count] of summary.counters) {
    await store.recordAggregate(key, 'event', 'count', count, 1);
  }
  summary.counters.clear();
  for (const [key, bucket] of summary.latencies) {
    await store.recordAggregate(key, 'latency', 'count', bucket.count, bucket.count);
    if (bucket.p50 !== null) await store.recordAggregate(key, 'latency', 'p50', bucket.p50, bucket.count);
    if (bucket.p95 !== null) await store.recordAggregate(key, 'latency', 'p95', bucket.p95, bucket.count);
    if (bucket.last !== null) await store.recordAggregate(key, 'latency', 'last', bucket.last, bucket.count);
  }
  summary.latencies.clear();
}

export function telemetryAggregates(): {
  counters: Array<{ key: string; value: number }>;
  latencies: Array<{ key: string; bucket: LatencyBucket }>;
  breakers: Array<{ key: string; state: TelemetrySummary['breakerStates'] extends Map<string, infer V> ? V : never }>;
} {
  return {
    counters: Array.from(summary.counters.entries()).map(([key, value]) => ({ key, value })),
    latencies: Array.from(summary.latencies.entries()).map(([key, bucket]) => ({ key, bucket: { ...bucket, samples: bucket.samples.slice(-50) } })),
    breakers: Array.from(summary.breakerStates.entries()).map(([key, state]) => ({ key, state })),
  };
}

export function resetAggregatorForTests(): void {
  summary.counters.clear();
  summary.latencies.clear();
  summary.breakerStates.clear();
  summary.dedupGuard.clear();
}