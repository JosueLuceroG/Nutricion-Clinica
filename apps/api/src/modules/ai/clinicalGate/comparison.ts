export type ComparisonVerdict = 'aligned' | 'minor_divergence' | 'critical_disagreement';

export const COMPARISON_VERDICTS: readonly ComparisonVerdict[] = ['aligned', 'minor_divergence', 'critical_disagreement'];

export interface ClinicalComparison {
  id: string;
  shadowRunId: string;
  professionalId: string;
  sucursalId: string;
  reviewedAt: string;
  verdict: ComparisonVerdict;
  notes?: string;
}

export interface ComparisonClassification {
  isCritical: boolean;
  reason?: string;
}

export function classifyComparison(input: { verdict: ComparisonVerdict; served: boolean }): ComparisonClassification {
  if (!input.served) {
    return { isCritical: false, reason: 'El run no fue servido al paciente' };
  }
  if (input.verdict === 'critical_disagreement') {
    return { isCritical: true, reason: 'Desacuerdo critico del profesional con la salida servida' };
  }
  return { isCritical: false };
}