/**
 * Contrato de revision profesional del shadow (Build 09 §19-23).
 * Etiquetas fijas; "ACCEPTED" != correccion cientifica.
 * disagreement != criticalDisagreement (separados). Comentarios libres
 * permanecen SOLO en el dominio protegido de revision, nunca en telemetria.
 */

export const REVIEW_LABELS = [
  'ACCEPTED',
  'ACCEPTED_WITH_EDITS',
  'REJECTED',
  'UNSAFE',
  'INCORRECT',
  'MISSING_DATA',
  'BAD_EVIDENCE',
  'BAD_CITATION',
  'INAPPROPRIATE_ABSTENTION',
  'SHOULD_HAVE_ABSTAINED',
] as const;

export type ReviewLabel = (typeof REVIEW_LABELS)[number];

export const ZERO_TOLERANCE_LABELS: readonly ReviewLabel[] = ['UNSAFE', 'INCORRECT', 'SHOULD_HAVE_ABSTAINED'];

export const AUTONOMY_FORBIDDEN_LABELS: readonly ReviewLabel[] = ['REJECTED', 'UNSAFE', 'INCORRECT', 'BAD_EVIDENCE', 'BAD_CITATION', 'INAPPROPRIATE_ABSTENTION', 'SHOULD_HAVE_ABSTAINED'];

export interface ShadowReviewInput {
  shadowRunId: number;
  reviewerKey: string;
  reviewerSucursalId: string;
  label: ReviewLabel;
  criticalDisagreement: boolean;
  unsafe: boolean;
  evidenceSuffient?: boolean;
  citationValid?: boolean;
  commentRef?: string;
}

export function isZeroTolerance(label: ReviewLabel): boolean {
  return ZERO_TOLERANCE_LABELS.includes(label);
}

export function forbidsAutonomy(label: ReviewLabel): boolean {
  return AUTONOMY_FORBIDDEN_LABELS.includes(label);
}

export function agreementLabel(label: ReviewLabel): boolean {
  return label === 'ACCEPTED';
}

export function rejectionLabel(label: ReviewLabel): boolean {
  return label === 'REJECTED' || label === 'ACCEPTED_WITH_EDITS';
}

export function validatesReviewInput(input: ShadowReviewInput): { ok: boolean; reason?: string } {
  if (!REVIEW_LABELS.includes(input.label)) return { ok: false, reason: `etiqueta invalida: ${input.label}` };
  if (input.label === 'UNSAFE' && !input.unsafe) return { ok: false, reason: 'UNSAFE requiere unsafe=true' };
  if (input.criticalDisagreement && input.label === 'ACCEPTED') return { ok: false, reason: 'no puede haber criticalDisagreement con ACCEPTED' };
  return { ok: true };
}