export type ProviderLocationType = 'local' | 'external' | 'unknown';

export interface ProviderDataPolicy {
  provider: string;
  locationType: ProviderLocationType;
  phiAllowed: boolean;
  dataResidency: string;
  retentionPolicyKnown: boolean;
  trainingUseAllowed: boolean;
  approvedForClinicalData: boolean;
}

function envBool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined) return fallback;
  return raw === 'true';
}

export function getProviderDataPolicy(provider: string, env: NodeJS.ProcessEnv = process.env): ProviderDataPolicy {
  const upper = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');

  if (provider === 'ollama') {
    return {
      provider,
      locationType: 'local',
      phiAllowed: true,
      dataResidency: 'local',
      retentionPolicyKnown: true,
      trainingUseAllowed: envBool(env, `AI_PROVIDER_TRAINING_USE_ALLOWED_${upper}`, false),
      approvedForClinicalData: true,
    };
  }

  if (provider === 'openai') {
    return {
      provider,
      locationType: 'external',
      phiAllowed: envBool(env, `AI_PROVIDER_PHI_ALLOWED_${upper}`, false),
      dataResidency: env.AI_PROVIDER_RESIDENCY_OPENAI ?? 'unknown',
      retentionPolicyKnown: envBool(env, `AI_PROVIDER_RETENTION_KNOWN_${upper}`, false),
      trainingUseAllowed: envBool(env, `AI_PROVIDER_TRAINING_USE_ALLOWED_${upper}`, false),
      approvedForClinicalData: envBool(env, `AI_PROVIDER_APPROVED_CLINICAL_${upper}`, false),
    };
  }

  return {
    provider,
    locationType: 'external',
    phiAllowed: false,
    dataResidency: 'unknown',
    retentionPolicyKnown: false,
    trainingUseAllowed: false,
    approvedForClinicalData: false,
  };
}

export type ResidencyMatch = 'match' | 'mismatch' | 'unknown';

export function compareResidency(required: string | null, actual: string): ResidencyMatch {
  if (!required || required === 'any') return 'match';
  if (!actual || actual === 'unknown') return 'unknown';
  return required.toLowerCase() === actual.toLowerCase() ? 'match' : 'mismatch';
}
