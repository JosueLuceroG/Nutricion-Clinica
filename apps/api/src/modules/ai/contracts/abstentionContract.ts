import type { AIErrorCode } from '../aiOrchestrator.js';
import type { Contradiction } from './contradictionDetection.js';
import type { MissingInfoItem } from './missingInformation.js';
import type { RiskLevel } from './riskModel.js';

/** Condiciones formales de abstención (mapeadas a códigos existentes cuando corresponde). */
export type AbstentionReasonCode =
  | 'INSUFFICIENT_EVIDENCE'
  | 'MISSING_REQUIRED_DATA'
  | 'CONTRADICTORY_DATA'
  | 'MISSING_CONSENT'
  | 'PERMISSION_DENIED'
  | 'NO_ELIGIBLE_MODEL'
  | 'MODEL_NOT_CERTIFIED'
  | 'TOOL_UNAVAILABLE'
  | 'STALE_REQUIRED_DATA'
  | 'UNSUPPORTED_CAPABILITY'
  | 'SAFETY_BLOCK'
  | 'GROUNDING_FAILURE';

export const ABSTENTION_REASON_CODES: readonly AbstentionReasonCode[] = [
  'INSUFFICIENT_EVIDENCE',
  'MISSING_REQUIRED_DATA',
  'CONTRADICTORY_DATA',
  'MISSING_CONSENT',
  'PERMISSION_DENIED',
  'NO_ELIGIBLE_MODEL',
  'MODEL_NOT_CERTIFIED',
  'TOOL_UNAVAILABLE',
  'STALE_REQUIRED_DATA',
  'UNSUPPORTED_CAPABILITY',
  'SAFETY_BLOCK',
  'GROUNDING_FAILURE',
];

/** Resultado formal de abstención: nunca solo una frase del LLM. */
export interface AbstentionResult {
  status: 'ABSTAINED';
  reasonCodes: AbstentionReasonCode[];
  missingInformation: MissingInfoItem[];
  contradictions: Contradiction[];
  riskLevel: RiskLevel;
  requiresProfessionalReview: true;
}

export function abstained(
  reasonCodes: AbstentionReasonCode[],
  opts: { missingInformation?: MissingInfoItem[]; contradictions?: Contradiction[]; riskLevel?: RiskLevel } = {},
): AbstentionResult {
  return {
    status: 'ABSTAINED',
    reasonCodes,
    missingInformation: opts.missingInformation ?? [],
    contradictions: opts.contradictions ?? [],
    riskLevel: opts.riskLevel ?? 'RISK_1',
    requiresProfessionalReview: true,
  };
}

/** Mapping desde códigos de error del gateway a condiciones de abstención. */
export function abstentionFromGatewayDenial(code: AIErrorCode | string): AbstentionReasonCode | undefined {
  switch (code) {
    case 'CONSENT_REQUIRED':
      return 'MISSING_CONSENT';
    case 'NO_ELIGIBLE_MODEL':
      return 'NO_ELIGIBLE_MODEL';
    case 'CAPABILITY_DENIED':
      return 'UNSUPPORTED_CAPABILITY';
    case 'PROVIDER_UNAVAILABLE':
    case 'MODEL_UNAVAILABLE':
    case 'RATE_LIMITED':
    case 'TIMEOUT':
      return 'TOOL_UNAVAILABLE';
    case 'INVALID_AI_RESPONSE':
      return 'INSUFFICIENT_EVIDENCE';
    default:
      return undefined;
  }
}

/** Mapping desde los kinds legacy de abstención de los workflows. */
export function abstentionFromLegacyKind(kind: string): AbstentionReasonCode | undefined {
  switch (kind) {
    case 'missing_data':
      return 'MISSING_REQUIRED_DATA';
    case 'safety':
      return 'SAFETY_BLOCK';
    case 'unverifiable':
      return 'INSUFFICIENT_EVIDENCE';
    case 'knowledge_unavailable':
    case 'ungrounded':
      return 'GROUNDING_FAILURE';
    case 'unsafe_language':
      return 'SAFETY_BLOCK';
    default:
      return undefined;
  }
}