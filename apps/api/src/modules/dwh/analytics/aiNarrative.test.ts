import { describe, expect, it } from 'vitest';
import { buildAnalyticsNarrative, analyticsCertificationGate } from './aiNarrative.js';
import { clinicalCertificationRegistry, type ClinicalCertificationRecord } from '../../ai/certification/clinicalCertification.js';
import type { MetricResult, PeriodComparison } from '../semantic/metricService.js';

/**
 * Build 08 adversarial: la narrativa NUNCA altera números (100 ≠ 143),
 * abstiene sin modelo APPROVED_ANALYTICS para dashboard_analytics,
 * y los claims pasan la validación del Evidence Envelope.
 */

const OK_METRIC = (value: number | null): MetricResult => ({
  metricId: 'consultation_count',
  metricVersion: 'v1',
  status: 'OK',
  value,
  series: [],
  dataAsOf: '2026-08-19T06:00:00.000Z',
  stale: false,
  lagDays: 0,
  reconciliationStatus: 'OK (expected=10, loaded=10)',
  loadRunId: 3,
  suppressedCells: 0,
});

const NO_MODEL_GATE = () => analyticsCertificationGate();

function registerAnalyticsModel(): ClinicalCertificationRecord {
  const record: ClinicalCertificationRecord = {
    certificationId: 'cert-test-dashboard_analytics-v1',
    key: {
      providerId: 'test',
      modelId: 'analytics-model',
      modelVersion: '1.0',
      capabilityId: 'dashboard_analytics' as never,
      promptVersion: 'p1',
      toolsetVersion: 't1',
      policyVersion: 'pol1',
      outputSchemaVersion: 'o1',
    },
    state: 'APPROVED_ANALYTICS',
    evaluatedAt: '2026-08-19T00:00:00.000Z',
    datasetFingerprint: 'fp',
    reportRef: 'test',
  };
  clinicalCertificationRegistry.register(record);
  return record;
}

describe('analytics certification gate', () => {
  it('sin modelo dashboard_analytics APPROVED_ANALYTICS => NO_ELIGIBLE_MODEL (estado actual real)', () => {
    const gate = NO_MODEL_GATE();
    expect(gate.eligible).toBe(false);
    expect(gate.reason).toBe('NO_ELIGIBLE_MODEL');
  });

  it('abstiene con NO_ELIGIBLE_MODEL y NUNCA inventa números', () => {
    // corre antes de registrar cualquier modelo: el estado real no tiene
    // certificación dashboard_analytics APPROVED_ANALYTICS.
    const result = buildAnalyticsNarrative({ metric: OK_METRIC(100), currentPeriod: '2026-08-01..2026-08-31' });
    expect(result.status).toBe('AI_ABSTAINED');
    expect(result.reason).toBe('NO_ELIGIBLE_MODEL');
    expect(result.narrative).toBeNull();
  });

  it('con modelo registrado para dashboard_analytics => elegible', () => {
    registerAnalyticsModel();
    const gate = NO_MODEL_GATE();
    expect(gate.eligible).toBe(true);
    expect(gate.model?.certificationId).toBe('cert-test-dashboard_analytics-v1');
  });
});

