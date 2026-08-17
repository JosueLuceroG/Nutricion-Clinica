import type { RiskLevel } from './riskModel.js';
import { RISK_RANK } from './riskModel.js';

/** RISK_3+ nunca se auto-persiste como verdad clínica: permanece draft/suggestion/review pending. */
export function canAutoPersistClinicalTruth(risk: RiskLevel): boolean {
  return RISK_RANK[risk] < 3;
}

export function assertNoAutoPersistClinicalTruth(risk: RiskLevel, target: string): void {
  if (!canAutoPersistClinicalTruth(risk)) {
    throw new Error(`No se permite auto-persistir verdad clínica (${risk}) en: ${target}. Requiere acción profesional explícita.`);
  }
}