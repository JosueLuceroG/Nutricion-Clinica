import { describe, expect, it } from 'vitest';
import { evaluateCandidate } from './specializationPolicy.js';
import type { EvidenceSnapshot, SpecializationCandidate } from './specializationTypes.js';

const NOW = new Date('2026-08-14T12:00:00.000Z');

function candidate(overrides: Partial<SpecializationCandidate> = {}): SpecializationCandidate {
  return {
    id: 'test_specialization',
    name: 'Test',
    description: 'd',
    kind: 'fine_tuning',
    dataSource: 'synthetic',
    governance: {
      requiresPHI: false,
      legalReview: false,
      privacyReview: false,
      deidentification: false,
      retentionDays: null,
      professionalApproval: true,
    },
    evidenceCriteria: [{ kind: 'model_pass_rate', comparison: 'lt', value: 0.9, capability: 'nutrition_reasoning' }],
    ...overrides,
  };
}

function evidence(overrides: Partial<EvidenceSnapshot> = {}): EvidenceSnapshot {
  return { ragRecall: 1, passRates: { nutrition_reasoning: 0.5 }, costPerCompletion: 0.00045, ...overrides };
}

describe('specialization policy', () => {
  it('approves only when all evidence and governance are met', () => {
    const verdict = evaluateCandidate(candidate(), evidence(), NOW);
    expect(verdict.status).toBe('approved');
    expect(verdict.reasons).toEqual([]);
    expect(verdict.evaluatedAt).toBe(NOW.toISOString());
  });

  it('blocks without RAG evidence (fail-closed)', () => {
    const verdict = evaluateCandidate(candidate({ evidenceCriteria: [{ kind: 'rag_recall', comparison: 'lt', value: 0.6 }] }), evidence({ ragRecall: null }), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons.some((r) => r.includes('sin evidencia de recall'))).toBe(true);
  });

  it('blocks when retrieval does not evidence insufficiency', () => {
    const verdict = evaluateCandidate(candidate({ evidenceCriteria: [{ kind: 'rag_recall', comparison: 'lt', value: 0.6 }] }), evidence(), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons.some((r) => r.includes('no evidencia insuficiencia'))).toBe(true);
  });

  it('blocks when the pass rate is not below the threshold', () => {
    const verdict = evaluateCandidate(candidate(), evidence({ passRates: { nutrition_reasoning: 0.95 } }), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons.some((r) => r.includes('no evidencia insuficiencia'))).toBe(true);
  });

  it('blocks without pass rate evidence for the capability', () => {
    const verdict = evaluateCandidate(candidate(), evidence({ passRates: {} }), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons.some((r) => r.includes('sin evidencia de pass rate'))).toBe(true);
  });

  it('blocks when cost per completion is not above the threshold', () => {
    const verdict = evaluateCandidate(candidate({ evidenceCriteria: [{ kind: 'cost_per_completion', comparison: 'gt', value: 0.01 }] }), evidence(), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons.some((r) => r.includes('no supera'))).toBe(true);
  });

  it('blocks PHI candidates without full governance', () => {
    const phi = candidate({
      dataSource: 'phi',
      governance: {
        requiresPHI: true,
        legalReview: false,
        privacyReview: true,
        deidentification: true,
        retentionDays: 90,
        professionalApproval: true,
      },
    });
    const verdict = evaluateCandidate(phi, evidence(), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons).toContain('falta revision legal para PHI');
  });

  it('approves PHI candidates only with legal, privacy, deidentification, retention and approval', () => {
    const phi = candidate({
      dataSource: 'phi',
      governance: {
        requiresPHI: true,
        legalReview: true,
        privacyReview: true,
        deidentification: true,
        retentionDays: 90,
        professionalApproval: true,
      },
    });
    const verdict = evaluateCandidate(phi, evidence(), NOW);
    expect(verdict.status).toBe('approved');
  });

  it('requires professional approval for non-PHI candidates', () => {
    const verdict = evaluateCandidate(candidate({ governance: { ...candidate().governance, professionalApproval: false } }), evidence(), NOW);
    expect(verdict.status).toBe('blocked');
    expect(verdict.reasons).toContain('falta aprobacion profesional');
  });
});