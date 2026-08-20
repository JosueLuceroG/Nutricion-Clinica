/**
 * Prerrequisitos de consentimiento y gobierno (Build 09.5A §69, §74-75).
 * La interpretación de la política clínica NO se inventa: requiere declaración
 * explícita del operador (SHADOW_CONSENT_POLICY=declared_ready) y config de
 * gobierno (SHADOW_GOVERNANCE_*). Sin declaración => POLICY_DECISION_REQUIRED.
 */

export interface ConsentReadiness {
  status: 'CONSENT_READY' | 'POLICY_DECISION_REQUIRED';
  detail: string;
}

export function evaluateConsentReadiness(env: NodeJS.ProcessEnv = process.env): ConsentReadiness {
  const policy = (env.SHADOW_CONSENT_POLICY ?? '').trim();
  if (policy === 'declared_ready') {
    return { status: 'CONSENT_READY', detail: 'política de consentimiento declarada lista por el operador' };
  }
  return {
    status: 'POLICY_DECISION_REQUIRED',
    detail: policy === ''
      ? 'SHADOW_CONSENT_POLICY sin declarar: decisión de política clínica requerida (nunca se asume)'
      : `SHADOW_CONSENT_POLICY='${policy}' no es una declaración válida`,
  };
}

export interface GovernanceConfig {
  configured: boolean;
  pilotOwner: string;
  clinicalOwner: string;
  technicalOwner: string;
  approvedCapabilities: string[];
  approvedReviewers: string[];
  approvalDate: string | null;
}

export function readGovernanceConfig(env: NodeJS.ProcessEnv = process.env): GovernanceConfig {
  const approvedCapabilities = (env.SHADOW_GOVERNANCE_APPROVED_CAPABILITIES ?? '')
    .split(',').map((item) => item.trim()).filter(Boolean);
  const approvedReviewers = (env.SHADOW_GOVERNANCE_APPROVED_REVIEWERS ?? '')
    .split(',').map((item) => item.trim()).filter(Boolean);
  const approvalDate = env.SHADOW_GOVERNANCE_APPROVAL_DATE?.trim() || null;

  const configured =
    Boolean(env.SHADOW_GOVERNANCE_PILOT_OWNER?.trim()) &&
    Boolean(env.SHADOW_GOVERNANCE_CLINICAL_OWNER?.trim()) &&
    Boolean(env.SHADOW_GOVERNANCE_TECHNICAL_OWNER?.trim()) &&
    approvedCapabilities.length > 0 &&
    approvedReviewers.length > 0;

  return {
    configured,
    pilotOwner: env.SHADOW_GOVERNANCE_PILOT_OWNER?.trim() ?? '',
    clinicalOwner: env.SHADOW_GOVERNANCE_CLINICAL_OWNER?.trim() ?? '',
    technicalOwner: env.SHADOW_GOVERNANCE_TECHNICAL_OWNER?.trim() ?? '',
    approvedCapabilities,
    approvedReviewers,
    approvalDate,
  };
}