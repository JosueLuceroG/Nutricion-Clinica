import type { EvidenceItem } from '../../ai/contracts/evidenceEnvelope.js';

/**
 * Evidencia DWH para el Evidence Envelope (Build 08).
 * Los claims OBSERVED_FACT/OBSERVED_TREND provienen del DWH (determinista),
 * con metricId/metricVersion/period/loadRunId/reconciliationStatus.
 * El LLM NUNCA fabrica estos items: solo la capa semántica los produce.
 */

export interface DwhEvidenceInput {
  metricId: string;
  metricVersion: string;
  period: string;
  loadRunId: number | null;
  reconciliationStatus: string;
  dataAsOf: string | null;
  supports: string[];
  observedAt?: string;
}

export function dwhEvidenceItem(input: DwhEvidenceInput): EvidenceItem {
  const [from, to] = input.period.split('..');
  return {
    source: 'DWH',
    sourceType: 'DWH',
    toolId: 'dwh.analytics',
    sourceRef: `${input.metricId}@${input.metricVersion}`,
    metricId: input.metricId,
    metricVersion: input.metricVersion,
    period: input.period,
    loadRunId: input.loadRunId,
    reconciliationStatus: input.reconciliationStatus,
    observedAt: input.observedAt ?? to ?? from ?? null,
    loadedAt: input.dataAsOf,
    supports: input.supports,
  };
}

export function periodRange(from: string, to: string): string {
  return `${from}..${to}`;
}