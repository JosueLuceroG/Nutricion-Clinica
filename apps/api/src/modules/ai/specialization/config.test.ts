import { describe, expect, it } from 'vitest';
import { readSpecializationConfig } from './config.js';

describe('specialization config', () => {
  it('defaults are fail-closed', () => {
    const config = readSpecializationConfig({});
    expect(config.enabled).toBe(false);
    expect(config.store).toBe('memory');
    expect(config.passRates).toEqual({});
  });

  it('reads values from env', () => {
    const config = readSpecializationConfig({
      AI_SPECIALIZATION_ENABLED: 'true',
      AI_SPECIALIZATION_STORE: 'sql',
      AI_SPECIALIZATION_PASS_RATES: '{"nutrition_reasoning":0.78,"chat_general":1}',
    });
    expect(config.enabled).toBe(true);
    expect(config.store).toBe('sql');
    expect(config.passRates).toEqual({ nutrition_reasoning: 0.78, chat_general: 1 });
  });

  it('ignores malformed or out-of-range pass rates (fail-closed)', () => {
    expect(readSpecializationConfig({ AI_SPECIALIZATION_PASS_RATES: 'not json' }).passRates).toEqual({});
    expect(readSpecializationConfig({ AI_SPECIALIZATION_PASS_RATES: '{"nutrition_reasoning":1.5}' }).passRates).toEqual({});
    expect(readSpecializationConfig({ AI_SPECIALIZATION_PASS_RATES: '[1,2]' }).passRates).toEqual({});
  });
});