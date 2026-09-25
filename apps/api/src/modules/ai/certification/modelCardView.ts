import type { ModelCard } from '../evaluation/modelCard.js';
import type { ClinicalCertificationRegistry } from './clinicalCertification.js';
import type { ModelQualificationRegistry } from '../evaluation/certification.js';
import type { CertificationState } from './certificationStates.js';
import type { AIModelCapability } from '../evaluation/capabilities.js';

export interface CapabilityApprovalView {
  capability: string;
  state: CertificationState | 'UNKNOWN';
  certificationId?: string;
  lastQualificationDate?: string;
  requalificationRequired: boolean;
}

/** Vista de Model Card integrada con la certificación clínica granular. */
export interface ModelCardView extends ModelCard {
  approvedCapabilities: CapabilityApprovalView[];
  certificationStates: CertificationState[];
  evaluationDatasetVersion: string | 'UNKNOWN';
  clinicalQualification: 'approved' | 'experimental' | 'not_approved' | 'NOT_EVALUATED';
  knownLimitations: string[];
  phiEligibility: boolean | 'UNKNOWN';
  residency: string | 'UNKNOWN';
  toolCompatibility: string[];
  structuredOutputCapability: boolean | 'UNKNOWN';
  lastQualificationDate: string | 'UNKNOWN';
  requalificationRequired: boolean;
  knownFailures: string[];
}

export interface ModelCardViewOptions {
  certifications: ClinicalCertificationRegistry;
  qualifications?: ModelQualificationRegistry;
  capabilityCandidates?: string[];
  deploymentFingerprint?: string;
}

const REQUIRED_STATE_BY_CAPABILITY: Record<AIModelCapability, CertificationState> = {
  chat_general: 'APPROVED_GENERAL',
  structured_json: 'APPROVED_ANALYTICS',
  nutrition_reasoning: 'APPROVED_NUTRITION_SUPPORT',
  patient_support: 'APPROVED_PATIENT',
};

/**
 * Si falta data → UNKNOWN / NOT_EVALUATED. Nunca se inventan resultados.
 * Los estados "approved" se derivan de la certificación clínica granular (no de técnico).
 */
export function buildModelCardView(card: ModelCard, options: ModelCardViewOptions): ModelCardView {
  const {
    certifications,
    qualifications,
    capabilityCandidates = [],
    deploymentFingerprint,
  } = options;

  const approvedCapabilities: CapabilityApprovalView[] = [];
  const certificationStates: CertificationState[] = [];
  const knownFailures = new Set<string>();
  let evaluationDatasetVersion: string | 'UNKNOWN' = 'UNKNOWN';
  let lastQualificationDate: string | undefined;
  let requalificationRequired = false;
  let clinicalQualification: ModelCardView['clinicalQualification'] = 'NOT_EVALUATED';

  for (const capability of new Set(card.capabilities)) {
    const resolution = certifications.resolve(
      card.provider,
      card.model,
      card.version,
      capability,
      {
        requiredState: REQUIRED_STATE_BY_CAPABILITY[capability],
        deploymentFingerprint,
      },
    );
    const resolvedRecord = resolution.certificationId
      ? certifications.get(resolution.certificationId)
      : undefined;
    if (resolution.eligible) {
      approvedCapabilities.push({
        capability,
        state: resolution.state ?? 'UNKNOWN',
        certificationId: resolvedRecord?.certificationId,
        lastQualificationDate: resolvedRecord?.evaluatedAt,
        requalificationRequired: resolution.requalificationRequired,
      });
    }
    if (resolution.state) certificationStates.push(resolution.state);
    if (
      resolvedRecord?.evaluatedAt &&
      (!lastQualificationDate || resolvedRecord.evaluatedAt > lastQualificationDate)
    ) {
      lastQualificationDate = resolvedRecord.evaluatedAt;
    }
    evaluationDatasetVersion =
      resolvedRecord?.key.evaluationDatasetVersion ?? evaluationDatasetVersion;
    for (const failure of resolvedRecord?.knownFailures ?? []) {
      knownFailures.add(failure);
    }
    requalificationRequired = requalificationRequired || resolution.requalificationRequired;
    if (
      resolution.eligible &&
      (resolution.state === 'APPROVED_NUTRITION_SUPPORT' ||
        resolution.state === 'APPROVED_CLINICAL_SUPPORT' ||
        resolution.state === 'APPROVED_PATIENT')
    ) {
      clinicalQualification = 'approved';
    } else if (resolution.state === 'EXPERIMENTAL') {
      clinicalQualification = clinicalQualification === 'approved' ? 'approved' : 'experimental';
    } else if (clinicalQualification === 'NOT_EVALUATED') {
      clinicalQualification = 'not_approved';
    }
  }

  const qualificationDates: string[] = [];
  if (qualifications) {
    for (const capability of capabilityCandidates) {
      const certification = qualifications.getCertification(`${card.provider}/${card.model}`, capability as never);
      if (certification?.evaluatedAt) qualificationDates.push(certification.evaluatedAt);
    }
  }

  return {
    ...card,
    approvedCapabilities,
    certificationStates: Array.from(new Set(certificationStates)),
    evaluationDatasetVersion,
    clinicalQualification,
    knownLimitations: card.limitations.split(';').map((part) => part.trim()).filter(Boolean),
    phiEligibility: 'UNKNOWN',
    residency: 'UNKNOWN',
    toolCompatibility: card.capabilities,
    structuredOutputCapability: card.capabilities.includes('structured_json'),
    lastQualificationDate:
      lastQualificationDate ??
      (qualificationDates.length > 0
        ? qualificationDates.sort().at(-1)!
        : 'UNKNOWN'),
    requalificationRequired,
    knownFailures: Array.from(knownFailures),
  };
}
