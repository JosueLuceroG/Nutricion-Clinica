import type { EvidenceItem } from '../../ai/contracts/evidenceEnvelope.js';
import { clinicalCertificationRegistry } from '../../ai/certification/clinicalCertification.js';
import { stateSatisfies } from '../../ai/certification/certificationStates.js';
import type { MetricResult, PeriodComparison } from '../semantic/metricService.js';

/**
 * Narrativa de analytics (Build 08):
 *  - determinista y plantillada; los NÚMEROS se copian VERBATIM del resultado
 *    semántico (inmutabilidad numérica: el LLM nunca define ni recalcula cifras).
 *  - requiere certificación APPROVED_ANALYTICS para capability dashboard_analytics;
 *    si no hay modelo elegible => AI_ABSTAINED / NO_ELIGIBLE_MODEL.
 *  - la API devuelve los números SIEMPRE (200 OK); la narrativa puede abstenerse.
 *  - claims OBSERVED_FACT (1 observación) u OBSERVED_TREND (>=2 observaciones),
 *    siempre con evidencia DWH (metricId/metricVersion/period/loadRunId/
 *    reconciliationStatus) validable por el Evidence Envelope.
 */

export interface AnalyticsNarrativeResult {
  status: 'AI_GENERATED' | 'AI_ABSTAINED';
  reason?: 'NO_ELIGIBLE_MODEL' | 'DWH_NOT_READY' | 'NO_DATA' | 'FAILED_RECONCILIATION' | 'METRIC_NOT_APPROVED' | 'INVALID_RANGE';
  narrative: string | null;
  claims: Array<{ id: string; text: string; claimType: 'OBSERVED_FACT' | 'OBSERVED_TREND'; evidence: EvidenceItem[] }>;
  model: { providerId: string; modelId: string; certificationId: string } | null;
}

export function analyticsCertificationGate(): { eligible: boolean; model: { providerId: string; modelId: string; certificationId: string } | null; reason?: string } {
  for (const record of clinicalCertificationRegistry.list()) {
    if (String(record.key.capabilityId) !== 'dashboard_analytics') continue;
    const flagged = clinicalCertificationRegistry.isRequalificationFlagged(record.key.providerId, record.key.modelId, record.key.capabilityId);
    if (!flagged && stateSatisfies(record.state, 'APPROVED_ANALYTICS')) {
      return { eligible: true, model: { providerId: record.key.providerId, modelId: record.key.modelId, certificationId: record.certificationId } };
    }
  }
  return { eligible: false, model: null, reason: 'NO_ELIGIBLE_MODEL' };
}

function fmtNumber(value: number | null): string | null {
  if (value === null) return null;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function baseEvidence(input: { metric: MetricResult; support: string; observations?: number; period?: string }): EvidenceItem {
  return {
    source: 'DWH',
    sourceType: 'DWH',
    toolId: 'dwh.analytics',
    metricId: input.metric.metricId,
    metricVersion: input.metric.metricVersion,
    period: input.period ?? input.metric.metricId,
    observations: input.observations,
    loadRunId: input.metric.loadRunId,
    reconciliationStatus: input.metric.reconciliationStatus,
    observedAt: input.metric.dataAsOf,
    loadedAt: input.metric.dataAsOf,
    supports: [input.support],
  };
}

export function buildAnalyticsNarrative(input: {
  metric: MetricResult;
  comparison?: PeriodComparison;
  currentPeriod: string;
  priorPeriod?: string;
}): AnalyticsNarrativeResult {
  const gate = analyticsCertificationGate();
  const metric = input.metric;

  if (!gate.eligible) {
    return { status: 'AI_ABSTAINED', reason: 'NO_ELIGIBLE_MODEL', narrative: null, claims: [], model: null };
  }
  if (metric.status !== 'OK') {
    return { status: 'AI_ABSTAINED', reason: metric.status as AnalyticsNarrativeResult['reason'], narrative: null, claims: [], model: gate.model };
  }

  const value = fmtNumber(metric.value);
  if (value === null) {
    return { status: 'AI_ABSTAINED', reason: 'NO_DATA', narrative: null, claims: [], model: gate.model };
  }

  const sentences: string[] = [];
  const factSentence = `La métrica ${metric.metricId} (v${metric.metricVersion}) es ${value}.`;
  sentences.push(factSentence);

  const comparison = input.comparison;
  const hasComparablePrior = comparison && comparison.prior !== null && !comparison.priorAbsent && comparison.deltaAbs !== null;

  let claim: AnalyticsNarrativeResult['claims'][number];
  if (hasComparablePrior) {
    const deltaAbs = fmtNumber(comparison!.deltaAbs);
    const deltaPct = fmtNumber(comparison!.deltaPct);
    const trendSentence = `Respecto al período previo, el cambio es ${deltaAbs} (${deltaPct}%).`;
    sentences.push(trendSentence);
    const support = `${factSentence} ${trendSentence}`;
    claim = {
      id: 'dwh-claim-trend',
      text: support,
      claimType: 'OBSERVED_TREND',
      evidence: [baseEvidence({ metric, support, observations: 2, period: input.priorPeriod ? `${input.priorPeriod}..${input.currentPeriod}` : input.currentPeriod })],
    };
  } else {
    if (comparison) sentences.push('No hay período previo comparable (dato ausente o cero).');
    claim = {
      id: 'dwh-claim-fact',
      text: factSentence,
      claimType: 'OBSERVED_FACT',
      evidence: [baseEvidence({ metric, support: factSentence, observations: 1 })],
    };
  }

  return {
    status: 'AI_GENERATED',
    narrative: sentences.join(' '),
    claims: [claim],
    model: gate.model,
  };
}