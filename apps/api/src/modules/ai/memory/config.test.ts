import { describe, expect, it } from 'vitest';
import { readMemoryConfig } from './config.js';

describe('readMemoryConfig', () => {
  it('is disabled and in-memory by default', () => {
    const config = readMemoryConfig({});
    expect(config.enabled).toBe(false);
    expect(config.store).toBe('memory');
    expect(config.retentionDays).toBe(90);
    expect(config.maxEntries).toBe(50);
  });

  it('parses explicit values and clamps to valid ranges', () => {
    const config = readMemoryConfig({
      AI_MEMORY_ENABLED: 'true',
      AI_MEMORY_STORE: 'sql',
      AI_MEMORY_RETENTION_DAYS: '7',
      AI_MEMORY_MAX_ENTRIES: '200',
    });
    expect(config.enabled).toBe(true);
    expect(config.store).toBe('sql');
    expect(config.retentionDays).toBe(7);
    expect(config.maxEntries).toBe(200);
  });

  it('clamps invalid numbers to the minimum', () => {
    const config = readMemoryConfig({ AI_MEMORY_RETENTION_DAYS: '0', AI_MEMORY_MAX_ENTRIES: '0' });
    expect(config.retentionDays).toBe(1);
    expect(config.maxEntries).toBe(1);
  });
});