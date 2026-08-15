import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PINNED_VERSIONS, parsePinnedVersions, PinnedVersionPolicy } from './pinnedVersions.js';

describe('parsePinnedVersions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the current serving versions', () => {
    expect(parsePinnedVersions({})).toEqual(DEFAULT_PINNED_VERSIONS);
  });

  it('parses a JSON override per provider', () => {
    const pins = parsePinnedVersions({ AI_PINNED_MODEL_VERSIONS: '{"openai":"gpt-4o-2024-08-06","ollama":"llama3.2-x"}' });
    expect(pins.openai).toBe('gpt-4o-2024-08-06');
    expect(pins.ollama).toBe('llama3.2-x');
  });

  it('falls back to defaults on malformed JSON (fail-closed, no crash)', () => {
    expect(parsePinnedVersions({ AI_PINNED_MODEL_VERSIONS: '{oops' })).toEqual(DEFAULT_PINNED_VERSIONS);
  });

  it('ignores empty or non-string values', () => {
    const pins = parsePinnedVersions({ AI_PINNED_MODEL_VERSIONS: '{"openai":"","ollama":42}' });
    expect(pins).toEqual(DEFAULT_PINNED_VERSIONS);
  });
});

describe('PinnedVersionPolicy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows the pinned model', () => {
    expect(new PinnedVersionPolicy().check('openai', 'gpt-4o-mini', {})).toEqual({ allowed: true });
  });

  it('denies a non-pinned model version', () => {
    const result = new PinnedVersionPolicy().check('openai', 'gpt-4o', { AI_PINNED_MODEL_VERSIONS: '{"openai":"gpt-4o-mini"}' });
    expect(result).toEqual({ allowed: false, expected: 'gpt-4o-mini', actual: 'gpt-4o' });
  });
});