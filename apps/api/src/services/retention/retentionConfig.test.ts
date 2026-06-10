import { describe, expect, it } from 'vitest';
import { RETENTION_CONFIG } from './retentionConfig.js';

describe('RETENTION_CONFIG', () => {
  it('defaults to 10 years', () => {
    const original = process.env.RECORDING_RETENTION_YEARS;
    delete process.env.RECORDING_RETENTION_YEARS;
    expect(RETENTION_CONFIG.years).toBe(10);
    if (original) process.env.RECORDING_RETENTION_YEARS = original;
  });

  it('reads RECORDING_RETENTION_YEARS from env', () => {
    const original = process.env.RECORDING_RETENTION_YEARS;
    process.env.RECORDING_RETENTION_YEARS = '5';
    expect(RETENTION_CONFIG.years).toBe(5);
    if (original) process.env.RECORDING_RETENTION_YEARS = original;
    else delete process.env.RECORDING_RETENTION_YEARS;
  });

  it('defaults cleanup to enabled', () => {
    const original = process.env.RETENTION_CLEANUP_ENABLED;
    delete process.env.RETENTION_CLEANUP_ENABLED;
    expect(RETENTION_CONFIG.cleanupEnabled).toBe(true);
    if (original) process.env.RETENTION_CLEANUP_ENABLED = original;
  });

  it('respects RETENTION_CLEANUP_ENABLED=false', () => {
    const original = process.env.RETENTION_CLEANUP_ENABLED;
    process.env.RETENTION_CLEANUP_ENABLED = 'false';
    expect(RETENTION_CONFIG.cleanupEnabled).toBe(false);
    if (original) process.env.RETENTION_CLEANUP_ENABLED = original;
    else delete process.env.RETENTION_CLEANUP_ENABLED;
  });

  it('defaults cron schedule to 0 3 * * *', () => {
    const original = process.env.RETENTION_CRON_SCHEDULE;
    delete process.env.RETENTION_CRON_SCHEDULE;
    expect(RETENTION_CONFIG.cronSchedule).toBe('0 3 * * *');
    if (original) process.env.RETENTION_CRON_SCHEDULE = original;
  });
});
