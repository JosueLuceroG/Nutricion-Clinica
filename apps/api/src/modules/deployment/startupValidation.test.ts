import { describe, expect, it } from 'vitest';
import { validateStartupConfig, assertStartupConfigValid } from './startupValidation.js';

describe('startupValidation (Build 09.5A §16-18, §35-38, §73)', () => {
  it('dev local sin flags: sin errores (solo warnings permitidos)', () => {
    const issues = validateStartupConfig({}, {});
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('NODE_ENV=production sin ENVIRONMENT_CLASS: fail-fast', () => {
    const issues = validateStartupConfig({ NODE_ENV: 'production' });
    expect(issues.some((i) => i.severity === 'error' && i.group === 'environment')).toBe(true);
    expect(() => assertStartupConfigValid({ NODE_ENV: 'production' })).toThrow(/fail-fast/);
  });

  it('STAGING/PRODUCTION no pueden usar bases por defecto locales', () => {
    const issues = validateStartupConfig({ ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nutriclinica', DWH_DATABASE: 'nutriclinicadw' });
    expect(issues.some((i) => i.message.includes('bases por defecto locales'))).toBe(true);
  });

  it('STAGING/PRODUCTION rechazan CORS comodín', () => {
    const issues = validateStartupConfig({ ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nc_stg_oltp', DWH_DATABASE: 'nc_stg_dwh', CORS_ORIGIN: '*' });
    expect(issues.some((i) => i.message.includes('comodín'))).toBe(true);
    const ok = validateStartupConfig({ ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nc_stg_oltp', DWH_DATABASE: 'nc_stg_dwh', CORS_ORIGIN: 'https://app.example.com' });
    expect(ok.filter((i) => i.severity === 'error' && i.message.includes('comodín'))).toEqual([]);
  });

  it('DWH apuntando al mismo OLTP: error (fail-closed)', () => {
    const issues = validateStartupConfig({ DWH_ENABLED: 'true', DB_NAME: 'same', DWH_DATABASE: 'same' });
    expect(issues.some((i) => i.severity === 'error' && i.group === 'dwh')).toBe(true);
  });

  it('kill switches con valores inválidos: fail-fast', () => {
    expect(() => assertStartupConfigValid({ AI_EGRESS_ENABLED: 'si' })).toThrow(/AI_EGRESS_ENABLED/);
    expect(() => assertStartupConfigValid({ AI_PATIENT_ENABLED: 'yes' })).toThrow(/AI_PATIENT_ENABLED/);
  });

  it('shadow state inválido y stores inválidos: fail-fast', () => {
    expect(() => assertStartupConfigValid({ AI_SHADOW_STATE: 'RANDOM' })).toThrow(/AI_SHADOW_STATE/);
    expect(() => assertStartupConfigValid({ AI_TELEMETRY_STORE: 'file' })).toThrow(/AI_TELEMETRY_STORE/);
    expect(() => assertStartupConfigValid({ AI_CERTIFICATION_STORE: 'file' })).toThrow(/AI_CERTIFICATION_STORE/);
  });

  it('muestreo fuera de rango: fail-fast', () => {
    expect(() => assertStartupConfigValid({ AI_SHADOW_SAMPLE_RATE: '2.5' })).toThrow(/AI_SHADOW_SAMPLE_RATE/);
  });

  it('PRODUCTION con contraseña vacía: fail-fast', () => {
    const issues = validateStartupConfig({ ENVIRONMENT_CLASS: 'PRODUCTION', DB_NAME: 'nc_prod_oltp', DWH_DATABASE: 'nc_prod_dwh', DB_PASSWORD: '' });
    expect(issues.some((i) => i.message.includes('contraseña vacía'))).toBe(true);
  });

  it('AI_PATIENT_ENABLED=true: warning, no error (el gate clínico bloquea igual)', () => {
    const issues = validateStartupConfig({ AI_PATIENT_ENABLED: 'true' });
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('AI_PATIENT_ENABLED'))).toBe(true);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});