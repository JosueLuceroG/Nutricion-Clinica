import { describe, expect, it } from 'vitest';
import {
  evaluateEgress,
  getAllowedModels,
  getAllowedProviders,
  isEgressEnabled,
} from './aiEgressPolicy.js';

describe('aiEgressPolicy', () => {
  it('is fail-closed: egress requires an explicit AI_EGRESS_ENABLED=true', () => {
    expect(isEgressEnabled({})).toBe(false);
    expect(isEgressEnabled({ AI_EGRESS_ENABLED: 'false' })).toBe(false);
    expect(isEgressEnabled({ AI_EGRESS_ENABLED: 'true' })).toBe(true);
  });

  it('denies everything while the kill switch is off', () => {
    expect(evaluateEgress('openai', 'gpt-4o-mini', {})).toEqual({ allowed: false, reason: 'kill_switch' });
    expect(evaluateEgress('ollama', 'llama3.2', { AI_EGRESS_ENABLED: 'false' })).toEqual({ allowed: false, reason: 'kill_switch' });
  });

  it('defaults to the supported providers when no allowlist is configured', () => {
    expect(getAllowedProviders({})).toEqual(['openai', 'ollama']);
  });

  it('honors an explicit provider allowlist', () => {
    expect(getAllowedProviders({ AI_ALLOWED_PROVIDERS: 'openai' })).toEqual(['openai']);
    expect(evaluateEgress('ollama', 'llama3.2', { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_PROVIDERS: 'openai' }))
      .toEqual({ allowed: false, reason: 'provider' });
  });

  it('defaults the model allowlist to safe defaults plus configured models', () => {
    expect(getAllowedModels({})).toEqual(['gpt-4o-mini', 'llama3.2']);
    expect(getAllowedModels({ OPENAI_MODEL: 'gpt-4o', AI_MODEL: 'llama3.2' })).toEqual(['gpt-4o-mini', 'llama3.2', 'gpt-4o']);
  });

  it('honors an explicit model allowlist', () => {
    expect(getAllowedModels({ AI_ALLOWED_MODELS: 'gpt-4o-mini, gpt-4o' })).toEqual(['gpt-4o-mini', 'gpt-4o']);
    expect(evaluateEgress('openai', 'gpt-4o', { AI_EGRESS_ENABLED: 'true', AI_ALLOWED_MODELS: 'gpt-4o-mini' }))
      .toEqual({ allowed: false, reason: 'model' });
  });

  it('allows only allowlisted providers and models', () => {
    expect(evaluateEgress('openai', 'gpt-4o-mini', { AI_EGRESS_ENABLED: 'true' })).toEqual({ allowed: true });
    expect(evaluateEgress('ollama', 'llama3.2', { AI_EGRESS_ENABLED: 'true' })).toEqual({ allowed: true });
    expect(evaluateEgress('unknown-provider', 'gpt-4o-mini', { AI_EGRESS_ENABLED: 'true' }))
      .toEqual({ allowed: false, reason: 'provider' });
  });
});