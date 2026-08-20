import { describe, expect, it } from 'vitest';
import {
  readEnvironmentClass,
  buildEnvironmentIdentity,
  assertEnvironmentKnown,
  isProductionEnvironment,
} from './environmentIdentity.js';
import { assertTargetSafe, assertStagingDatabases, describeTarget } from './targetGuard.js';

describe('environmentIdentity (Build 09.5A §4-5)', () => {
  it('ENVIRONMENT_CLASS explícito se respeta', () => {
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: 'staging' })).toBe('STAGING');
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: 'PRODUCTION' })).toBe('PRODUCTION');
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: 'local' })).toBe('LOCAL');
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: 'TEST' })).toBe('TEST');
  });

  it('sin ENVIRONMENT_CLASS: dev local => LOCAL; NODE_ENV=production => UNKNOWN (fail-closed)', () => {
    expect(readEnvironmentClass({})).toBe('LOCAL');
    expect(readEnvironmentClass({ NODE_ENV: 'test' })).toBe('LOCAL');
    expect(readEnvironmentClass({ NODE_ENV: 'production' })).toBe('UNKNOWN');
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: 'bogus', NODE_ENV: 'production' })).toBe('UNKNOWN');
  });

  it('UNKNOWN bloquea acciones sensibles de despliegue', () => {
    expect(() => assertEnvironmentKnown({ NODE_ENV: 'production' }, 'rebuild')).toThrow(/UNKNOWN/);
    expect(() => assertEnvironmentKnown({}, 'rebuild')).not.toThrow();
  });

  it('identidad: instanceId, targets, flags con defaults seguros', () => {
    const id = buildEnvironmentIdentity({});
    expect(id.environmentClass).toBe('LOCAL');
    expect(id.databaseTarget).toBe('nutriclinica');
    expect(id.dwhTarget).toBe('nutriclinicadw');
    expect(id.aiEnabled).toBe(false);
    expect(id.patientAiAllowed).toBe(false);
    expect(id.shadowAllowed).toBe(false);
    expect(id.production).toBe(false);
  });

  it('identidad nunca expone secretos', () => {
    const id = buildEnvironmentIdentity({ OPENAI_API_KEY: 'sk-secret-x', DB_PASSWORD: 'pwd', AI_EGRESS_ENABLED: 'true' });
    const json = JSON.stringify(id);
    expect(json).not.toContain('sk-secret-x');
    expect(json).not.toContain('pwd');
    expect(id.aiEnabled).toBe(true);
  });
});

describe('targetGuard (Build 09.5A §6, §26-28, §48)', () => {
  it('PRODUCTION: acciones destructivas fail-closed sin ALLOW_PRODUCTION_*', () => {
    const env = { ENVIRONMENT_CLASS: 'PRODUCTION' };
    expect(() => assertTargetSafe('migrate', env)).toThrow(/ALLOW_PRODUCTION_MIGRATE/);
    expect(() => assertTargetSafe('seed', env)).toThrow(/ALLOW_PRODUCTION_SEED/);
    expect(() => assertTargetSafe('reset', env)).toThrow(/ALLOW_PRODUCTION_RESET/);
    expect(() => assertTargetSafe('rebuild', env)).toThrow(/ALLOW_PRODUCTION_REBUILD/);
    expect(() => assertTargetSafe('drop', env)).toThrow(/ALLOW_PRODUCTION_DROP/);
  });

  it('PRODUCTION: ALLOW_PRODUCTION_* explícito permite (con bases no locales)', () => {
    const env = {
      ENVIRONMENT_CLASS: 'PRODUCTION',
      ALLOW_PRODUCTION_MIGRATE: 'true',
      DB_NAME: 'nc_prod_oltp',
      DWH_DATABASE: 'nc_prod_dwh',
    };
    expect(() => assertTargetSafe('migrate', env)).not.toThrow();
  });

  it('UNKNOWN: siempre fail-closed', () => {
    expect(() => assertTargetSafe('migrate', { NODE_ENV: 'production' })).toThrow(/UNKNOWN/);
  });

  it('STAGING no puede apuntar a bases por defecto locales ni mezclar OLTP/DWH', () => {
    const env = { ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nutriclinica', DWH_DATABASE: 'nutriclinicadw' };
    expect(() => assertTargetSafe('migrate', env)).toThrow(/por defecto/);
    const same = { ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nc_stg', DWH_DATABASE: 'nc_stg' };
    expect(() => assertTargetSafe('migrate', same)).toThrow(/misma base/);
    const missing = { ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nc_stg' };
    expect(() => assertStagingDatabases(missing)).toThrow(/explicitos/);
    const ok = { ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nc_stg_oltp', DWH_DATABASE: 'nc_stg_dwh' };
    expect(() => assertTargetSafe('migrate', ok)).not.toThrow();
  });

  it('LOCAL/TEST permiten migraciones (desarrollo local)', () => {
    expect(() => assertTargetSafe('migrate', { ENVIRONMENT_CLASS: 'LOCAL' })).not.toThrow();
    expect(() => assertTargetSafe('migrate', { ENVIRONMENT_CLASS: 'TEST' })).not.toThrow();
  });

  it('describeTarget reporta el objetivo sin exponer credenciales', () => {
    const target = describeTarget({ ENVIRONMENT_CLASS: 'STAGING', DB_NAME: 'nc_stg_oltp', DWH_DATABASE: 'nc_stg_dwh', DB_PASSWORD: 'x' });
    expect(target.oltp).toBe('nc_stg_oltp');
    expect(target.dwh).toBe('nc_stg_dwh');
    expect(JSON.stringify(target)).not.toContain('x');
    expect(isProductionEnvironment({ ENVIRONMENT_CLASS: 'PRODUCTION' })).toBe(true);
  });
});