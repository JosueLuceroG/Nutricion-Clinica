import type { RiskLevel } from "../contracts/riskModel.js";

/** Estados de certificación clínica (extienden el modelo parcial legacy con mapping compatible). */
export type CertificationState =
  | "EXPERIMENTAL"
  | "APPROVED_GENERAL"
  | "APPROVED_ANALYTICS"
  | "APPROVED_NUTRITION_SUPPORT"
  | "APPROVED_CLINICAL_SUPPORT"
  | "APPROVED_PATIENT"
  | "RESTRICTED"
  | "BLOCKED";

export const CERTIFICATION_STATES = [
  "EXPERIMENTAL",
  "APPROVED_GENERAL",
  "APPROVED_ANALYTICS",
  "APPROVED_NUTRITION_SUPPORT",
  "APPROVED_CLINICAL_SUPPORT",
  "APPROVED_PATIENT",
  "RESTRICTED",
  "BLOCKED",
] as const satisfies readonly CertificationState[];

const APPROVAL_RANK: Record<
  Exclude<CertificationState, "RESTRICTED" | "BLOCKED">,
  number
> = {
  EXPERIMENTAL: 0,
  APPROVED_GENERAL: 1,
  APPROVED_ANALYTICS: 2,
  APPROVED_NUTRITION_SUPPORT: 3,
  APPROVED_CLINICAL_SUPPORT: 4,
  APPROVED_PATIENT: 5,
};

/**
 * ¿El estado satisface el requisito?
 * - BLOCKED nunca; RESTRICTED solo vía lista explícita (nunca como aprobación genérica).
 * - EXPERIMENTAL solo con allowExperimental explícito.
 * - APPROVED_PATIENT satisface cualquiera menor; APPROVED_GENERAL nunca satisface APPROVED_NUTRITION_SUPPORT.
 */
export function stateSatisfies(
  state: CertificationState,
  required: CertificationState,
  allowExperimental = false,
): boolean {
  if (state === "BLOCKED" || required === "BLOCKED") return false;
  if (state === "RESTRICTED" || required === "RESTRICTED") return false;
  if (state === "EXPERIMENTAL") return allowExperimental;
  return APPROVAL_RANK[state] >= APPROVAL_RANK[required];
}

/** Mapping conservador del estado legacy (certified→APPROVED_GENERAL como piso; la certificación granular declara el estado exacto). */
export function mapLegacyStatus(
  status: "certified" | "qualified" | "not_qualified",
): CertificationState {
  switch (status) {
    case "certified":
      return "APPROVED_GENERAL";
    case "qualified":
      return "EXPERIMENTAL";
    case "not_qualified":
      return "RESTRICTED";
  }
}

/** Certificación mínima exigida por el riesgo efectivo (piso; la capability puede exigir más). */
export function minCertificationForRisk(risk: RiskLevel): CertificationState {
  switch (risk) {
    case "RISK_0":
    case "RISK_1":
      return "APPROVED_GENERAL";
    case "RISK_2":
      return "APPROVED_ANALYTICS";
    case "RISK_3":
      return "APPROVED_NUTRITION_SUPPORT";
    case "RISK_4":
    case "RISK_5":
      return "APPROVED_CLINICAL_SUPPORT";
  }
}

export function isHigherCertification(
  a: CertificationState,
  b: CertificationState,
): CertificationState {
  const rank = (state: CertificationState): number => {
    if (state === "BLOCKED" || state === "RESTRICTED") return 0;
    return APPROVAL_RANK[state];
  };
  if (a === "BLOCKED" || b === "BLOCKED") return a === "BLOCKED" ? a : b;
  return rank(a) >= rank(b) ? a : b;
}

export function requiredCertificationFor(
  effectiveRisk: RiskLevel,
  capabilityMinimum: CertificationState,
): CertificationState {
  return isHigherCertification(
    minCertificationForRisk(effectiveRisk),
    capabilityMinimum,
  );
}
