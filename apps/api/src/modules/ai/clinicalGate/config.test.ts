import { describe, expect, it } from 'vitest';
import { readClinicalGateConfig } from './config.js';

describe('readClinicalGateConfig', () => {
  it('defaults to fail-closed with expert disabled', () => {
    const config = readClinicalGateConfig({} as NodeJS.ProcessEnv);
    expect(config.expertEnabled).toBe(false);
    expect(config.shadowModeEnabled).toBe(false);
    expect(config.shadowSampleRate).toBe(0.1);
    expect(config.disagreementThreshold).toBe(3);
    expect(config.windowDays).toBe(7);
    expect(config.reviewStore).toBe('memory');
  });

  it('enables expert and shadow mode only with explicit true', () => {
    const config = readClinicalGateConfig({ AI_EXPERT_ENABLED: 'true', AI_SHADOW_MODE_ENABLED: 'true' } as NodeJS.ProcessEnv);
    expect(config.expertEnabled).toBe(true);
    expect(config.shadowModeEnabled).toBe(true);
  });

  it('treats any non-true value as disabled', () => {
    const config = readClinicalGateConfig({ AI_EXPERT_ENABLED: '1', AI_SHADOW_MODE_ENABLED: 'yes' } as NodeJS.ProcessEnv);
    expect(config.expertEnabled).toBe(false);
    expect(config.shadowModeEnabled).toBe(false);
  });

  it('clamps the sample rate to [0,1]', () => {
    expect(readClinicalGateConfig({ AI_SHADOW_SAMPLE_RATE: '1.5' } as NodeJS.ProcessEnv).shadowSampleRate).toBe(1);
    expect(readClinicalGateConfig({ AI_SHADOW_SAMPLE_RATE: '-1' } as NodeJS.ProcessEnv).shadowSampleRate).toBe(0);
    expect(readClinicalGateConfig({ AI_SHADOW_SAMPLE_RATE: 'abc' } as NodeJS.ProcessEnv).shadowSampleRate).toBe(0.1);
  });

  it('parses thresholds and store kind', () => {
    const config = readClinicalGateConfig({
      AI_CLINICAL_DISAGREEMENT_THRESHOLD: '5',
      AI_CLINICAL_WINDOW_DAYS: '30',
      AI_CLINICAL_REVIEW_STORE: 'sql',
    } as NodeJS.ProcessEnv);
    expect(config.disagreementThreshold).toBe(5);
    expect(config.windowDays).toBe(30);
    expect(config.reviewStore).toBe('sql');
  });

  it('coerces invalid thresholds to safe defaults', () => {
    const config = readClinicalGateConfig({ AI_CLINICAL_DISAGREEMENT_THRESHOLD: '0', AI_CLINICAL_WINDOW_DAYS: '-3' } as NodeJS.ProcessEnv);
    expect(config.disagreementThreshold).toBe(1);
    expect(config.windowDays).toBe(1);
  });
});