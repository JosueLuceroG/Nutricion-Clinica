import { credentialProvider, getAIProvider, type AIProviderId } from '../credentialProvider.js';
import type { RoutingTarget } from './modelRouter.js';

export function splitList(value: string | undefined): string[] | null {
  if (!value) return null;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

export function getFallbackProviderOrder(env: NodeJS.ProcessEnv = process.env): AIProviderId[] {
  const order = splitList(env.AI_FALLBACK_PROVIDERS) ?? ['openai', 'ollama'];
  return order.filter((p): p is AIProviderId => p === 'openai' || p === 'ollama');
}

export class FallbackPolicy {
  buildChain(primary: AIProviderId, env: NodeJS.ProcessEnv = process.env): RoutingTarget[] {
    const order = getFallbackProviderOrder(env).filter((p) => p !== primary);
    return order.map((provider) => ({
      provider,
      model: credentialProvider.getDefaultModel(provider),
    }));
  }

  resolvePrimary(requested?: { provider?: AIProviderId; model?: string }, env: NodeJS.ProcessEnv = process.env): RoutingTarget {
    const provider = requested?.provider ?? getAIProvider(env);
    return {
      provider,
      model: provider === 'ollama'
        ? credentialProvider.getDefaultModel('ollama')
        : (requested?.model ?? credentialProvider.getDefaultModel('openai')),
    };
  }
}

export const fallbackPolicy = new FallbackPolicy();