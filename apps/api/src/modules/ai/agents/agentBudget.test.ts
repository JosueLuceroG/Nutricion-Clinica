import { describe, expect, it } from 'vitest';
import { AgentBudgetTracker, effectiveBudget, estimateCost } from './agentBudget.js';
import type { AgentBudget, AgentBudgetUsed } from './agentTypes.js';

const NOW = new Date('2026-08-14T12:00:00.000Z');

function used(overrides: Partial<AgentBudgetUsed> = {}): AgentBudgetUsed {
  return { steps: 0, toolCalls: 0, tokens: 0, cost: 0, ...overrides };
}

function tracker(budget: AgentBudget, now: () => Date = () => NOW, startedAt?: Date): AgentBudgetTracker {
  return new AgentBudgetTracker(budget, now, startedAt);
}

describe('agent budget', () => {
  it('estimates cost with known model pricing', () => {
    expect(estimateCost('gpt-4o-mini', { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 })).toBeCloseTo(0.00015 * 1 + 0.0006 * 0.5);
  });

  it('uses fallback pricing for unknown models', () => {
    expect(estimateCost('unknown-model', { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 })).toBeCloseTo(0.0002 + 0.0008);
  });

  it('effective budget is the minimum of definition and operator defaults', () => {
    const definition: AgentBudget = { maxSteps: 4, maxToolCalls: 3, maxTokens: 2048, maxCost: 0.5, timeoutMs: 45000 };
    const defaults: AgentBudget = { maxSteps: 8, maxToolCalls: 2, maxTokens: 4096, maxCost: 1, timeoutMs: 30000 };
    expect(effectiveBudget(definition, defaults)).toEqual({ maxSteps: 4, maxToolCalls: 2, maxTokens: 2048, maxCost: 0.5, timeoutMs: 30000 });
  });

  it('checks every dimension of the budget', () => {
    const base: AgentBudget = { maxSteps: 2, maxToolCalls: 2, maxTokens: 100, maxCost: 1, timeoutMs: 60000 };
    expect(tracker(base).check(used())).toEqual({ ok: true });
    expect(tracker(base).check(used({ steps: 2 }))).toEqual({ ok: false, reason: 'max_steps' });
    expect(tracker(base).check(used({ toolCalls: 2 }))).toEqual({ ok: false, reason: 'max_tool_calls' });
    expect(tracker(base).check(used({ tokens: 100 }))).toEqual({ ok: false, reason: 'max_tokens' });
    expect(tracker(base).check(used({ cost: 1 }))).toEqual({ ok: false, reason: 'max_cost' });
    const late = tracker(base, () => new Date(NOW.getTime() + 61000), NOW);
    expect(late.check(used())).toEqual({ ok: false, reason: 'timeout' });
  });

  it('reports remaining tokens', () => {
    const base: AgentBudget = { maxSteps: 2, maxToolCalls: 2, maxTokens: 100, maxCost: 1, timeoutMs: 60000 };
    expect(tracker(base).remainingTokens(used({ tokens: 30 }))).toBe(70);
  });
});