import type { AIModelCapability } from '../evaluation/capabilities.js';

export interface SpecializationConfig {
  enabled: boolean;
  store: 'memory' | 'sql';
  passRates: Partial<Record<AIModelCapability, number>>;
}

export function readSpecializationConfig(env: NodeJS.ProcessEnv = process.env): SpecializationConfig {
  return {
    enabled: env.AI_SPECIALIZATION_ENABLED === 'true',
    store: env.AI_SPECIALIZATION_STORE === 'sql' ? 'sql' : 'memory',
    passRates: parsePassRates(env.AI_SPECIALIZATION_PASS_RATES),
  };
}

function parsePassRates(raw: string | undefined): Partial<Record<AIModelCapability, number>> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const result: Partial<Record<AIModelCapability, number>> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      result[key as AIModelCapability] = value;
    }
  }
  return result;
}