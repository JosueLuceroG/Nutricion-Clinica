import { describe, expect, it } from 'vitest';
import { InMemorySpecializationLedger } from './specializationLedger.js';
import { SpecializationService } from './specializationService.js';
import { defaultSpecializationCandidates } from './specializationCandidates.js';
import type { SpecializationCandidate, SpecializationLedger, EvaluationVerdict } from './specializationTypes.js';

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

function build(overrides: { candidates?: SpecializationCandidate[]; ledger?: SpecializationLedger; enabled?: boolean; passRates?: object } = {}): SpecializationService {
  return new SpecializationService({
    ledger: overrides.ledger ?? new InMemorySpecializationLedger(),
    candidates: overrides.candidates ?? [candidate()],
    config: () => ({
      enabled: overrides.enabled ?? true,
      store: 'memory',
      passRates: (overrides.passRates ?? { nutrition_reasoning: 0.5 }) as Record<string, number>,
    }),
    now: () => NOW,
  });
}

describe('specialization service', () => {
  it('approves a candidate when all criteria and governance are met', async () => {
    const service = build();
    const result = await service.evaluate('test_specialization');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verdict.status).toBe('approved');
    expect(result.value.verdict.reasons).toEqual([]);
    expect(result.value.evidence.ragRecall).toBeGreaterThan(0);
  });

  it('blocks seed candidates while retrieval remains healthy (fail-closed default)', async () => {
    const service = build({ candidates: defaultSpecializationCandidates(), passRates: {} });
    for (const id of ['nutrition_fine_tuning', 'dietitian_lora', 'adherence_predictive_model']) {
      const result = await service.evaluate(id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.verdict.status).toBe('blocked');
      expect(result.value.verdict.reasons.length).toBeGreaterThan(0);
    }
  });

  it('blocks when pass rate evidence is missing (fail-closed)', async () => {
    const service = build({ passRates: {} });
    const result = await service.evaluate('test_specialization');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verdict.status).toBe('blocked');
    expect(result.value.verdict.reasons.some((r) => r.includes('sin evidencia de pass rate'))).toBe(true);
  });

  it('blocks when retrieval does not evidence insufficiency', async () => {
    const service = build({
      candidates: [candidate({ evidenceCriteria: [{ kind: 'rag_recall', comparison: 'lt', value: 0.6 }] })],
    });
    const result = await service.evaluate('test_specialization');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.verdict.status).toBe('blocked');
    expect(result.value.verdict.reasons.some((r) => r.includes('recall RAG actual'))).toBe(true);
  });

  it('returns 404 for unknown candidates', async () => {
    const service = build();
    const result = await service.evaluate('unknown_candidate');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it('fails closed when disabled', async () => {
    const service = build({ enabled: false });
    const result = await service.evaluate('test_specialization');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
  });

  it('fails closed when the ledger is unavailable', async () => {
    const brokenLedger: SpecializationLedger = {
      recordDecision: async () => {
        throw new Error('db down');
      },
      latestDecision: async () => {
        throw new Error('db down');
      },
      listDecisions: async () => [],
    };
    const service = build({ ledger: brokenLedger });
    const result = await service.evaluate('test_specialization');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(503);
  });

  it('records decisions in the ledger', async () => {
    const ledger = new InMemorySpecializationLedger();
    const service = build({ ledger });
    const result = await service.evaluate('test_specialization');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const latest = await ledger.latestDecision('test_specialization');
    expect(latest?.status).toBe('approved');
    expect(latest?.evaluatedAt).toBe(NOW.toISOString());
  });

  it('lists candidates with their latest decision', async () => {
    const service = build();
    await service.evaluate('test_specialization');
    const result = await service.listSummaries();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.candidate.id).toBe('test_specialization');
    expect((result.value[0]?.latestDecision as EvaluationVerdict | undefined)?.status).toBe('approved');
  });
});