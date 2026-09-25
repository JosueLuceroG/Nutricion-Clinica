import { describe, expect, it } from 'vitest';
import { decideAbstention } from './abstentionPolicy.js';
import type { PatientContext } from './contextBuilder.js';
import type { SafetyReport } from './safetyEngine.js';

const ctx = (overrides: Partial<PatientContext> = {}): PatientContext => ({
  pacienteId: 'pid',
  sucursalId: 'sid',
  profileMissing: false,
  conditions: [],
  recentLabs: [],
  adherence: [],
  recentConsultations: [],
  ...overrides,
});

const safe: SafetyReport = { flags: [], hasBlocker: false, requiresReferral: false };

describe('decideAbstention', () => {
  it('proceeds when calculators are available', () => {
    expect(decideAbstention({ ctx: ctx(), safety: safe, hasCalculators: true, hasPlanTargets: false }).abstain).toBe(false);
  });

  it('proceeds when plan targets are available without anthropometry', () => {
    expect(decideAbstention({ ctx: ctx(), safety: safe, hasCalculators: false, hasPlanTargets: true }).abstain).toBe(false);
  });

  it('abstains on missing data without calculators or plan targets', () => {
    const decision = decideAbstention({ ctx: ctx(), safety: safe, hasCalculators: false, hasPlanTargets: false });
    expect(decision.abstain).toBe(true);
    expect(decision.kind).toBe('missing_data');
  });

  it('abstains when the profile is missing', () => {
    const decision = decideAbstention({ ctx: ctx({ profileMissing: true }), safety: safe, hasCalculators: true, hasPlanTargets: false });
    expect(decision.abstain).toBe(true);
    expect(decision.kind).toBe('missing_data');
    expect(decision.reason).toContain('Sin datos del paciente');
  });

  it('abstains on safety blockers with kind safety', () => {
    const blocked: SafetyReport = {
      flags: [{ id: 'phys_bmi', severity: 'blocker', ruleId: 'gsr-03', message: 'IMC extremo' }],
      hasBlocker: true,
      requiresReferral: true,
    };
    const decision = decideAbstention({ ctx: ctx(), safety: blocked, hasCalculators: true, hasPlanTargets: false });
    expect(decision.abstain).toBe(true);
    expect(decision.kind).toBe('safety');
    expect(decision.reason).toContain('IMC extremo');
  });
});