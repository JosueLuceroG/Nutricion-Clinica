import { describe, expect, it } from 'vitest';
import { applyClaimedRisk, computeEffectiveRisk, isRiskAtLeast, RISK_LEVELS, RISK_RANK } from './riskModel.js';
import { capabilityRiskRegistry } from './capabilityRiskRegistry.js';
import { isProfessionalReviewRequired, reviewPolicyForRisk, REVIEW_OVERRIDE_KEYS } from './humanReviewPolicy.js';
import { canAutoPersistClinicalTruth } from './persistenceGuard.js';
import { minCertificationForRisk, requiredCertificationFor } from '../certification/certificationStates.js';

describe('riskModel (Build 05, spec 58)', () => {
  it('define los seis niveles con ranking estricto', () => {
    expect(RISK_LEVELS).toEqual(['RISK_0', 'RISK_1', 'RISK_2', 'RISK_3', 'RISK_4', 'RISK_5']);
    expect(RISK_RANK.RISK_5).toBeGreaterThan(RISK_RANK.RISK_4);
    expect(isRiskAtLeast('RISK_3', 'RISK_2')).toBe(true);
    expect(isRiskAtLeast('RISK_1', 'RISK_2')).toBe(false);
  });

  it('sin señales mantiene el riesgo base', () => {
    expect(computeEffectiveRisk('RISK_3')).toBe('RISK_3');
    expect(computeEffectiveRisk('RISK_4', {})).toBe('RISK_4');
  });

  it('redFlag o flag blocker eleva a RISK_5', () => {
    expect(computeEffectiveRisk('RISK_1', { redFlag: true })).toBe('RISK_5');
    expect(computeEffectiveRisk('RISK_3', { safetyFlags: [{ id: 'x', severity: 'blocker' }] })).toBe('RISK_5');
  });

  it('criticalLab / relevantMedication / highRiskPatientContext / highRiskToolResult elevan a RISK_4', () => {
    expect(computeEffectiveRisk('RISK_1', { criticalLab: true })).toBe('RISK_4');
    expect(computeEffectiveRisk('RISK_1', { relevantMedication: true })).toBe('RISK_4');
    expect(computeEffectiveRisk('RISK_1', { highRiskPatientContext: true })).toBe('RISK_4');
    expect(computeEffectiveRisk('RISK_1', { highRiskToolResult: true })).toBe('RISK_4');
  });

  it('contradicciones / datos críticos ausentes / incertidumbre / alergias / personalización elevan a RISK_3', () => {
    expect(computeEffectiveRisk('RISK_1', { contradictionsDetected: true })).toBe('RISK_3');
    expect(computeEffectiveRisk('RISK_1', { criticalDataMissing: true })).toBe('RISK_3');
    expect(computeEffectiveRisk('RISK_1', { majorUncertainty: true })).toBe('RISK_3');
    expect(computeEffectiveRisk('RISK_1', { relevantAllergies: true })).toBe('RISK_3');
    expect(computeEffectiveRisk('RISK_1', { personalizedRecommendation: true })).toBe('RISK_3');
    expect(computeEffectiveRisk('RISK_1', { safetyFlags: [{ id: 'y', severity: 'warning' }] })).toBe('RISK_3');
  });

  it('el riesgo efectivo nunca disminuye respecto del base', () => {
    for (const base of RISK_LEVELS) {
      const signals: Array<{
        redFlag?: boolean;
        criticalLab?: boolean;
        contradictionsDetected?: boolean;
        criticalDataMissing?: boolean;
        majorUncertainty?: boolean;
        safetyFlags?: Array<{ id: string; severity: 'info' | 'warning' | 'blocker' }>;
      }> = [
        {},
        { redFlag: true },
        { criticalLab: true },
        { contradictionsDetected: true },
        { criticalDataMissing: true },
        { majorUncertainty: true },
        { safetyFlags: [{ id: 'w', severity: 'warning' }] },
        { safetyFlags: [{ id: 'b', severity: 'blocker' }] },
      ];
      for (const s of signals) {
        expect(RISK_RANK[computeEffectiveRisk(base, s)]).toBeGreaterThanOrEqual(RISK_RANK[base]);
      }
    }
  });

  it('señales desconocidas no declaran seguridad: solo elevan lo real', () => {
    expect(computeEffectiveRisk('RISK_2', { contradictionsDetected: true, criticalDataMissing: true })).toBe('RISK_3');
  });

  it('applyClaimedRisk: el LLM no puede bajar el riesgo computado', () => {
    expect(applyClaimedRisk('RISK_3', { criticalLab: true }, 'RISK_1')).toBe('RISK_4');
    expect(applyClaimedRisk('RISK_3', { criticalLab: true }, 'RISK_2')).toBe('RISK_4');
    expect(applyClaimedRisk('RISK_3', { criticalLab: true }, 'RISK_4')).toBe('RISK_4');
  });

  it('applyClaimedRisk: sin claim devuelve el cómputo determinista', () => {
    expect(applyClaimedRisk('RISK_2', { contradictionsDetected: true })).toBe('RISK_3');
    expect(applyClaimedRisk('RISK_2', {})).toBe('RISK_2');
  });
});

