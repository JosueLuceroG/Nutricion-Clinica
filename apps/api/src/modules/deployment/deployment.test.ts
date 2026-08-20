import { describe, expect, it } from 'vitest';
import { buildDeploymentManifest, currentPromptBundleVersion } from './deploymentManifest.js';
import { readFeatureFlags, effectiveFeatureFlags } from './featureFlags.js';
import { evaluatePreDeployGate, scanTrackedSecrets } from './preDeployGate.js';
import { evaluateReleaseGate } from './releaseGate.js';
import { sanitizeForClientMessage, redactSecrets } from './sanitize.js';
import { errorHandler, HttpError } from '../../middleware/errorHandler.js';
import type { Request, Response } from 'express';

describe('deploymentManifest (Build 09.5A §22)', () => {
  it('manifiesto completo y trazable', () => {
    const manifest = buildDeploymentManifest({});
    expect(manifest.gitCommit).toBeTruthy();
    expect(manifest.oltpSchemaVersion).toMatch(/^\d{3}$/);
    expect(manifest.oltpSchemaVersion).toBe('039');
    expect(manifest.dwhSchemaVersion).toMatch(/^dwh-/);
    expect(manifest.semanticCatalogVersion).toBeTruthy();
    expect(manifest.promptBundleVersion).toMatch(/^prompt-bundle\.[0-9a-f]{8}$/);
    expect(manifest.deployedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('manifiesto nunca contiene secretos', () => {
    const manifest = buildDeploymentManifest({ OPENAI_API_KEY: 'sk-leak-test', DB_PASSWORD: 'pwd-leak' });
    const json = JSON.stringify(manifest);
    expect(json).not.toContain('sk-leak-test');
    expect(json).not.toContain('pwd-leak');
  });

  it('prompt bundle version es determinista', () => {
    expect(currentPromptBundleVersion()).toBe(currentPromptBundleVersion());
  });
});

describe('featureFlags (Build 09.5A §32-34)', () => {
  it('defaults seguros: todo deshabilitado', () => {
    const flags = readFeatureFlags({});
    for (const flag of flags) {
      expect(flag.enabled).toBe(false);
      expect(flag.safeDefault).toBe(false);
    }
  });

  it('entorno UNKNOWN => todos apagados (fail-closed)', () => {
    const flags = effectiveFeatureFlags({ NODE_ENV: 'production' });
    expect(flags.every((f) => f.enabled === false)).toBe(true);
  });

  it('flags explícitos se reflejan', () => {
    const flags = readFeatureFlags({ AI_EGRESS_ENABLED: 'true', AI_SHADOW_STATE: 'TECHNICAL_TEST_ONLY' });
    expect(flags.find((f) => f.id === 'ai_egress')?.enabled).toBe(true);
    expect(flags.find((f) => f.id === 'ai_shadow')?.enabled).toBe(true);
    expect(flags.find((f) => f.id === 'ai_patient')?.enabled).toBe(false);
  });
});

describe('preDeployGate (Build 09.5A §23-25, §42)', () => {
  it('reporta todos los checks con estado válido', () => {
    const gate = evaluatePreDeployGate({});
    const ids = gate.checks.map((c) => c.id);
    expect(ids).toContain('worktree_clean');
    expect(ids).toContain('release_traceable');
    expect(ids).toContain('config_valid');
    expect(ids).toContain('feature_flags_safe');
    expect(ids).toContain('secret_scan');
    expect(ids).toContain('manifest_complete');
    expect(ids).toContain('kill_switch_known');
    for (const check of gate.checks) {
      expect(['PASS', 'FAIL', 'PENDING_EXTERNAL']).toContain(check.status);
    }
  });

  it('tier B (externo) siempre PENDING_EXTERNAL: nunca se finge verificación', () => {
    const gate = evaluatePreDeployGate({});
    for (const id of ['pending_migrations', 'backup_available', 'rollback_artifact', 'staging_smoke']) {
      const check = gate.checks.find((c) => c.id === id)!;
      expect(check.status).toBe('PENDING_EXTERNAL');
      expect(check.detail).not.toMatch(/^(PASS|verificado)$/i);
    }
  });

  it('env UNKNOWN (NODE_ENV=production) => config_valid FAIL', () => {
    const gate = evaluatePreDeployGate({ NODE_ENV: 'production' });
    expect(gate.checks.find((c) => c.id === 'config_valid')?.status).toBe('FAIL');
  });

  it('secret scan: repositorio sin secretos (excluye tests)', () => {
    const scan = scanTrackedSecrets();
    expect(scan.found).toEqual([]);
    expect(scan.scanned).toBeGreaterThan(50);
  });
});

describe('releaseGate (Build 09.5A §41-42, §45-46)', () => {
  it('lectura honesta: STAGING BLOCKED, MODELO NOT_READY, SHADOW BLOCKED', async () => {
    const gate = await evaluateReleaseGate({});
    expect(gate.groups.find((g) => g.group === 'STAGING')?.status).toBe('BLOCKED');
    expect(gate.groups.find((g) => g.group === 'MODEL')?.status).toBe('NOT_READY');
    expect(gate.groups.find((g) => g.group === 'SHADOW')?.status).toBe('BLOCKED');
    expect(gate.groups.find((g) => g.group === 'PROFESSIONAL_VALIDATION')?.status).toBe('NOT_READY');
    expect(gate.groups.find((g) => g.group === 'CLINICAL_CERTIFICATION')?.status).toBe('NOT_READY');
    expect(['BLOCKED', 'NOT_READY']).toContain(gate.overall);
  });
});

describe('sanitize/redaction (Build 09.5A §37)', () => {
  it('redacta connection strings y claves', () => {
    const raw = 'Server=tcp:db.example.com,1433;User ID=sa;Password=Sup3rS3cret! User=admin PWD=abc123';
    const redacted = redactSecrets(raw);
    expect(redacted).not.toContain('Sup3rS3cret');
    expect(redacted).not.toContain('db.example.com');
    expect(redacted).not.toContain('abc123');
  });

  it('sanea mensajes para el cliente (acota longitud, sin saltos)', () => {
    const long = `a ${'x'.repeat(600)} \n b`;
    const out = sanitizeForClientMessage(long);
    expect(out.length).toBeLessThanOrEqual(501);
    expect(out).not.toContain('\n');
  });

  it('errorHandler nunca filtra stacks/keys al cliente', () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(500);
        return res;
      },
      json: (body: unknown) => {
        expect(String(body)).not.toContain('sk-leak');
        expect(String(body)).not.toContain('at Error');
        return res;
      },
    } as unknown as Response;
    const req = {} as Request;
    errorHandler(new Error('boom con sk-leak-test-key en stack'), req, res, () => {});
  });

  it('HttpError con detalles sensibles: saneado', () => {
    const res = {
      status: (code: number) => {
        expect(code).toBe(400);
        return res;
      },
      json: (body: unknown) => {
        expect(String(body)).not.toContain('sk-leak');
        return res;
      },
    } as unknown as Response;
    const req = {} as Request;
    errorHandler(new HttpError(400, 'fallo', { db: 'Server=x;Password=sk-leak' }), req, res, () => {});
  });
});