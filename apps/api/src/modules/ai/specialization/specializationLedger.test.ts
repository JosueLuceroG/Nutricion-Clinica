import { describe, expect, it } from 'vitest';
import { InMemorySpecializationLedger, selectSpecializationLedger } from './specializationLedger.js';
import type { EvaluationVerdict } from './specializationTypes.js';

function verdict(overrides: Partial<EvaluationVerdict> = {}): EvaluationVerdict {
  return {
    candidateId: 'test_specialization',
    status: 'blocked',
    reasons: ['sin evidencia de pass rate'],
    evaluatedAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('specialization ledger', () => {
  it('records and returns the latest decision per candidate', async () => {
    const ledger = new InMemorySpecializationLedger();
    await ledger.recordDecision(verdict({ status: 'blocked', evaluatedAt: '2026-08-14T12:00:00.000Z' }));
    await ledger.recordDecision(verdict({ status: 'approved', evaluatedAt: '2026-08-14T13:00:00.000Z' }));
    const latest = await ledger.latestDecision('test_specialization');
    expect(latest?.status).toBe('approved');
  });

  it('returns undefined when there is no decision', async () => {
    const ledger = new InMemorySpecializationLedger();
    expect(await ledger.latestDecision('unknown')).toBeUndefined();
  });

  it('lists all recorded decisions', async () => {
    const ledger = new InMemorySpecializationLedger();
    await ledger.recordDecision(verdict());
    await ledger.recordDecision(verdict({ candidateId: 'other' }));
    const decisions = await ledger.listDecisions();
    expect(decisions).toHaveLength(2);
  });

  it('selects in-memory by default and sql when configured', () => {
    expect(selectSpecializationLedger({})).toBeInstanceOf(InMemorySpecializationLedger);
    expect(selectSpecializationLedger({ AI_SPECIALIZATION_STORE: 'sql' })).not.toBeInstanceOf(InMemorySpecializationLedger);
  });
});