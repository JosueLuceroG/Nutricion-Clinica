import type { AgentBudget } from './agentTypes.js';

export interface AgentsConfig {
  enabled: boolean;
  store: 'memory' | 'sql';
  defaultBudget: AgentBudget;
  maxActiveRunsPerActor: number;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function toPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readAgentsConfig(env: NodeJS.ProcessEnv = process.env): AgentsConfig {
  return {
    enabled: env.AI_AGENTS_ENABLED === 'true',
    store: env.AI_AGENTS_LEDGER_STORE === 'sql' ? 'sql' : 'memory',
    defaultBudget: {
      maxSteps: toPositiveInt(env.AI_AGENTS_MAX_STEPS, 8),
      maxToolCalls: toPositiveInt(env.AI_AGENTS_MAX_TOOL_CALLS, 8),
      maxTokens: toPositiveInt(env.AI_AGENTS_MAX_TOKENS, 4096),
      maxCost: toPositiveNumber(env.AI_AGENTS_MAX_COST, 1),
      timeoutMs: toPositiveInt(env.AI_AGENTS_TIMEOUT_MS, 60000),
    },
    maxActiveRunsPerActor: toPositiveInt(env.AI_AGENTS_MAX_ACTIVE_RUNS_PER_ACTOR, 2),
  };
}