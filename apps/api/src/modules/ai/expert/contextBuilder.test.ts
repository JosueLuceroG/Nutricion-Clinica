import { describe, expect, it } from 'vitest';
import { buildContext, hasValidAnthropometry, numericTokensFromContext, renderContextForPrompt, type ContextDataSources, type PatientContext } from './contextBuilder.js';

const sources: ContextDataSources = {
  getProfile: async () => ({
    genero: 'Femenino',
    fecha_nacimiento: '1990-06-15',
    conditions: ['hipertension'],
  }),
  getAnthropometry: async () => ({ weightKg: 68.5, heightM: 1.65, measuredAt: '2026-07-01T10:00:00.000Z' }),
  getActivePlan: async () => ({ name: 'Plan base', kcalTarget: 1700 }),
  getRecentLabs: async () => [{ lab_name: 'Glucosa', taken_at: '2026-07-02', results_json: { glucosa: 95, hba1c: 5.6 } }],
  getAdherence: async () => [{ adherence_menu: 85 }],
  getRecentConsultations: async () => [{ consultation_number: 3 }],
};

const emptySources: ContextDataSources = {
  getProfile: async () => null,
  getAnthropometry: async () => null,
  getActivePlan: async () => null,
  getRecentLabs: async () => [],
  getAdherence: async () => [],
  getRecentConsultations: async () => [],
};

describe('buildContext', () => {
  it('builds a context from sources with age and genero normalized', async () => {
    const ctx = await buildContext(sources, { pacienteId: 'pid', sucursalId: 'sid' }, new Date('2026-08-14T00:00:00.000Z'));
    expect(ctx.profileMissing).toBe(false);
    expect(ctx.genero).toBe('femenino');
    expect(ctx.ageYears).toBe(36);
    expect(ctx.anthropometry?.weightKg).toBe(68.5);
    expect(ctx.activePlan?.kcalTarget).toBe(1700);
    expect(ctx.conditions).toEqual(['hipertension']);
  });

  it('marks the profile as missing and tolerates null data', async () => {
    const ctx = await buildContext(emptySources, { pacienteId: 'pid', sucursalId: 'sid' });
    expect(ctx.profileMissing).toBe(true);
    expect(ctx.anthropometry).toBeUndefined();
    expect(ctx.recentLabs).toEqual([]);
    expect(ctx.adherence).toEqual([]);
  });

  it('treats failed fetches as missing data instead of throwing', async () => {
    const failing: ContextDataSources = {
      getProfile: async () => {
        throw new Error('db down');
      },
      getAnthropometry: async () => null,
      getActivePlan: async () => null,
      getRecentLabs: async () => [],
      getAdherence: async () => [],
      getRecentConsultations: async () => [],
    };
    const ctx = await buildContext(failing, { pacienteId: 'pid', sucursalId: 'sid' });
    expect(ctx.profileMissing).toBe(true);
  });
});

describe('hasValidAnthropometry', () => {
  it('accepts positive weight and height', () => {
    const ctx = { ...sources, anthropometry: { weightKg: 70, heightM: 1.7, measuredAt: 'x' } } as unknown as PatientContext;
    expect(hasValidAnthropometry(ctx)).toBe(true);
  });

  it('rejects missing or zero values', () => {
    expect(hasValidAnthropometry({ anthropometry: undefined } as unknown as PatientContext)).toBe(false);
    expect(hasValidAnthropometry({ anthropometry: { weightKg: 0, heightM: 1.7, measuredAt: 'x' } } as unknown as PatientContext)).toBe(false);
  });
});

describe('renderContextForPrompt', () => {
  it('includes present data and flags missing anthropometry', async () => {
    const ctx = await buildContext(sources, { pacienteId: 'pid', sucursalId: 'sid' });
    const text = renderContextForPrompt(ctx);
    expect(text).toContain('peso 68.5 kg');
    expect(text).toContain('Plan activo: Plan base');
    expect(text).toContain('Glucosa');
  });

  it('marks anthropometry as unavailable when missing', async () => {
    const ctx = await buildContext(emptySources, { pacienteId: 'pid', sucursalId: 'sid' });
    expect(renderContextForPrompt(ctx)).toContain('NO DISPONIBLE');
  });
});

describe('numericTokensFromContext', () => {
  it('collects numbers from anthropometry, plan and nested lab results', async () => {
    const ctx = await buildContext(sources, { pacienteId: 'pid', sucursalId: 'sid' });
    const tokens = numericTokensFromContext(ctx);
    expect(tokens).toContain(68.5);
    expect(tokens).toContain(1700);
    expect(tokens).toContain(95);
    expect(tokens).toContain(5.6);
  });
});