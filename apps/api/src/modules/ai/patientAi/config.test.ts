import { describe, expect, it } from 'vitest';
import { readPatientAiConfig } from './config.js';

describe('patientAi config', () => {
  it('defaults to disabled (fail-closed)', () => {
    const config = readPatientAiConfig({});
    expect(config.enabled).toBe(false);
    expect(config.maxQueryChars).toBe(500);
  });

  it('enables only with AI_PATIENT_ENABLED=true', () => {
    expect(readPatientAiConfig({ AI_PATIENT_ENABLED: 'true' }).enabled).toBe(true);
    expect(readPatientAiConfig({ AI_PATIENT_ENABLED: 'false' }).enabled).toBe(false);
    expect(readPatientAiConfig({ AI_PATIENT_ENABLED: '1' }).enabled).toBe(false);
  });

  it('parses max query chars with fallback', () => {
    expect(readPatientAiConfig({ AI_PATIENT_MAX_QUERY_CHARS: '250' }).maxQueryChars).toBe(250);
    expect(readPatientAiConfig({ AI_PATIENT_MAX_QUERY_CHARS: 'nope' }).maxQueryChars).toBe(500);
  });
});