export interface ConfirmableActionsConfig {
  enabled: boolean;
  store: 'memory' | 'sql';
  confirmationTtlMin: number;
  maxPendingConfirmations: number;
}

export function readActionsConfig(env: NodeJS.ProcessEnv = process.env): ConfirmableActionsConfig {
  const ttl = Number(env.AI_ACTIONS_CONFIRMATION_TTL_MIN ?? 10);
  const maxPending = Number(env.AI_ACTIONS_MAX_PENDING_CONFIRMATIONS ?? 10);
  return {
    enabled: (env.AI_ACTIONS_ENABLED ?? 'false') === 'true',
    store: env.AI_ACTIONS_LEDGER_STORE === 'sql' ? 'sql' : 'memory',
    confirmationTtlMin: Number.isFinite(ttl) && ttl > 0 ? Math.round(ttl) : 10,
    maxPendingConfirmations: Number.isFinite(maxPending) && maxPending > 0 ? Math.round(maxPending) : 10,
  };
}