import type { ModelCard } from '../evaluation/modelCard.js';
import type { ClinicalCertificationRegistry } from './clinicalCertification.js';
import type { ModelQualificationRegistry } from '../evaluation/certification.js';
import type { CertificationState } from './certificationStates.js';

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
}

/**
 * Si falta data → UNKNOWN / NOT_EVALUATED. Nunca se inventan resultados.
 * Los estados "approved" se derivan de la certificación clínica granular (no de técnico).
 */
export function buildModelCardView(card: ModelCard, options: ModelCardViewOptions): ModelCardView {
  const { certifications, qualifications, capabilityCandidates = [] } = options;

  const approvedCapabilities: CapabilityApprovalView[] = [];
  const seen = new Set<string>();
  const certificationStates: CertificationState[] = [];
  let lastQualificationDate: string | undefined;
  let requalificationRequired = false;
  let clinicalQualification: ModelCardView['clinicalQualification'] = 'NOT_EVALUATED';

  for (const record of certifications.list()) {
    const key = record.key;
    if (key.providerId === card.provider && key.modelId === card.model) {
      const capability = key.capabilityId;
      if (seen.has(capability)) continue;
      seen.add(capability);
      const resolution = certifications.resolve(card.provider, card.model, card.version, capability, {
        requiredState: 'APPROVED_GENERAL',
      });
      approvedCapabilities.push({
        capability,
        state: resolution.state ?? 'UNKNOWN',
        certificationId: record.certificationId,
        lastQualificationDate: record.evaluatedAt,
        requalificationRequired: resolution.requalificationRequired,
      });
      if (resolution.state) certificationStates.push(resolution.state);
      if (!record.evaluatedAt) {
        lastQualificationDate = record.evaluatedAt;
      }
      requalificationRequired = requalificationRequired || resolution.requalificationRequired;
      if (record.state === 'APPROVED_NUTRITION_SUPPORT' || record.state === 'APPROVED_CLINICAL_SUPPORT' || record.state === 'APPROVED_PATIENT') {
        clinicalQualification = 'approved';
      } else if (record.state === 'EXPERIMENTAL') {
        clinicalQualification = clinicalQualification === 'approved' ? 'approved' : 'experimental';
      } else if (clinicalQualification === 'NOT_EVALUATED') {
        clinicalQualification = 'not_approved';
      }
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
    evaluationDatasetVersion: 'nutrition-golden-v1',
    clinicalQualification,
    knownLimitations: card.limitations.split(';').map((part) => part.trim()).filter(Boolean),
    phiEligibility: 'UNKNOWN',
    residency: 'UNKNOWN',
    toolCompatibility: card.capabilities,
    structuredOutputCapability: card.capabilities.includes('structured_json'),
    lastQualificationDate: lastQualificationDate ?? (qualificationDates.length > 0 ? qualificationDates[0] : 'UNKNOWN'),
    requalificationRequired,
    knownFailures: [],
  };
}