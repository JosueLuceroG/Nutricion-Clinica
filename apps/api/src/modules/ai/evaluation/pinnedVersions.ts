import type { AIProviderId } from '../credentialProvider.js';

export interface PinCheckResult {
  allowed: boolean;
  expected?: string;
  actual?: string;
}

export const DEFAULT_PINNED_VERSIONS: Record<AIProviderId, string> = {
  openai: 'gpt-4o-mini',
  ollama: 'llama3.2',
};

export function parsePinnedVersions(env: NodeJS.ProcessEnv): Record<AIProviderId, string> {
  const raw = env.AI_PINNED_MODEL_VERSIONS;
  if (!raw) return { ...DEFAULT_PINNED_VERSIONS };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<AIProviderId, unknown>>;
    const result: Record<AIProviderId, string> = { ...DEFAULT_PINNED_VERSIONS };
    for (const provider of ['openai', 'ollama'] as const) {
      const value = parsed[provider];
      if (typeof value === 'string' && value.trim().length > 0) {
        result[provider] = value.trim();
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_PINNED_VERSIONS };
  }
}

export class PinnedVersionPolicy {
  check(provider: AIProviderId, model: string, env: NodeJS.ProcessEnv): PinCheckResult {
    const pins = parsePinnedVersions(env);
    const expected = pins[provider];
    if (expected === model) return { allowed: true };
    return { allowed: false, expected, actual: model };
  }
}

export const pinnedVersionPolicy = new PinnedVersionPolicy();