describe('buildAnalyticsNarrative', () => {

  it('abstiene cuando el DWH no está listo (números aún disponibles fuera de la narrativa)', () => {
    registerAnalyticsModel();
    const result = buildAnalyticsNarrative({
      metric: { ...OK_METRIC(null), status: 'DWH_NOT_READY', value: null },
      currentPeriod: '2026-08-01..2026-08-31',
    });
    expect(result.status).toBe('AI_ABSTAINED');
    expect(result.reason).toBe('DWH_NOT_READY');
  });

  it('inmutabilidad numérica: narrativa con valor 100, nunca 143 (alucinación)', () => {
    registerAnalyticsModel();
    const result = buildAnalyticsNarrative({ metric: OK_METRIC(100), currentPeriod: '2026-08-01..2026-08-31' });
    expect(result.status).toBe('AI_GENERATED');
    expect(result.narrative).toContain('100');
    expect(result.narrative).not.toContain('143');
  });

  it('claim OBSERVED_FACT con evidencia DWH pasa la validación del envelope', async () => {
    registerAnalyticsModel();
    const result = buildAnalyticsNarrative({ metric: OK_METRIC(100), currentPeriod: '2026-08-01..2026-08-31' });
    expect(result.claims[0]!.claimType).toBe('OBSERVED_FACT');
    const item = result.claims[0]!.evidence[0]!;
    expect(item.sourceType).toBe('DWH');
    expect(item.metricId).toBe('consultation_count');
    expect(item.metricVersion).toBe('v1');
    expect(item.loadRunId).toBe(3);
    expect(item.reconciliationStatus).toContain('OK');
    const { validateEvidenceEnvelope } = await import('../../ai/contracts/evidenceEnvelope.js');
    const validation = validateEvidenceEnvelope({
      version: '2.0',
      capability: 'dashboard_analytics',
      generatedAt: '2026-08-19T00:00:00.000Z',
      claims: result.claims.map((c) => ({ ...c, confidence: 'HIGH' as const, missingInformation: [], contradictions: [] })),
      riskLevel: 'RISK_2',
      baseRisk: 'RISK_2',
      confidence: 'HIGH',
      missingInformation: [],
      contradictions: [],
      requiresProfessionalReview: false,
    });
    expect(validation.valid).toBe(true);
  });

  it('claim OBSERVED_TREND con comparación (2 observaciones) pasa la validación del envelope', async () => {
    registerAnalyticsModel();
    const comparison: PeriodComparison = {
      metricId: 'consultation_count',
      metricVersion: 'v1',
      status: 'OK',
      current: 100,
      prior: 90,
      deltaAbs: 10,
      deltaPct: 11.1,
      priorAbsent: false,
      currentAbsent: false,
      dataAsOf: '2026-08-19T06:00:00.000Z',
      stale: false,
      reconciliationStatus: 'OK',
    };
    const result = buildAnalyticsNarrative({
      metric: OK_METRIC(100),
      comparison,
      currentPeriod: '2026-08-01..2026-08-31',
      priorPeriod: '2026-07-01..2026-07-31',
    });
    expect(result.status).toBe('AI_GENERATED');
    expect(result.claims[0]!.claimType).toBe('OBSERVED_TREND');
    expect(result.claims[0]!.evidence[0]!.observations).toBe(2);
    expect(result.narrative).toContain('10 (11.1%)');
    const { validateEvidenceEnvelope } = await import('../../ai/contracts/evidenceEnvelope.js');
    const validation = validateEvidenceEnvelope({
      version: '2.0',
      capability: 'dashboard_analytics',
      generatedAt: '2026-08-19T00:00:00.000Z',
      claims: result.claims.map((c) => ({ ...c, confidence: 'HIGH' as const, missingInformation: [], contradictions: [] })),
      riskLevel: 'RISK_2',
      baseRisk: 'RISK_2',
      confidence: 'HIGH',
      missingInformation: [],
      contradictions: [],
      requiresProfessionalReview: false,
    });
    expect(validation.valid).toBe(true);
  });

  it('sin período previo comparable no divide entre cero y no declara tendencia', () => {
    registerAnalyticsModel();
    const comparison: PeriodComparison = {
      metricId: 'new_patients',
      metricVersion: 'v1',
      status: 'OK',
      current: 5,
      prior: 0,
      deltaAbs: 5,
      deltaPct: null,
      priorAbsent: true,
      currentAbsent: false,
      dataAsOf: '2026-08-19T06:00:00.000Z',
      stale: false,
      reconciliationStatus: 'OK',
    };
    const result = buildAnalyticsNarrative({
      metric: OK_METRIC(5),
      comparison,
      currentPeriod: '2026-08-01..2026-08-31',
      priorPeriod: '2026-07-01..2026-07-31',
    });
    expect(result.claims[0]!.claimType).toBe('OBSERVED_FACT');
    expect(result.narrative).toContain('No hay período previo comparable');
    expect(result.narrative).not.toContain('NaN');
    expect(result.narrative).not.toContain('Infinity');
  });
});