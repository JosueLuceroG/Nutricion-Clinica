export type EgressDenialReason = 'kill_switch' | 'provider' | 'model';

export type EgressDecision = { allowed: true } | { allowed: false; reason: EgressDenialReason };

const DEFAULT_ALLOWED_PROVIDERS = ['openai', 'ollama'];
const DEFAULT_ALLOWED_MODELS = ['gpt-4o-mini', 'llama3.2'];

export function isEgressEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AI_EGRESS_ENABLED === 'true';
}

function splitList(value: string | undefined): string[] | null {
  if (!value) return null;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

export function getAllowedProviders(env: NodeJS.ProcessEnv = process.env): string[] {
  return splitList(env.AI_ALLOWED_PROVIDERS) ?? DEFAULT_ALLOWED_PROVIDERS;
}

export function getAllowedModels(env: NodeJS.ProcessEnv = process.env): string[] {
  const explicit = splitList(env.AI_ALLOWED_MODELS);
  if (explicit) return explicit;
  const configured = [env.OPENAI_MODEL, env.AI_MODEL].filter((model): model is string => Boolean(model));
  return [...new Set([...DEFAULT_ALLOWED_MODELS, ...configured])];
}

export function evaluateEgress(provider: string, model: string, env: NodeJS.ProcessEnv = process.env): EgressDecision {
  if (!isEgressEnabled(env)) return { allowed: false, reason: 'kill_switch' };
  if (!getAllowedProviders(env).includes(provider)) return { allowed: false, reason: 'provider' };
  if (!getAllowedModels(env).includes(model)) return { allowed: false, reason: 'model' };
  return { allowed: true };
}