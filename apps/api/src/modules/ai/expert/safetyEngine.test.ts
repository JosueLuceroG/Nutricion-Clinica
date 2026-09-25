import { describe, expect, it } from 'vitest';
import type { PatientContext } from './contextBuilder.js';
import { assessContext, assessPhysiological, checkOutputNumbers, combineSafety } from './safetyEngine.js';

const baseContext: PatientContext = {
  pacienteId: 'pid',
  sucursalId: 'sid',
  profileMissing: false,
  conditions: [],
  recentLabs: [],
  adherence: [],
  recentConsultations: [],
};

describe('assessPhysiological', () => {
  it('flags extreme BMI as blocker', () => {
    const report = assessPhysiological({ weightKg: 35, heightM: 1.7 });
    expect(report.hasBlocker).toBe(true);
    expect(report.flags[0]?.id).toBe('phys_bmi');
  });

  it('flags low BMI as warning (referral but not blocker)', () => {
    const report = assessPhysiological({ weightKg: 45, heightM: 1.7 });
    expect(report.hasBlocker).toBe(false);
    expect(report.requiresReferral).toBe(true);
    expect(report.flags.some((f) => f.severity === 'warning')).toBe(true);
  });

  it('flags out-of-range weight and age as blockers', () => {
    const report = assessPhysiological({ weightKg: 20, ageYears: 1 });
    expect(report.hasBlocker).toBe(true);
    expect(report.flags.some((f) => f.id === 'phys_weight')).toBe(true);
    expect(report.flags.some((f) => f.id === 'phys_age')).toBe(true);
  });

  it('passes normal anthropometry without flags', () => {
    const report = assessPhysiological({ weightKg: 70, heightM: 1.75, ageYears: 30 });
    expect(report.flags).toHaveLength(0);
    expect(report.hasBlocker).toBe(false);
  });
});

describe('assessContext', () => {
  it('requires referral for a condition keyword', () => {
    const report = assessContext({ ...baseContext, conditions: ['Diabetes tipo 2 con insulina'] });
    expect(report.requiresReferral).toBe(true);
    expect(report.flags.some((f) => f.id === 'ctx_referral')).toBe(true);
  });

  it('requires referral for minors', () => {
    const report = assessContext({ ...baseContext, ageYears: 15 });
    expect(report.requiresReferral).toBe(true);
  });

  it('passes a healthy adult context', () => {
    const report = assessContext({ ...baseContext, ageYears: 35, conditions: ['hipertension leve'] });
    expect(report.requiresReferral).toBe(false);
    expect(report.flags).toHaveLength(0);
  });
});

describe('checkOutputNumbers', () => {
  it('accepts numbers backed by the evidence', () => {
    const report = checkOutputNumbers('Consume 1600 kcal y 2.1 litros de agua', [1600, 2.1, 70]);
    expect(report.hasBlocker).toBe(false);
  });

  it('blocks fabricated significant numbers', () => {
    const report = checkOutputNumbers('Tu glucosa objetivo es 140 mg/dL y 350 kcal de deficit', [350, 70]);
    expect(report.hasBlocker).toBe(true);
    expect(report.flags.some((f) => f.id === 'out_unverified_number')).toBe(true);
  });

  it('ignores routine small integers in prose', () => {
    const report = checkOutputNumbers('Come 3 a 4 veces al dia', [70]);
    expect(report.hasBlocker).toBe(false);
  });

  it('flags unverified decimals even below 50', () => {
    const report = checkOutputNumbers('Peso objetivo 64.5 kg', [70]);
    expect(report.hasBlocker).toBe(true);
  });
});

describe('combineSafety', () => {
  it('merges flags and blocks when any report blocks', () => {
    const combined = combineSafety(
      { flags: [], hasBlocker: false, requiresReferral: false },
      { flags: [{ id: 'x', severity: 'blocker', ruleId: 'r', message: 'm' }], hasBlocker: true, requiresReferral: false },
    );
    expect(combined.hasBlocker).toBe(true);
    expect(combined.flags).toHaveLength(1);
  });
});