/**
 * Modelo de riesgo autoritativo (governance, NO diagnóstico automático).
 * El riesgo efectivo lo calcula código determinista; el LLM nunca puede bajarlo.
 */
export type RiskLevel = 'RISK_0' | 'RISK_1' | 'RISK_2' | 'RISK_3' | 'RISK_4' | 'RISK_5';

export const RISK_LEVELS: readonly RiskLevel[] = ['RISK_0', 'RISK_1', 'RISK_2', 'RISK_3', 'RISK_4', 'RISK_5'];

export const RISK_RANK: Record<RiskLevel, number> = {
  RISK_0: 0,
  RISK_1: 1,
  RISK_2: 2,
  RISK_3: 3,
  RISK_4: 4,
  RISK_5: 5,
};

export function isRiskAtLeast(risk: RiskLevel, minimum: RiskLevel): boolean {
  return RISK_RANK[risk] >= RISK_RANK[minimum];
}

/** Señales deterministas disponibles en el runtime. Solo se usan señales reales; lo desconocido NO se declara seguro. */
export interface RiskSignals {
  contradictionsDetected?: boolean;
  criticalDataMissing?: boolean;
  safetyFlags?: Array<{ id: string; severity: 'info' | 'warning' | 'blocker' }>;
  relevantMedication?: boolean;
  relevantAllergies?: boolean;
  criticalLab?: boolean;
  highRiskPatientContext?: boolean;
  personalizedRecommendation?: boolean;
  redFlag?: boolean;
  highRiskToolResult?: boolean;
  majorUncertainty?: boolean;
}

const MIN_ELEVATION: ReadonlyArray<{ level: RiskLevel; when: (signals: RiskSignals) => boolean }> = [
  {
    level: 'RISK_5',
    when: (s) =>
      Boolean(s.redFlag) ||
      (s.safetyFlags ?? []).some((f) => f.severity === 'blocker'),
  },
  {
    level: 'RISK_4',
    when: (s) =>
      Boolean(s.criticalLab) ||
      Boolean(s.relevantMedication) ||
      Boolean(s.highRiskPatientContext) ||
      Boolean(s.highRiskToolResult),
  },
  {
    level: 'RISK_3',
    when: (s) =>
      Boolean(s.contradictionsDetected) ||
      Boolean(s.criticalDataMissing) ||
      Boolean(s.majorUncertainty) ||
      Boolean(s.relevantAllergies) ||
      Boolean(s.personalizedRecommendation) ||
      (s.safetyFlags ?? []).some((f) => f.severity === 'warning'),
  },
];

/**
 * Riesgo efectivo = máximo(base, elevaciones deterministas).
 * Nunca disminuye: para cualquier entrada, resultado >= base.
 */
export function computeEffectiveRisk(baseRisk: RiskLevel, signals: RiskSignals = {}): RiskLevel {
  let effective = RISK_RANK[baseRisk];
  for (const rule of MIN_ELEVATION) {
    if (rule.when(signals)) {
      effective = Math.max(effective, RISK_RANK[rule.level]);
    }
  }
  return RISK_LEVELS[effective];
}

/** El LLM puede proponer un nivel, pero el código lo recorta al máximo con el cálculo determinista. */
export function applyClaimedRisk(baseRisk: RiskLevel, signals: RiskSignals, claimed?: RiskLevel): RiskLevel {
  const computed = computeEffectiveRisk(baseRisk, signals);
  if (!claimed) return computed;
  const clamped = Math.max(RISK_RANK[claimed], RISK_RANK[baseRisk]);
  return RISK_LEVELS[Math.max(RISK_RANK[computed], clamped)];
}