describe('capabilityRiskRegistry (Build 05)', () => {
  it('cada capability egress tiene registro de riesgo con piso de certificación', () => {
    for (const capabilityId of [
      'model_evaluation',
      'generic_assistant',
      'chat_general',
      'patient_education',
      'structured_json',
      'dashboard_analytics',
      'clinical_summary',
      'patient_overview',
      'nutrition_reasoning',
      'lab_interpretation',
      'clinical_notes_draft',
      'patient_support',
      'meal_substitution',
      'goal_suggestion',
      'meal_plan_generation',
      'meal_plan_authoring',
    ]) {
      const entry = capabilityRiskRegistry.get(capabilityId);
      expect(entry, capabilityId).toBeDefined();
      expect(RISK_LEVELS).toContain(entry!.baseRisk);
    }
  });

  it('patient_support exige APPROVED_PATIENT incluso en su piso (spec 50)', () => {
    const entry = capabilityRiskRegistry.get('patient_support');
    expect(entry?.baseRisk).toBe('RISK_3');
    expect(requiredCertificationFor(entry!.baseRisk, entry!.minimumModelCertification)).toBe('APPROVED_PATIENT');
  });

  it('meal_plan_authoring base RISK_4 → APPROVED_CLINICAL_SUPPORT por riesgo', () => {
    const entry = capabilityRiskRegistry.get('meal_plan_authoring');
    expect(entry?.baseRisk).toBe('RISK_4');
    expect(requiredCertificationFor('RISK_4', entry!.minimumModelCertification)).toBe('APPROVED_CLINICAL_SUPPORT');
  });

  it('nutrition_reasoning exige APPROVED_NUTRITION_SUPPORT', () => {
    const entry = capabilityRiskRegistry.get('nutrition_reasoning');
    expect(entry?.baseRisk).toBe('RISK_3');
    expect(requiredCertificationFor('RISK_3', entry!.minimumModelCertification)).toBe('APPROVED_NUTRITION_SUPPORT');
  });

  it('capability sin registro de riesgo: fail-closed (DENY)', () => {
    expect(capabilityRiskRegistry.get('capability_inexistente')).toBeUndefined();
  });

  it('minCertificationForRisk mapea cada nivel', () => {
    expect(minCertificationForRisk('RISK_0')).toBe('APPROVED_GENERAL');
    expect(minCertificationForRisk('RISK_1')).toBe('APPROVED_GENERAL');
    expect(minCertificationForRisk('RISK_2')).toBe('APPROVED_ANALYTICS');
    expect(minCertificationForRisk('RISK_3')).toBe('APPROVED_NUTRITION_SUPPORT');
    expect(minCertificationForRisk('RISK_4')).toBe('APPROVED_CLINICAL_SUPPORT');
    expect(minCertificationForRisk('RISK_5')).toBe('APPROVED_CLINICAL_SUPPORT');
  });
});

describe('humanReviewPolicy (Build 05)', () => {
  it('RISK_0 sin revisión; RISK_1-2 dependiente; RISK_3-4 requerida; RISK_5 escalada', () => {
    expect(reviewPolicyForRisk('RISK_0')).toBe('not_required');
    expect(reviewPolicyForRisk('RISK_1')).toBe('capability_dependent');
    expect(reviewPolicyForRisk('RISK_2')).toBe('capability_dependent');
    expect(reviewPolicyForRisk('RISK_3')).toBe('required');
    expect(reviewPolicyForRisk('RISK_4')).toBe('required');
    expect(reviewPolicyForRisk('RISK_5')).toBe('required_escalation');
  });

  it('RISK_3+ requiere revisión profesional incondicionalmente', () => {
    expect(isProfessionalReviewRequired('RISK_3')).toBe(true);
    expect(isProfessionalReviewRequired('RISK_4')).toBe(true);
    expect(isProfessionalReviewRequired('RISK_5')).toBe(true);
    expect(isProfessionalReviewRequired('RISK_1')).toBe(false);
  });

  it('las claves de override de revisión/riesgo son server-authoritative', () => {
    expect(REVIEW_OVERRIDE_KEYS).toContain('professionalReview');
    expect(REVIEW_OVERRIDE_KEYS).toContain('riskLevel');
    expect(REVIEW_OVERRIDE_KEYS).toContain('confidence');
    expect(REVIEW_OVERRIDE_KEYS).toContain('certificationState');
  });
});

describe('persistenceGuard (Build 05)', () => {
  it('RISK_3+ nunca se auto-persiste como verdad clínica', () => {
    expect(canAutoPersistClinicalTruth('RISK_0')).toBe(true);
    expect(canAutoPersistClinicalTruth('RISK_1')).toBe(true);
    expect(canAutoPersistClinicalTruth('RISK_2')).toBe(true);
    expect(canAutoPersistClinicalTruth('RISK_3')).toBe(false);
    expect(canAutoPersistClinicalTruth('RISK_4')).toBe(false);
    expect(canAutoPersistClinicalTruth('RISK_5')).toBe(false);
  });
});