import { describe, expect, it } from 'vitest';
import { runRetentionCleanup } from './retentionCleanupService.js';

describe('runRetentionCleanup', () => {
  it('returns empty result when no pool (handles error gracefully)', async () => {
    const result = await runRetentionCleanup();
    expect(result).toHaveProperty('deletedCount');
    expect(result).toHaveProperty('errors');
    expect(typeof result.deletedCount).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
