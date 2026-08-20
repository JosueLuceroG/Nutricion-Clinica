import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import type { AIModelCapability } from '../evaluation/capabilities.js';
import {
  clinicalCertificationRegistry,
  type ClinicalCertificationRecord,
} from './clinicalCertification.js';

/**
 * Persistencia de certificación clínica (Build 09.5A §55-57, §85).
 * - La BD es la fuente de verdad en PRODUCTION/STAGING: al arrancar se CARGAN
 *   registros + flags de requalificación y se REEMPLAZAN los seeds.
 * - Vacío/ausente/stale => NOT_ELIGIBLE (fail-closed). NUNCA se asume aprobado.
 * - Un cambio de fingerprint de deployment invalida la certificación (requalification).
 * - El estado sobrevive reinicios (sin estado "in-memory" que haga aparecer
 *   a un modelo como elegible tras un redeploy).
 */

export interface RequalificationFlag {
  providerId: string;
  modelId: string;
  capabilityId: AIModelCapability;
  reasonRef?: string;
  flaggedAt?: string;
}

export interface CertificationPersistence {
  kind: 'memory' | 'sql';
  loadCertificationRecords(): Promise<ClinicalCertificationRecord[]>;
  loadRequalificationFlags(): Promise<RequalificationFlag[]>;
  saveCertificationRecord(record: ClinicalCertificationRecord): Promise<void>;
  markRequalification(flag: RequalificationFlag): Promise<void>;
  clearRequalification(providerId: string, modelId: string, capabilityId: AIModelCapability): Promise<void>;
}

/** Store en memoria: para tests/desarrollo. Nunca persiste. */
export function createMemoryCertificationPersistence(): CertificationPersistence {
  return {
    kind: 'memory',
    async loadCertificationRecords() {
      return [];
    },
    async loadRequalificationFlags() {
      return [];
    },
    async saveCertificationRecord(_record) {
      /* no-op */
    },
    async markRequalification(_flag) {
      /* no-op */
    },
    async clearRequalification(_p, _m, _c) {
      /* no-op */
    },
  };
}

/**
 * Store SQL: tabla ai_certification_records + ai_requalification_flags
 * (migración 039). Sin filas => store vacío (fail-closed).
 */
