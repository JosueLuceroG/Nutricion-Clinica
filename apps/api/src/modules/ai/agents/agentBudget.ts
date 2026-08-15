import type { AIUsage } from '../providers/aiProviderAdapter.js';
import type { AgentBudget, AgentBudgetUsed } from './agentTypes.js';

export const MODEL_COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'llama3.2': { input: 0.00005, output: 0.0002 },
};

const FALLBACK_COST_PER_1K = { input: 0.0002, output: 0.0008 };

export function estimateCost(model: string, usage: AIUsage): number {
  const pricing = MODEL_COST_PER_1K_TOKENS[model] ?? FALLBACK_COST_PER_1K;
  return (pricing.input * usage.promptTokens + pricing.output * usage.completionTokens) / 1000;
}

export function effectiveBudget(definition: AgentBudget, defaults: AgentBudget): AgentBudget {
  return {
    maxSteps: Math.min(definition.maxSteps, defaults.maxSteps),
    maxToolCalls: Math.min(definition.maxToolCalls, defaults.maxToolCalls),
    maxTokens: Math.min(definition.maxTokens, defaults.maxTokens),
    maxCost: Math.min(definition.maxCost, defaults.maxCost),
    timeoutMs: Math.min(definition.timeoutMs, defaults.timeoutMs),
  };
}

export type BudgetCheck = { ok: true } | { ok: false; reason: string };

export class AgentBudgetTracker {
  private readonly startedAt: Date;

  constructor(
    private readonly budget: AgentBudget,
    private readonly now: () => Date,
    startedAt?: Date,
  ) {
    this.startedAt = startedAt ?? now();
  }

  check(used: AgentBudgetUsed): BudgetCheck {
    if (used.steps >= this.budget.maxSteps) return { ok: false, reason: 'max_steps' };
    if (used.toolCalls >= this.budget.maxToolCalls) return { ok: false, reason: 'max_tool_calls' };
    if (used.tokens >= this.budget.maxTokens) return { ok: false, reason: 'max_tokens' };
    if (used.cost >= this.budget.maxCost) return { ok: false, reason: 'max_cost' };
    if (this.now().getTime() - this.startedAt.getTime() >= this.budget.timeoutMs) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: true };
  }

  remainingTokens(used: AgentBudgetUsed): number {
    return Math.max(0, this.budget.maxTokens - used.tokens);
  }
}