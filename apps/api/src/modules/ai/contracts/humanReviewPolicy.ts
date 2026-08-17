import type { RiskLevel } from './riskModel.js';
import { RISK_RANK } from './riskModel.js';

export type ReviewPolicy = 'not_required' | 'capability_dependent' | 'required' | 'required_escalation';

/** Política central de revisión profesional. Ni el frontend ni el modelo pueden desactivarla. */
export function reviewPolicyForRisk(risk: RiskLevel): ReviewPolicy {
  switch (risk) {
    case 'RISK_0':
      return 'not_required';
    case 'RISK_1':
    case 'RISK_2':
      return 'capability_dependent';
    case 'RISK_3':
    case 'RISK_4':
      return 'required';
    case 'RISK_5':
      return 'required_escalation';
  }
}

export function isProfessionalReviewRequired(risk: RiskLevel, capabilityReviewPolicy?: ReviewPolicy): boolean {
  const policy = capabilityReviewPolicy ?? reviewPolicyForRisk(risk);
  if (policy === 'required' || policy === 'required_escalation') return true;
  if (RISK_RANK[risk] >= 3) return true;
  return false;
}

/** Campos que el cliente jamás puede enviar para alterar la revisión/riesgo (server authoritative). */
export const REVIEW_OVERRIDE_KEYS: readonly string[] = [
  'professionalReview',
  'requiresProfessionalReview',
  'riskLevel',
  'effectiveRisk',
  'claimType',
  'confidence',
  'certificationState',
  'certificationId',
  'promptVersion',
  'toolsetVersion',
  'policyVersion',
  'outputSchemaVersion',
];

export function isReviewOverrideKey(key: string): boolean {
  return REVIEW_OVERRIDE_KEYS.includes(key);
}