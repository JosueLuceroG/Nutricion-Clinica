import { readEnvironmentClass } from './environmentIdentity.js';

/**
 * Inventario de feature flags de seguridad (Build 09.5A §32-34).
 * Defaults seguros: todo deshabilitado salvo lo explícitamente declarado.
 * La clase de entorno limita qué flags pueden habilitarse.
 */

export interface FeatureFlag {
  id: string;
  label: string;
  enabled: boolean;
  safeDefault: boolean;
  environmentConstraint?: string;
}

export const AI_FEATURE_FLAG_IDS = [
  'ai_egress',
  'ai_expert',
  'ai_patient',
  'ai_agents',
  'ai_actions',
  'ai_shadow',
  'ai_dwh_narrative',
] as const;

export type AiFeatureFlagId = (typeof AI_FEATURE_FLAG_IDS)[number];

function readFlag(env: NodeJS.ProcessEnv, id: AiFeatureFlagId): boolean {
  switch (id) {
    case 'ai_egress':
      return env.AI_EGRESS_ENABLED === 'true';
    case 'ai_expert':
      return env.AI_EXPERT_ENABLED === 'true';
    case 'ai_patient':
      return env.AI_PATIENT_ENABLED === 'true';
    case 'ai_agents':
      return env.AI_AGENTS_ENABLED === 'true';
    case 'ai_actions':
      return env.AI_ACTIONS_ENABLED === 'true';
    case 'ai_shadow':
      return (env.AI_SHADOW_STATE ?? 'DISABLED') !== 'DISABLED';
    case 'ai_dwh_narrative':
      return env.AI_DWH_NARRATIVE_ENABLED === 'true';
  }
}

/** Inventario completo de flags con su default seguro. */
export function readFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlag[] {
  const environmentClass = readEnvironmentClass(env);
  return AI_FEATURE_FLAG_IDS.map((id) => {
    const enabled = readFlag(env, id);
    const constraints: Partial<Record<AiFeatureFlagId, string>> = {
      ai_shadow: environmentClass === 'PRODUCTION' ? 'prohibido en PRODUCTION' : undefined,
      ai_patient: 'requiere release gate clínico (no concedido en este entorno)',
    };
    return {
      id,
      label: id,
      enabled,
      safeDefault: false,
      environmentConstraint: constraints[id],
    };
  });
}

export function readFeatureFlag(id: AiFeatureFlagId, env: NodeJS.ProcessEnv = process.env): FeatureFlag {
  return readFeatureFlags(env).find((flag) => flag.id === id)!;
}

/** Fail-closed: entorno no declarado o inválido => todo flag apagado. */
export function effectiveFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlag[] {
  if (readEnvironmentClass(env) === 'UNKNOWN') {
    return AI_FEATURE_FLAG_IDS.map((id) => ({ id, label: id, enabled: false, safeDefault: true }));
  }
  return readFeatureFlags(env);
}