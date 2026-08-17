import type { ClaimType } from './claimTypes.js';
import { validateClaimType, type ClaimProvenanceLike } from './claimTypes.js';
import type { ClinicalSourceType } from './sourceTypes.js';
import type { ConfidenceCategory } from './confidenceEngine.js';
import { isConfidenceCategory } from './confidenceEngine.js';
import type { Contradiction } from './contradictionDetection.js';
import type { MissingInfoItem } from './missingInformation.js';
import type { RiskLevel } from './riskModel.js';
import { RISK_LEVELS } from './riskModel.js';
import type { AbstentionResult } from './abstentionContract.js';

/** Ítem de evidencia: qué soporta, de dónde vino, qué tan reciente, qué versión produjo el dato. */
export interface EvidenceItem {
  source: string;
  sourceType: ClinicalSourceType;
  sourceRef?: string;
  toolId?: string;
  toolVersion?: string;
  documentId?: string;
  documentVersion?: string;
  calculationId?: string;
  calculationVersion?: string;
  ruleId?: string;
  ruleVersion?: string;
  recordDate?: string | null;
  observedAt?: string | null;
  loadedAt?: string | null;
  retrievedAt?: string;
  supports: string[];
}

export interface ClinicalClaim {
  id: string;
  text: string;
  claimType: ClaimType;
  evidence: EvidenceItem[];
  confidence: ConfidenceCategory;
  missingInformation: MissingInfoItem[];
  contradictions: Contradiction[];
}

export interface EvidenceEnvelopeV2 {
  version: '2.0';
  capability: string;
  generatedAt: string;
  claims: ClinicalClaim[];
  riskLevel: RiskLevel;
  baseRisk: RiskLevel;
  confidence: ConfidenceCategory;
  missingInformation: MissingInfoItem[];
  contradictions: Contradiction[];
  requiresProfessionalReview: boolean;
  abstention?: AbstentionResult;
  certification?: {
    certificationId?: string;
    state?: string;
    modelVersion?: string;
  };
}

export interface EvidenceEnvelopeValidationResult {
  valid: boolean;
  errors: string[];
}

function claimProvenance(item: EvidenceItem): ClaimProvenanceLike {
  return {
    sourceType: item.sourceType,
    generator: item.sourceType === 'MODEL_INFERENCE' ? 'ai' : 'deterministic',
    calculationId: item.calculationId,
    calculationVersion: item.calculationVersion,
    ruleId: item.ruleId,
    ruleVersion: item.ruleVersion,
    documentId: item.documentId,
    documentVersion: item.documentVersion,
    observedAt: item.observedAt ?? null,
    evidenceCount: item.observedAt ? 1 : 0,
  };
}

/**
 * Validación estricta del envelope. JSON parcial NO pasa como PASS para RISK_3+.
 * Campos desconocidos se rechazan; el claim type debe ser coherente con su evidencia.
 */
export function validateEvidenceEnvelope(envelope: EvidenceEnvelopeV2): EvidenceEnvelopeValidationResult {
  const errors: string[] = [];

  if (envelope.version !== '2.0') errors.push(`version debe ser '2.0' (recibida: ${String(envelope.version)})`);
  if (!envelope.capability || envelope.capability.length === 0) errors.push('capability requerida');
  if (!RISK_LEVELS.includes(envelope.riskLevel)) errors.push(`riskLevel inválido: ${String(envelope.riskLevel)}`);
  if (!RISK_LEVELS.includes(envelope.baseRisk)) errors.push(`baseRisk inválido: ${String(envelope.baseRisk)}`);
  if (!isConfidenceCategory(envelope.confidence)) errors.push(`confidence inválida: ${String(envelope.confidence)}`);
  if (typeof envelope.requiresProfessionalReview !== 'boolean') errors.push('requiresProfessionalReview debe ser boolean');
  if (!Array.isArray(envelope.claims)) errors.push('claims requerido');
  if (Array.isArray(envelope.claims) && envelope.claims.length === 0) errors.push('claims vacío: JSON parcial no es un envelope válido');
  if (!Array.isArray(envelope.missingInformation)) errors.push('missingInformation requerido');
  if (!Array.isArray(envelope.contradictions)) errors.push('contradictions requerido');

  for (const claim of envelope.claims ?? []) {
    if (!claim.id || !claim.text) errors.push(`claim sin id/texto (${claim.id ?? '?'})`);
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
      errors.push(`claim '${claim.id}' sin evidencia`);
      continue;
    }
    for (const item of claim.evidence) {
      const result = validateClaimType(claim.claimType, claimProvenance(item));
      if (!result.valid) errors.push(`claim '${claim.id}': ${result.reason}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertEvidenceEnvelope(envelope: EvidenceEnvelopeV2): void {
  const result = validateEvidenceEnvelope(envelope);
  if (!result.valid) {
    throw new Error(`Evidence Envelope inválido:\n- ${result.errors.join('\n- ')}`);
  }
}