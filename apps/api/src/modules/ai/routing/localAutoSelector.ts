import type { LocalHardwareProfile } from '../hardware/hardwareProfile.js';
import type { RiskLevel } from '../contracts/riskModel.js';
import type { CandidateManifestEntry } from '../models/candidateManifest.js';
import type { DeploymentProfile } from '../models/deploymentProfile.js';
import type { CertificationResolution } from '../certification/clinicalCertification.js';

/**
 * NUTRICLINICA_LOCAL_AUTO: "selecciona el mejor candidato LOCAL elegible para
 * esta ejecución exacta". NUNCA significa "usa llama3.2" ni "un modelo global".
 * Sin candidato elegible -> ABSTAIN / NO_ELIGIBLE_LOCAL_MODEL.
 * Sin fallback a cloud silencioso: requiere política explícita.
 */

export interface LocalCandidateStatus {
  candidate: CandidateManifestEntry;
  deployment: DeploymentProfile;
  hardwareCompatible: boolean;
  providerHealthy: boolean;
  capabilitySupported: boolean;
  structuredSupported: boolean;
  toolsSupported: boolean;
  riskCompatible: boolean;
  certification: CertificationResolution;
  benchmarkRank: number | null;
  qualityRank: number | null;
  latencyMs: number | null;
  excludedReasons: string[];
}

export interface LocalAutoSelectionInput {
  capabilityId: string;
  effectiveRisk: RiskLevel;
  requiredStructuredOutput: boolean;
  requiredTools: boolean;
  requirePhi: boolean;
  clientPreference: { providerId: string; modelId: string } | null;
  candidates: LocalCandidateStatus[];
  /** Política de la organización: LOCAL_ONLY | LOCAL_PREFERRED_ALLOW_CLOUD */
  fallbackPolicy: 'LOCAL_ONLY' | 'LOCAL_PREFERRED_ALLOW_CLOUD';
  hardwareProfile: LocalHardwareProfile;
  requiredCertificationState: string;
  allowExperimental: boolean;
}

export interface LocalAutoSelectionResult {
  selected: { providerId: string; modelId: string; deploymentFingerprint: string; candidateId: string } | null;
  ranked: Array<{ candidateId: string; deploymentFingerprint: string; rank: number; why: string[] }>;
  excluded: Array<{ candidateId: string; reasons: string[] }>;
  abstained: boolean;
  reason: 'SELECTED' | 'NO_ELIGIBLE_LOCAL_MODEL' | 'NONE_ELIGIBLE_FOR_RISK' | 'HARDWARE_UNKNOWN';
  setupRequired: boolean;
  cloudFallbackAllowed: boolean;
}

const SAFETY_PRIORITY = ['certification', 'safety', 'abstention', 'grounding', 'quality', 'latency'] as const;

function isCandidateEligible(status: LocalCandidateStatus, input: LocalAutoSelectionInput): string[] {
  const reasons: string[] = [];
  if (!status.candidate.enabled) reasons.push('candidate_disabled');
  if (!status.candidate.installed) reasons.push('not_installed');
  if (status.candidate.certificationStatus === 'BLOCKED') reasons.push('blocked_model');
  if (!status.hardwareCompatible) reasons.push('hardware_incompatible');
  if (!status.providerHealthy) reasons.push('breaker_open');
  if (!status.capabilitySupported) reasons.push('capability_unsupported');
  if (input.requiredStructuredOutput && !status.structuredSupported) reasons.push('structured_output_unsupported');
  if (input.requiredTools && !status.toolsSupported) reasons.push('tools_unsupported');
  if (!status.riskCompatible) reasons.push('risk_incompatible');
  if (input.requirePhi && !status.candidate.local) reasons.push('phi_not_allowed');
  if (status.certification.stale) reasons.push('stale_certification');
  if (status.certification.requalificationRequired) reasons.push('requalification_required');
  if (!status.certification.eligible) reasons.push(`certification_insufficient:${status.certification.reason ?? 'unknown'}`);
  if (input.clientPreference) {
    const matches =
      status.candidate.providerId === input.clientPreference.providerId && status.candidate.modelId === input.clientPreference.modelId;
    if (!matches) reasons.push('not_client_preferred');
  }
  return reasons;
}

export function selectLocalModel(input: LocalAutoSelectionInput): LocalAutoSelectionResult {
  if (input.hardwareProfile.hardwareClass === 'UNKNOWN') {
    return { selected: null, ranked: [], excluded: [], abstained: true, reason: 'HARDWARE_UNKNOWN', setupRequired: true, cloudFallbackAllowed: input.fallbackPolicy === 'LOCAL_PREFERRED_ALLOW_CLOUD' };
  }

  const eligible: Array<LocalCandidateStatus & { why: string[] }> = [];
  const excluded: Array<{ candidateId: string; reasons: string[] }> = [];
  for (const status of input.candidates) {
    const reasons = isCandidateEligible(status, input);
    if (reasons.length > 0) {
      excluded.push({ candidateId: status.candidate.candidateId, reasons });
      continue;
    }
    const why: string[] = [];
    if (status.certification.state && status.certification.state === input.requiredCertificationState) why.push(`certificacion exacta ${status.certification.state}`);
    if (status.benchmarkRank !== null) why.push(`benchmark rank ${status.benchmarkRank}`);
    eligible.push({ ...status, why });
  }

  if (eligible.length === 0) {
    const cloudAllowed = input.fallbackPolicy === 'LOCAL_PREFERRED_ALLOW_CLOUD';
    return {
      selected: null,
      ranked: [],
      excluded,
      abstained: true,
      reason: 'NO_ELIGIBLE_LOCAL_MODEL',
      setupRequired: true,
      cloudFallbackAllowed: cloudAllowed,
    };
  }

  const ranked = eligible
    .slice()
    .sort((a, b) => {
      const certA = a.certification.state === input.requiredCertificationState ? 1 : 0;
      const certB = b.certification.state === input.requiredCertificationState ? 1 : 0;
      if (certB !== certA) return certB - certA;
      const safetyA = a.candidate.certificationStatus === 'BLOCKED' ? -1 : 0;
      const safetyB = b.candidate.certificationStatus === 'BLOCKED' ? -1 : 0;
      if (safetyB !== safetyA) return safetyB - safetyA;
      const qA = a.qualityRank ?? Number.MAX_SAFE_INTEGER;
      const qB = b.qualityRank ?? Number.MAX_SAFE_INTEGER;
      if (qB !== qA) return qA - qB;
      const lA = a.latencyMs ?? Number.MAX_SAFE_INTEGER;
      const lB = b.latencyMs ?? Number.MAX_SAFE_INTEGER;
      return lA - lB;
    })
    .map((status, index) => ({
      candidateId: status.candidate.candidateId,
      deploymentFingerprint: status.deployment.fingerprint,
      rank: index + 1,
      why: status.why,
    }));

  const winner = eligible.find((s) => s.candidate.candidateId === ranked[0]?.candidateId);
  return {
    selected: winner
      ? { providerId: winner.candidate.providerId, modelId: winner.candidate.modelId, deploymentFingerprint: winner.deployment.fingerprint, candidateId: winner.candidate.candidateId }
      : null,
    ranked,
    excluded,
    abstained: false,
    reason: 'SELECTED',
    setupRequired: false,
    cloudFallbackAllowed: input.fallbackPolicy === 'LOCAL_PREFERRED_ALLOW_CLOUD',
  };
}

export const LOCAL_AUTO_SAFETY_PRIORITY = SAFETY_PRIORITY;