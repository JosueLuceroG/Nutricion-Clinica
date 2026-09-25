import { describe, expect, it } from 'vitest';
import { readAgentsConfig } from './config.js';

describe('bounded agents config', () => {
  it('defaults are fail-closed', () => {
    const config = readAgentsConfig({});
    expect(config.enabled).toBe(false);
    expect(config.store).toBe('memory');
    expect(config.defaultBudget.maxSteps).toBe(8);
    expect(config.defaultBudget.maxToolCalls).toBe(8);
    expect(config.defaultBudget.maxTokens).toBe(4096);
    expect(config.defaultBudget.maxCost).toBe(1);
    expect(config.defaultBudget.timeoutMs).toBe(60000);
    expect(config.maxActiveRunsPerActor).toBe(2);
  });

  it('reads values from env', () => {
    const config = readAgentsConfig({
      AI_AGENTS_ENABLED: 'true',
      AI_AGENTS_LEDGER_STORE: 'sql',
      AI_AGENTS_MAX_STEPS: '3',
      AI_AGENTS_MAX_TOOL_CALLS: '2',
      AI_AGENTS_MAX_TOKENS: '512',
      AI_AGENTS_MAX_COST: '0.25',
      AI_AGENTS_TIMEOUT_MS: '15000',
      AI_AGENTS_MAX_ACTIVE_RUNS_PER_ACTOR: '1',
    });
    expect(config.enabled).toBe(true);
    expect(config.store).toBe('sql');
    expect(config.defaultBudget).toEqual({ maxSteps: 3, maxToolCalls: 2, maxTokens: 512, maxCost: 0.25, timeoutMs: 15000 });
    expect(config.maxActiveRunsPerActor).toBe(1);
  });

  it('ignores invalid numeric values with fallback', () => {
    const config = readAgentsConfig({
      AI_AGENTS_MAX_STEPS: 'abc',
      AI_AGENTS_MAX_TOOL_CALLS: '-2',
      AI_AGENTS_MAX_COST: 'x',
      AI_AGENTS_TIMEOUT_MS: '0',
    });
    expect(config.defaultBudget.maxSteps).toBe(8);
    expect(config.defaultBudget.maxToolCalls).toBe(8);
    expect(config.defaultBudget.maxCost).toBe(1);
    expect(config.defaultBudget.timeoutMs).toBe(60000);
  });
});