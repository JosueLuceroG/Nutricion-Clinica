import { aggregateEvent, flushAggregates, telemetryAggregates } from './aggregator.js';
import { selectTelemetryStore } from './telemetryStore.js';
import type { TelemetryEvent } from './telemetryTypes.js';

/**
 * Servicio de telemetria (facade). Fail-soft por diseno:
 * - un fallo de telemetria nunca rompe el flujo de negocio;
 * - la llamada al provider NUNCA depende de un exporter opcional;
 * - auditoria obligatoria (audit_log) sigue su propia politica fail-closed.
 *
 * Overhead: emit() es sincrono y ligero (validacion PHI + agregacion en memoria);
 * la persistencia SQL es fire-and-forget.
 */

let overheadSamples: number[] = [];

export function telemetryOverheadMs(): { p50: number | null; p95: number | null; count: number } {
  const sorted = [...overheadSamples].sort((a, b) => a - b);
  if (sorted.length === 0) return { p50: null, p95: null, count: 0 };
  const idx50 = Math.ceil(0.5 * sorted.length) - 1;
  const idx95 = Math.ceil(0.95 * sorted.length) - 1;
  return {
    p50: sorted[Math.max(0, idx50)]!,
    p95: sorted[Math.max(0, idx95)]!,
    count: sorted.length,
  };
}

export function emitTelemetry(event: TelemetryEvent): void {
  const start = performance.now();
  try {
    aggregateEvent(event);
    void selectTelemetryStore()
      .record(event)
      .catch(() => { /* fail-soft */ });
  } catch {
    /* fail-soft: nunca propaga */
  } finally {
    overheadSamples.push(performance.now() - start);
    if (overheadSamples.length > 1000) overheadSamples = overheadSamples.slice(-1000);
  }
}

export async function emitTelemetryAndFlush(event: TelemetryEvent): Promise<void> {
  aggregateEvent(event);
  try {
    await selectTelemetryStore().record(event);
  } catch {
    /* fail-soft */
  }
}

export async function flushTelemetryAggregates(): Promise<void> {
  try {
    await flushAggregates();
  } catch {
    /* fail-soft */
  }
}

export function observabilitySummary(): ReturnType<typeof telemetryAggregates> & { overhead: ReturnType<typeof telemetryOverheadMs> } {
  return { ...telemetryAggregates(), overhead: telemetryOverheadMs() };
}

export async function telemetryRecentEvents(limit = 50): Promise<TelemetryEvent[]> {
  return selectTelemetryStore().recent(limit).catch(() => []);
}

export function resetTelemetryForTests(): void {
  overheadSamples = [];
}