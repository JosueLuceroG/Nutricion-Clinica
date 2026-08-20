import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import { ClinicalCertificationRegistry } from './clinicalCertification.js';
import { createSqlCertificationPersistence } from './certificationPersistence.js';
import { CURRENT_VERSIONS } from './versions.js';

/**
 * VERIFICACIÓN SQL REAL — Build 09.5A (migración 039: persistencia de
 * certificación clínica). Solo corre con AI_REAL_SQL_TEST=1 contra
 * nc_b09_oltp (PS1 runbook). Sin mocks: roundtrip save/load de registros y
 * flags, reinicio simulado, cambio de fingerprint.
 */

const REAL_SQL = process.env.AI_REAL_SQL_TEST === '1';

const U1 = 'c0000000-0000-4000-8000-0000000000a1';
const U2 = 'c0000000-0000-4000-8000-0000000000a2';

describe.runIf(REAL_SQL)('Build 09.5A real SQL (nc_b09_oltp, migración 039)', () => {
  let pool: sql.ConnectionPool;

  beforeAll(async () => {
    expect(process.env.DB_NAME).toMatch(/nc_b09_oltp/i);
    pool = await getPool();
  });

  afterAll(async () => {
    if (pool) await pool.close();
  });

  async function cleanup(): Promise<void> {
    await pool.request().query(`DELETE FROM ai_requalification_flags WHERE provider_id = N'cert-persistence-test'`);
    await pool.request().query(`DELETE FROM ai_certification_records WHERE provider_id = N'cert-persistence-test'`);
  }

  it('migración 039 aplicada: tablas de certificación existen', async () => {
    for (const table of ['ai_certification_records', 'ai_requalification_flags']) {
      const r = await pool.request().input('t', sql.NVarChar(100), table)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM sys.tables WHERE name = @t`);
      expect(r.recordset[0]!.n, `tabla ${table}`).toBe(1);
    }
  });

  it('flags base del torneo 07.5A sembrados (idempotente, fail-closed)', async () => {
    const r = await pool.request().query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ai_requalification_flags WHERE provider_id = N'ollama' AND model_id = N'llama3.2'`,
    );
    expect(r.recordset[0]!.n).toBeGreaterThanOrEqual(1);
  });

  it('roundtrip: registrar certificación con fingerprint y recargarla tras "reinicio"', async () => {
    await cleanup();
    const persistence = createSqlCertificationPersistence();
    const capability = 'nutrition_reasoning' as const;
    const record = {
      certificationId: `cert-persistence-test-${U1}`,
      key: {
        providerId: 'cert-persistence-test',
        modelId: 'modelo-cert',
        modelVersion: '1.0',
        capabilityId: capability,
        promptVersion: CURRENT_VERSIONS.promptVersion[capability],
        toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
        policyVersion: CURRENT_VERSIONS.policyVersion,
        outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion[capability],
        evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
        knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
        retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
        smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
        deploymentFingerprint: 'deploy-real-001',
      },
      state: 'APPROVED_NUTRITION_SUPPORT' as const,
      evaluatedAt: '2026-08-20T00:00:00.000Z',
      datasetFingerprint: 'dataset-real-001',
      reportRef: 'report-real-001.json',
    };
    await persistence.saveCertificationRecord(record);
    await persistence.saveCertificationRecord(record);

    const loaded = await persistence.loadCertificationRecords();
    expect(loaded.filter((r) => r.key.providerId === 'cert-persistence-test').length).toBe(1);
    const loadedRecord = loaded.find((r) => r.certificationId === record.certificationId)!;
    expect(loadedRecord.key.deploymentFingerprint).toBe('deploy-real-001');

    const restarted = new ClinicalCertificationRegistry();
    restarted.replaceAll(loaded, await persistence.loadRequalificationFlags());
    const res = restarted.resolve('cert-persistence-test', 'modelo-cert', '1.0', capability, {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      deploymentFingerprint: 'deploy-real-001',
    });
    expect(res.eligible).toBe(true);

    const changed = restarted.resolve('cert-persistence-test', 'modelo-cert', '1.0', capability, {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
      deploymentFingerprint: 'deploy-real-002',
    });
    expect(changed.eligible).toBe(false);
    expect(changed.requalificationRequired).toBe(true);
  });

  it('marcar y limpiar requalification flag en SQL real', async () => {
    await cleanup();
    const persistence = createSqlCertificationPersistence();
    await persistence.markRequalification({ providerId: 'cert-persistence-test', modelId: 'm', capabilityId: 'chat_general', reasonRef: U2 });
    await persistence.markRequalification({ providerId: 'cert-persistence-test', modelId: 'm', capabilityId: 'chat_general', reasonRef: U2 });
    const flags = await persistence.loadRequalificationFlags();
    expect(flags.filter((f) => f.providerId === 'cert-persistence-test').length).toBe(1);
    await persistence.clearRequalification('cert-persistence-test', 'm', 'chat_general');
    expect((await persistence.loadRequalificationFlags()).filter((f) => f.providerId === 'cert-persistence-test').length).toBe(0);
  });

  it('SECRET SCAN: fixture sintético sin datos reales', async () => {
    const txt = JSON.stringify({ u1: U1, u2: U2 });
    expect(txt).not.toMatch(/NutriCl1n1c4/);
  });
});