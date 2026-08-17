import { describe, expect, it } from 'vitest';
import { ShadowMode, type ShadowModeOptions } from './shadowMode.js';
import type { NutritionWorkflow, NutritionAdviceInput, NutritionAdviceResult } from '../expert/nutritionWorkflow.js';
import type { EvidenceEnvelope } from '../expert/evidenceEnvelope.js';

function envelopeWith(clinical?: EvidenceEnvelope['clinical']): EvidenceEnvelope {
  return {
    version: '1.0',
    generatedAt: '2026-08-14T00:00:00.000Z',
    patient: { pacienteId: 'p-1', sucursalId: 's-1' },
    sources: [],
    calculators: [],
    safetyFlags: [],
    reviewRequired: true,
    clinical,
  };
}

function shadowModeWith(result: NutritionAdviceResult): ShadowMode {
  const workflow = { run: async (): Promise<NutritionAdviceResult> => result } as unknown as NutritionWorkflow;
  const options: ShadowModeOptions = {
    workflow,
    rand: () => 0,
    now: () => new Date('2026-08-14T00:00:00.000Z'),
    id: () => 'shadow-1',
  };
  return new ShadowMode(options);
}

describe('ShadowMode contrato clínico (Build 05)', () => {
  it('propaga metadata clínica segura (riesgo, confianza, abstención, revisión) al ShadowRun', async () => {
    const shadow = shadowModeWith({
      status: 'advice',
      envelope: envelopeWith({
        capability: 'nutrition_reasoning',
        baseRisk: 'RISK_3',
        effectiveRisk: 'RISK_4',
        claims: [],
        confidence: 'LOW',
        missingInformation: [],
        contradictions: [],
        requiresProfessionalReview: true,
      }),
    });
    const run = await shadow.run(
      { pacienteId: 'p-1', sucursalId: 's-1', scope: 'advice', question: 'q' } as NutritionAdviceInput,
      { profesionalId: 'prof-1', role: 'nutriologa' },
      { served: true },
    );

    expect(run).not.toBeNull();
    expect(run!.clinical).toEqual({
      capability: 'nutrition_reasoning',
      effectiveRisk: 'RISK_4',
      confidence: 'LOW',
      abstained: false,
      requiresProfessionalReview: true,
    });
  });

  it('marca abstained cuando el envelope tiene abstención formal', async () => {
    const shadow = shadowModeWith({
      status: 'abstained',
      envelope: envelopeWith({
        capability: 'nutrition_reasoning',
        baseRisk: 'RISK_3',
        effectiveRisk: 'RISK_3',
        claims: [],
        confidence: 'INSUFFICIENT_EVIDENCE',
        missingInformation: [{ code: 'REQUIRED_CAPABILITY_FIELD', detail: 'x', source: 'capability_requirements' }],
        contradictions: [],
        requiresProfessionalReview: true,
        abstention: { status: 'ABSTAINED', reasonCodes: ['MISSING_REQUIRED_DATA'], missingInformation: [], contradictions: [], riskLevel: 'RISK_3', requiresProfessionalReview: true },
      }),
    });
    const run = await shadow.run(
      { pacienteId: 'p-1', sucursalId: 's-1', scope: 'advice', question: 'q' } as NutritionAdviceInput,
      { profesionalId: 'prof-1', role: 'nutriologa' },
      { served: false },
    );
    expect(run!.clinical?.abstained).toBe(true);
    expect(run!.clinical?.confidence).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('sin contrato clínico en el envelope, el shadow run no inventa metadata', async () => {
    const shadow = shadowModeWith({ status: 'advice', envelope: envelopeWith() });
    const run = await shadow.run(
      { pacienteId: 'p-1', sucursalId: 's-1', scope: 'advice', question: 'q' } as NutritionAdviceInput,
      { profesionalId: 'prof-1', role: 'nutriologa' },
      { served: true },
    );
    expect(run!.clinical).toBeUndefined();
  });
});