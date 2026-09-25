import type { AIProviderId } from '../credentialProvider.js';

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