export function createSqlCertificationPersistence(): CertificationPersistence {
  return {
    kind: 'sql',
    async loadCertificationRecords(): Promise<ClinicalCertificationRecord[]> {
      const pool = await getPool();
      const result = await pool.request().query<{ record_json: string }>(
        'SELECT record_json FROM ai_certification_records ORDER BY evaluated_at DESC',
      );
      return result.recordset.map((row) => JSON.parse(row.record_json) as ClinicalCertificationRecord);
    },
    async loadRequalificationFlags(): Promise<RequalificationFlag[]> {
      const pool = await getPool();
      const result = await pool.request().query<{
        provider_id: string;
        model_id: string;
        capability_id: string;
        reason_ref: string | null;
        flagged_at: string;
      }>('SELECT provider_id, model_id, capability_id, reason_ref, flagged_at FROM ai_requalification_flags');
      return result.recordset.map((row) => ({
        providerId: row.provider_id,
        modelId: row.model_id,
        capabilityId: row.capability_id as AIModelCapability,
        reasonRef: row.reason_ref ?? undefined,
        flaggedAt: row.flagged_at,
      }));
    },
    async saveCertificationRecord(record: ClinicalCertificationRecord): Promise<void> {
      const pool = await getPool();
      await pool
        .request()
        .input('certification_id', sql.NVarChar(200), record.certificationId)
        .input('provider_id', sql.NVarChar(50), record.key.providerId)
        .input('model_id', sql.NVarChar(100), record.key.modelId)
        .input('model_version', sql.NVarChar(50), record.key.modelVersion)
        .input('capability_id', sql.NVarChar(64), record.key.capabilityId)
        .input('state', sql.NVarChar(32), record.state)
        .input('evaluated_at', sql.DateTime2, new Date(record.evaluatedAt))
        .input('dataset_fingerprint', sql.NVarChar(64), record.datasetFingerprint)
        .input('report_ref', sql.NVarChar(500), record.reportRef)
        .input('deployment_fingerprint', sql.NVarChar(64), record.key.deploymentFingerprint ?? null)
        .input('record_json', sql.NVarChar(sql.MAX), JSON.stringify(record))
        .query(
          `IF EXISTS (SELECT 1 FROM ai_certification_records WHERE certification_id = @certification_id)
             UPDATE ai_certification_records
                SET provider_id = @provider_id, model_id = @model_id, model_version = @model_version,
                    capability_id = @capability_id, state = @state, evaluated_at = @evaluated_at,
                    dataset_fingerprint = @dataset_fingerprint, report_ref = @report_ref,
                    deployment_fingerprint = @deployment_fingerprint, record_json = @record_json,
                    updated_at = SYSUTCDATETIME()
              WHERE certification_id = @certification_id
           ELSE
             INSERT INTO ai_certification_records
               (certification_id, provider_id, model_id, model_version, capability_id, state,
                evaluated_at, dataset_fingerprint, report_ref, deployment_fingerprint, record_json)
             VALUES
               (@certification_id, @provider_id, @model_id, @model_version, @capability_id, @state,
                @evaluated_at, @dataset_fingerprint, @report_ref, @deployment_fingerprint, @record_json)`,
        );
    },
    async markRequalification(flag: RequalificationFlag): Promise<void> {
      const pool = await getPool();
      await pool
        .request()
        .input('provider_id', sql.NVarChar(50), flag.providerId)
        .input('model_id', sql.NVarChar(100), flag.modelId)
        .input('capability_id', sql.NVarChar(64), flag.capabilityId)
        .input('reason_ref', sql.NVarChar(500), flag.reasonRef ?? null)
        .query(
          `IF NOT EXISTS (
             SELECT 1 FROM ai_requalification_flags
              WHERE provider_id = @provider_id AND model_id = @model_id AND capability_id = @capability_id
           )
           INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
           VALUES (@provider_id, @model_id, @capability_id, @reason_ref)`,
        );
    },
    async clearRequalification(providerId: string, modelId: string, capabilityId: AIModelCapability): Promise<void> {
      const pool = await getPool();
      await pool
        .request()
        .input('provider_id', sql.NVarChar(50), providerId)
        .input('model_id', sql.NVarChar(100), modelId)
        .input('capability_id', sql.NVarChar(64), capabilityId)
        .query(
          'DELETE FROM ai_requalification_flags WHERE provider_id = @provider_id AND model_id = @model_id AND capability_id = @capability_id',
        );
    },
  };
}

export function selectCertificationPersistence(env: NodeJS.ProcessEnv = process.env): CertificationPersistence {
  return (env.AI_CERTIFICATION_STORE ?? 'memory') === 'sql'
    ? createSqlCertificationPersistence()
    : createMemoryCertificationPersistence();
}

/**
 * Carga la persistencia al arranque (server.ts). Fail-closed:
 * - sql: BD vacía o con error => el registro queda VACÍO (NOT_ELIGIBLE todo);
 *   un error de conexión/lectura ABORTA el arranque (fail fast).
 * - memory: mantiene los seeds + flags por defecto (tests/desarrollo).
 */
export async function initializeCertificationPersistence(env: NodeJS.ProcessEnv = process.env): Promise<CertificationPersistence> {
  const persistence = selectCertificationPersistence(env);
  if (persistence.kind === 'memory') {
    return persistence;
  }
  try {
    const [records, flags] = await Promise.all([
      persistence.loadCertificationRecords(),
      persistence.loadRequalificationFlags(),
    ]);
    clinicalCertificationRegistry.replaceAll(records, flags);
    return persistence;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `certificación clínica: no se pudo cargar persistencia SQL (fail-fast): ${detail}`,
      { cause: err },
    );
  }
}

/** Persiste un flag de requalificación en el store + registra en el registry (operadores). */
export async function persistRequalificationFlag(
  flag: RequalificationFlag,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  clinicalCertificationRegistry.markRequalificationRequired(flag.providerId, flag.modelId, flag.capabilityId);
  await selectCertificationPersistence(env).markRequalification(flag);
}

/** Persiste un registro de certificación en el store + registra en el registry (onboarding). */
export async function persistCertificationRecord(
  record: ClinicalCertificationRecord,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  clinicalCertificationRegistry.register(record);
  await selectCertificationPersistence(env).saveCertificationRecord(record);
}