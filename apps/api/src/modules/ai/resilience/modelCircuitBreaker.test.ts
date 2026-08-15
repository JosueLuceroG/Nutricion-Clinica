import { beforeEach, describe, expect, it } from 'vitest';
import { ModelCircuitBreaker, readCircuitBreakerConfig } from './modelCircuitBreaker.js';

describe('readCircuitBreakerConfig', () => {
  it('applies safe defaults and clamps invalid values', () => {
    expect(readCircuitBreakerConfig({})).toEqual({ threshold: 5, cooldownMs: 30_000 });
    expect(readCircuitBreakerConfig({ AI_CIRCUIT_BREAKER_THRESHOLD: '3', AI_CIRCUIT_BREAKER_COOLDOWN_MS: '15000' }))
      .toEqual({ threshold: 3, cooldownMs: 15_000 });
    expect(readCircuitBreakerConfig({ AI_CIRCUIT_BREAKER_THRESHOLD: 'abc' }).threshold).toBe(5);
    expect(readCircuitBreakerConfig({ AI_CIRCUIT_BREAKER_COOLDOWN_MS: '-1' }).cooldownMs).toBe(30_000);
  });
});

describe('ModelCircuitBreaker', () => {
  const breaker = new ModelCircuitBreaker();
  const config = { threshold: 2, cooldownMs: 60_000 };

  beforeEach(() => breaker.reset());

  it('stays closed below the failure threshold', () => {
    breaker.recordFailure('openai:gpt-4o-mini', config);
    expect(breaker.isOpen('openai:gpt-4o-mini', config)).toBe(false);
  });

  it('opens after the threshold and keeps skipping until cooldown', () => {
    breaker.recordFailure('openai:gpt-4o-mini', config);
    breaker.recordFailure('openai:gpt-4o-mini', config);
    expect(breaker.isOpen('openai:gpt-4o-mini', config)).toBe(true);
    expect(breaker.isOpen('openai:gpt-4o-mini', config)).toBe(true);
  });

  it('closes after cooldown (half-open probe)', () => {
    breaker.recordFailure('openai:gpt-4o-mini', config);
    breaker.recordFailure('openai:gpt-4o-mini', config);
    expect(breaker.isOpen('openai:gpt-4o-mini', config)).toBe(true);

    const pastConfig = { threshold: 2, cooldownMs: -1 };
    expect(breaker.isOpen('openai:gpt-4o-mini', pastConfig)).toBe(false);
  });

  it('a success resets failures immediately', () => {
    breaker.recordFailure('openai:gpt-4o-mini', config);
    breaker.recordSuccess('openai:gpt-4o-mini');
    breaker.recordFailure('openai:gpt-4o-mini', config);
    expect(breaker.isOpen('openai:gpt-4o-mini', config)).toBe(false);
  });

  it('tracks models independently', () => {
    breaker.recordFailure('openai:gpt-4o-mini', config);
    breaker.recordFailure('openai:gpt-4o-mini', config);
    expect(breaker.isOpen('openai:gpt-4o-mini', config)).toBe(true);
    expect(breaker.isOpen('ollama:llama3.2', config)).toBe(false);
  });
});