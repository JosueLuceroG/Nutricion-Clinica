import { describe, expect, it } from 'vitest';
import { buildEnvelope, type EvidenceEnvelope } from './evidenceEnvelope.js';
import type { PatientContext } from './contextBuilder.js';

const ctx: PatientContext = {
  pacienteId: 'pid',
  sucursalId: 'sid',
  profileMissing: false,
  conditions: [],
  anthropometry: { weightKg: 70, heightM: 1.7, measuredAt: '2026-07-01T00:00:00.000Z' },
  activePlan: { name: 'Plan base', kcalTarget: 1700 },
  recentLabs: [],
  adherence: [],
  recentConsultations: [],
};

describe('buildEnvelope', () => {
  it('assembles erp, calculator and ai sources with reviewRequired true', () => {
    const envelope = buildEnvelope({
      ctx,
      calculators: [{ id: 'calc_bmi', name: 'IMC', value: 24.2, unit: 'kg/m2', basis: 'formula' }],
      safetyFlags: [],
      ai: { provider: 'openai', model: 'gpt-4o-mini', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      reviewRequired: true,
      generatedAt: new Date('2026-08-14T00:00:00.000Z'),
    });
    expect(envelope.version).toBe('1.0');
    expect(envelope.reviewRequired).toBe(true);
    expect(envelope.sources.some((s) => s.type === 'erp' && s.ref === 'anthropometry_tool')).toBe(true);
    expect(envelope.sources.some((s) => s.type === 'calculator' && s.ref === 'calc_bmi')).toBe(true);
    expect(envelope.sources.some((s) => s.type === 'ai' && s.ref === 'openai/gpt-4o-mini')).toBe(true);
    expect(envelope.calculators[0]?.value).toBe(24.2);
  });

  it('includes abstention data when provided', () => {
    const envelope = buildEnvelope({
      ctx,
      calculators: [],
      safetyFlags: [],
      abstention: { kind: 'missing_data', reason: 'Faltan datos' },
      reviewRequired: true,
    });
    expect(envelope.abstention?.kind).toBe('missing_data');
  });

  it('omits ai source when no ai result is present', () => {
    const envelope = buildEnvelope({ ctx, calculators: [], safetyFlags: [], reviewRequired: true });
    expect(envelope.sources.some((s) => s.type === 'ai')).toBe(false);
  });

  it('serializes to a JSON-safe audit payload', () => {
    const envelope = buildEnvelope({ ctx, calculators: [], safetyFlags: [], reviewRequired: true });
    const json = JSON.parse(JSON.stringify(envelope)) as EvidenceEnvelope;
    expect(json.patient.pacienteId).toBe('pid');
    expect(json.generatedAt).toBeTruthy();
  });
});