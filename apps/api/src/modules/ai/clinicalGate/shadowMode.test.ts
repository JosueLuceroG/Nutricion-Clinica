import { describe, expect, it } from 'vitest';
import { ShadowMode } from './shadowMode.js';
import { readClinicalGateConfig } from './config.js';
import type { NutritionAdviceResult, NutritionWorkflow } from '../expert/nutritionWorkflow.js';

const adviceResult: NutritionAdviceResult = {
  status: 'advice',
  envelope: {
    version: '1.0',
    generatedAt: '2026-08-14T00:00:00.000Z',
    patient: { pacienteId: 'p1', sucursalId: 's1' },
    sources: [],
    calculators: [],
    safetyFlags: [],
    reviewRequired: true,
  },
  advice: { content: 'consejo' },
};

const unavailableResult: NutritionAdviceResult = {
  status: 'ai_unavailable',
  envelope: {
    version: '1.0',
    generatedAt: '2026-08-14T00:00:00.000Z',
    patient: { pacienteId: 'p1', sucursalId: 's1' },
    sources: [],
    calculators: [],
    safetyFlags: [],
    reviewRequired: true,
  },
};

const configEnabled = readClinicalGateConfig({ AI_EXPERT_ENABLED: 'true', AI_SHADOW_MODE_ENABLED: 'true', AI_SHADOW_SAMPLE_RATE: '0.5' } as NodeJS.ProcessEnv);
const configDisabled = readClinicalGateConfig({ AI_EXPERT_ENABLED: 'true' } as NodeJS.ProcessEnv);

function shadowModeWith(overrides: { workflow?: NutritionWorkflow; rand?: () => number; id?: () => string } = {}): ShadowMode {
  return new ShadowMode({
    workflow: { run: async () => adviceResult } as unknown as NutritionWorkflow,
    rand: () => 0.4,
    id: () => 'run-1',
    now: () => new Date('2026-08-14T00:00:00.000Z'),
    ...overrides,
  });
}

const input = { pacienteId: 'p1', sucursalId: 's1', goal: 'mantener' };
const actor = { profesionalId: 'prof-1', role: 'nutriologa' as const };

describe('ShadowMode', () => {
  it('never shadows when shadow mode is disabled', () => {
    expect(shadowModeWith().shouldShadow(configDisabled)).toBe(false);
  });

  it('samples according to the configured rate', () => {
    expect(shadowModeWith({ rand: () => 0.4 }).shouldShadow(configEnabled)).toBe(true);
    expect(shadowModeWith({ rand: () => 0.9 }).shouldShadow(configEnabled)).toBe(false);
  });

  it('runs the workflow and builds a served shadow run', async () => {
    const run = await shadowModeWith().run(input, actor, { served: true });
    expect(run?.id).toBe('run-1');
    expect(run?.served).toBe(true);
    expect(run?.result.status).toBe('advice');
    expect(run?.actor).toBe('prof-1');
  });

  it('returns null when the AI is unavailable', async () => {
    const shadow = shadowModeWith({ workflow: { run: async () => unavailableResult } as unknown as NutritionWorkflow });
    expect(await shadow.run(input, actor, { served: false, force: true })).toBeNull();
  });
});