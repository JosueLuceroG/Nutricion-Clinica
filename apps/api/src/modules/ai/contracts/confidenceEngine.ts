/** Confianza categórica exclusivamente. Nada de porcentajes arbitrarios del LLM. */
export type ConfidenceCategory = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

export const CONFIDENCE_CATEGORIES: readonly ConfidenceCategory[] = [
  'HIGH',
  'MEDIUM',
  'LOW',
  'INSUFFICIENT_EVIDENCE',
];

export function isConfidenceCategory(value: unknown): value is ConfidenceCategory {
  return typeof value === 'string' && (CONFIDENCE_CATEGORIES as readonly string[]).includes(value);
}

/** Rechaza "93%", 0.93 u otros valores numéricos arbitrarios. */
export function assertConfidenceCategory(value: unknown): ConfidenceCategory {
  if (typeof value === 'number') {
    throw new Error(`Confianza numérica arbitraria no permitida: ${value}`);
  }
  if (typeof value === 'string' && /%\s*$/.test(value)) {
    throw new Error(`Confianza porcentual no permitida: ${value}`);
  }
  if (!isConfidenceCategory(value)) {
    throw new Error(`Categoría de confianza inválida: ${String(value)}`);
  }
  return value;
}

export interface ConfidenceFactors {
  requiredEvidenceCount: number;
  evidenceCount: number;
  authoritativeSources: number;
  contradictions: number;
  missingRequired: number;
  staleSources: number;
  validatorFailures: number;
  groundingValid: boolean;
  groundingRequired: boolean;
  toolSuccess: boolean;
  sourceTier: 'authoritative' | 'standard' | 'weak';
  citationValid: boolean;
}

/**
 * Política reproducible de confianza (no es pseudo-probabilidad; son reglas documentadas):
 * - contradicción crítica o evidencia requerida ausente  -> INSUFFICIENT_EVIDENCE
 * - fallos de validador o tool fallida                    -> INSUFFICIENT_EVIDENCE
 * - grounding requerido y ausente                         -> INSUFFICIENT_EVIDENCE
 * - evidencia parcial/débil o fuentes stale               -> LOW
 * - múltiples fuentes autoritativas consistentes          -> HIGH
 * - resto                                                -> MEDIUM
 */
export function computeConfidence(factors: ConfidenceFactors): ConfidenceCategory {
  if (factors.contradictions > 0) return 'INSUFFICIENT_EVIDENCE';
  if (factors.missingRequired > 0) return 'INSUFFICIENT_EVIDENCE';
  if (factors.validatorFailures > 0) return 'INSUFFICIENT_EVIDENCE';
  if (!factors.toolSuccess) return 'INSUFFICIENT_EVIDENCE';
  if (factors.groundingRequired && !factors.groundingValid) return 'INSUFFICIENT_EVIDENCE';

  if (factors.evidenceCount < factors.requiredEvidenceCount) return 'LOW';
  if (factors.staleSources >= factors.requiredEvidenceCount) return 'LOW';
  if (factors.sourceTier === 'weak') return 'LOW';
  if (factors.sourceTier === 'standard') return 'MEDIUM';

  if (
    factors.evidenceCount >= factors.requiredEvidenceCount &&
    factors.authoritativeSources >= factors.requiredEvidenceCount &&
    factors.citationValid
  ) {
    return 'HIGH';
  }
  return 'MEDIUM';
}