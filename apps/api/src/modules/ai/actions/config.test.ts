import { describe, expect, it } from 'vitest';
import { readActionsConfig } from './config.js';

describe('confirmable actions config', () => {
  it('defaults to disabled (fail-closed) with memory store', () => {
    const config = readActionsConfig({});
    expect(config.enabled).toBe(false);
    expect(config.store).toBe('memory');
    expect(config.confirmationTtlMin).toBe(10);
    expect(config.maxPendingConfirmations).toBe(10);
  });

  it('enables only with AI_ACTIONS_ENABLED=true', () => {
    expect(readActionsConfig({ AI_ACTIONS_ENABLED: 'true' }).enabled).toBe(true);
    expect(readActionsConfig({ AI_ACTIONS_ENABLED: '1' }).enabled).toBe(false);
  });

  it('selects sql store and parses limits with fallback', () => {
    const config = readActionsConfig({
      AI_ACTIONS_LEDGER_STORE: 'sql',
      AI_ACTIONS_CONFIRMATION_TTL_MIN: '5',
      AI_ACTIONS_MAX_PENDING_CONFIRMATIONS: '3',
    });
    expect(config.store).toBe('sql');
    expect(config.confirmationTtlMin).toBe(5);
    expect(config.maxPendingConfirmations).toBe(3);

    const invalid = readActionsConfig({ AI_ACTIONS_CONFIRMATION_TTL_MIN: 'nope' });
    expect(invalid.confirmationTtlMin).toBe(10);
  });
});