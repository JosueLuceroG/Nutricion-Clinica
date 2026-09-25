import type { RiskLevel } from '../contracts/riskModel.js';

/**
 * Política de selección de modelo de la organización.
 * AI_MODEL_MODE:
 *   NUTRICLINICA_LOCAL_AUTO     -> mejor candidato local elegible (default nuevo)
 *   ORGANIZATION_PREFERRED      -> preferencia explícita de la organización
 *   EXPLICIT_APPROVED_MODEL     -> modelo aprobado explícito (legacy AI_MODEL/OPENAI_MODEL)
 */

export type AIModelMode = 'NUTRICLINICA_LOCAL_AUTO' | 'ORGANIZATION_PREFERRED' | 'EXPLICIT_APPROVED_MODEL';

export type ModelFallbackPolicy = 'LOCAL_ONLY' | 'LOCAL_PREFERRED_ALLOW_CLOUD';

export interface ModelPolicyConfig {
  mode: AIModelMode;
  fallbackPolicy: ModelFallbackPolicy;
  setupRequired: boolean;
  preferredProvider: string | null;
  preferredModel: string | null;
}

export function resolveModelPolicy(env: NodeJS.ProcessEnv = process.env): ModelPolicyConfig {
  const explicitMode = env.AI_MODEL_MODE as AIModelMode | undefined;
  const hasLegacyModel = Boolean(env.AI_MODEL || env.OPENAI_MODEL);
  const mode: AIModelMode = explicitMode ?? (hasLegacyModel ? 'EXPLICIT_APPROVED_MODEL' : 'NUTRICLINICA_LOCAL_AUTO');
  const fallbackPolicy: ModelFallbackPolicy =
    env.AI_MODEL_FALLBACK_POLICY === 'LOCAL_PREFERRED_ALLOW_CLOUD' ? 'LOCAL_PREFERRED_ALLOW_CLOUD' : 'LOCAL_ONLY';
  return {
    mode,
    fallbackPolicy,
    setupRequired: mode === 'NUTRICLINICA_LOCAL_AUTO',
    preferredProvider: env.AI_PROVIDER ?? null,
    preferredModel: env.AI_MODEL ?? null,
  };
}

/**
 * Clases de modelo por riesgo (sin nombres hardcodeados):
 * RISK_0/1 -> ligero/efficient; RISK_2 -> structured; RISK_3/4 -> reasoning fuerte
 * con certificación; RISK_5 -> determinismo primero, modelo solo con política.
 */
export interface RiskModelClassPolicy {
  preferredClass: 'lightweight' | 'efficient_general' | 'efficient_structured' | 'strong_reasoning' | 'specialized_candidate' | 'NONE';
  allowModel: boolean;
  requiresProfessionalReview: boolean;
}

export const RISK_MODEL_CLASS_POLICY: Record<RiskLevel, RiskModelClassPolicy> = {
  RISK_0: { preferredClass: 'lightweight', allowModel: true, requiresProfessionalReview: false },
  RISK_1: { preferredClass: 'efficient_general', allowModel: true, requiresProfessionalReview: false },
  RISK_2: { preferredClass: 'efficient_structured', allowModel: true, requiresProfessionalReview: false },
  RISK_3: { preferredClass: 'strong_reasoning', allowModel: true, requiresProfessionalReview: true },
  RISK_4: { preferredClass: 'specialized_candidate', allowModel: true, requiresProfessionalReview: true },
  RISK_5: { preferredClass: 'NONE', allowModel: false, requiresProfessionalReview: true },
};

export function riskAllowsModel(risk: RiskLevel): boolean {
  return RISK_MODEL_CLASS_POLICY[risk].allowModel;
}