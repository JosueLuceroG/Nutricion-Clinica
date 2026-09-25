const EVIDENCE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{5,199}$/;
const UNSAFE_EVIDENCE = /(?:^sk-|change|replace|example|placeholder|todo)/i;
const SYNTHETIC_PHI_MARKER = "PHI_DEPLOYMENT_MARKER_6f6db2";

export function isSafeEvidenceReference(value: string | undefined): boolean {
  const raw = value?.trim() ?? "";
  return (
    EVIDENCE_REFERENCE.test(raw) &&
    !UNSAFE_EVIDENCE.test(raw) &&
    raw !== SYNTHETIC_PHI_MARKER
  );
}

export function safeEvidenceReference(
  value: string | undefined,
): string | null {
  return isSafeEvidenceReference(value) ? value!.trim() : null;
}
