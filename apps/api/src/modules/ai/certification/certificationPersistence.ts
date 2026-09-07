import sql from "mssql";
import { z } from "zod";
import { getPool } from "../../../db/connection.js";
import type { AIModelCapability } from "../evaluation/capabilities.js";
import {
  clinicalCertificationRegistry,
  type ClinicalCertificationRecord,
} from "./clinicalCertification.js";
import { CERTIFICATION_STATES } from "./certificationStates.js";

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
  kind: "memory" | "sql";
  loadCertificationRecords(): Promise<ClinicalCertificationRecord[]>;
  loadRequalificationFlags(): Promise<RequalificationFlag[]>;
  saveCertificationRecord(record: ClinicalCertificationRecord): Promise<void>;
  markRequalification(flag: RequalificationFlag): Promise<void>;
  clearRequalification(
    providerId: string,
    modelId: string,
    capabilityId: AIModelCapability,
  ): Promise<void>;
}

const PERSISTED_CAPABILITIES = [
  "chat_general",
  "structured_json",
  "nutrition_reasoning",
  "patient_support",
] as const satisfies readonly AIModelCapability[];

const PersistedCertificationRecordSchema = z
  .object({
    certificationId: z.string().trim().min(1).max(200),
    key: z
      .object({
        providerId: z.string().trim().toLowerCase().min(1).max(50),
        modelId: z.string().trim().min(1).max(100),
        modelVersion: z.string().trim().min(1).max(50),
        capabilityId: z.enum(PERSISTED_CAPABILITIES),
        promptVersion: z.string().trim().min(1).max(200),
        toolsetVersion: z.string().trim().min(1).max(200),
        policyVersion: z.string().trim().min(1).max(200),
        outputSchemaVersion: z.string().trim().min(1).max(200),
        evaluationDatasetVersion: z.string().trim().min(1).max(200),
        knowledgePolicyVersion: z.string().trim().min(1).max(200),
        retrievalPolicyVersion: z.string().trim().min(1).max(200),
        smaeCatalogVersion: z.string().trim().min(1).max(200),
        deploymentFingerprint: z
          .string()
          .trim()
          .regex(/^deploy-[0-9a-f]{8}$/i)
          .optional(),
      })
      .strict(),
    state: z.enum(CERTIFICATION_STATES),
    restrictedCapabilities: z
      .array(z.enum(PERSISTED_CAPABILITIES))
      .max(4)
      .optional(),
    evaluatedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString())
      .refine((value) => Date.parse(value) <= Date.now()),
    datasetFingerprint: z.string().trim().min(1).max(64),
    reportRef: z
      .string()
      .trim()
      .max(500)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/:+-]{4,399}@sha256:[0-9a-f]{64}$/i),
    knownFailures: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
  })
  .strict();

const RequalificationFlagSchema = z
  .object({
    providerId: z.string().trim().toLowerCase().min(1).max(50),
    modelId: z.string().trim().min(1).max(100),
    capabilityId: z.enum(PERSISTED_CAPABILITIES),
    reasonRef: z.string().trim().min(1).max(500).optional(),
    flaggedAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString())
      .optional(),
  })
  .strict();

export function parsePersistedCertificationRecord(
  value: unknown,
): ClinicalCertificationRecord {
  return PersistedCertificationRecordSchema.parse(
    value,
  ) as ClinicalCertificationRecord;
}

function parseRequalificationFlag(value: unknown): RequalificationFlag {
  return RequalificationFlagSchema.parse(value);
}

/** Store en memoria: para tests/desarrollo. Nunca persiste. */
export function createMemoryCertificationPersistence(): CertificationPersistence {
  return {
    kind: "memory",
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
    kind: "sql",
    async loadCertificationRecords(): Promise<ClinicalCertificationRecord[]> {
      const pool = await getPool();
      const result = await pool.request().query<{
        record_json: string;
      }>("SELECT record_json FROM ai_certification_records ORDER BY evaluated_at DESC");
      return result.recordset.map((row) => {
        if (row.record_json.length > 100_000) {
          throw new Error("persisted certification record is oversized");
        }
        return parsePersistedCertificationRecord(JSON.parse(row.record_json));
      });
    },
    async loadRequalificationFlags(): Promise<RequalificationFlag[]> {
      const pool = await getPool();
      const result = await pool.request().query<{
        provider_id: string;
        model_id: string;
        capability_id: string;
        reason_ref: string | null;
        flagged_at: Date;
      }>("SELECT provider_id, model_id, capability_id, reason_ref, flagged_at FROM ai_requalification_flags");
      return result.recordset.map((row) =>
        parseRequalificationFlag({
          providerId: row.provider_id,
          modelId: row.model_id,
          capabilityId: row.capability_id,
          reasonRef: row.reason_ref ?? undefined,
          flaggedAt: row.flagged_at.toISOString(),
        }),
      );
    },
    async saveCertificationRecord(
      record: ClinicalCertificationRecord,
    ): Promise<void> {
      record = parsePersistedCertificationRecord(record);
      const pool = await getPool();
      await pool
        .request()
        .input("certification_id", sql.NVarChar(200), record.certificationId)
        .input("provider_id", sql.NVarChar(50), record.key.providerId)
        .input("model_id", sql.NVarChar(100), record.key.modelId)
        .input("model_version", sql.NVarChar(50), record.key.modelVersion)
        .input("capability_id", sql.NVarChar(64), record.key.capabilityId)
        .input("state", sql.NVarChar(32), record.state)
        .input("evaluated_at", sql.DateTime2, new Date(record.evaluatedAt))
        .input(
          "dataset_fingerprint",
          sql.NVarChar(64),
          record.datasetFingerprint,
        )
        .input("report_ref", sql.NVarChar(500), record.reportRef)
        .input(
          "deployment_fingerprint",
          sql.NVarChar(64),
          record.key.deploymentFingerprint ?? null,
        )
        .input("record_json", sql.NVarChar(sql.MAX), JSON.stringify(record))
        .query(
          `SET XACT_ABORT ON;
           BEGIN TRANSACTION;
           DECLARE @existing_record_json NVARCHAR(MAX);
           SELECT @existing_record_json = record_json
             FROM ai_certification_records WITH (UPDLOCK, HOLDLOCK)
            WHERE certification_id = @certification_id;
           IF @existing_record_json IS NOT NULL
              AND @existing_record_json COLLATE Latin1_General_100_BIN2 <> @record_json COLLATE Latin1_General_100_BIN2
           BEGIN
             ROLLBACK TRANSACTION;
             THROW 51001, 'certificationId is immutable', 1;
           END;
           IF @existing_record_json IS NULL
             INSERT INTO ai_certification_records
               (certification_id, provider_id, model_id, model_version, capability_id, state,
                 evaluated_at, dataset_fingerprint, report_ref, deployment_fingerprint, record_json)
              VALUES
                (@certification_id, @provider_id, @model_id, @model_version, @capability_id, @state,
                 @evaluated_at, @dataset_fingerprint, @report_ref, @deployment_fingerprint, @record_json);
           COMMIT TRANSACTION;`,
        );
    },
    async markRequalification(flag: RequalificationFlag): Promise<void> {
      flag = parseRequalificationFlag(flag);
      const pool = await getPool();
      await pool
        .request()
        .input("provider_id", sql.NVarChar(50), flag.providerId)
        .input("model_id", sql.NVarChar(100), flag.modelId)
        .input("capability_id", sql.NVarChar(64), flag.capabilityId)
        .input("reason_ref", sql.NVarChar(500), flag.reasonRef ?? null)
        .query(
          `SET XACT_ABORT ON;
           BEGIN TRANSACTION;
           UPDATE ai_requalification_flags WITH (UPDLOCK, HOLDLOCK)
              SET reason_ref = @reason_ref, flagged_at = SYSUTCDATETIME()
            WHERE provider_id = @provider_id AND model_id = @model_id AND capability_id = @capability_id;
           IF @@ROWCOUNT = 0
             INSERT INTO ai_requalification_flags (provider_id, model_id, capability_id, reason_ref)
             VALUES (@provider_id, @model_id, @capability_id, @reason_ref);
           COMMIT TRANSACTION;`,
        );
    },
    async clearRequalification(
      providerId: string,
      modelId: string,
      capabilityId: AIModelCapability,
    ): Promise<void> {
      const pool = await getPool();
      await pool
        .request()
        .input("provider_id", sql.NVarChar(50), providerId)
        .input("model_id", sql.NVarChar(100), modelId)
        .input("capability_id", sql.NVarChar(64), capabilityId)
        .query(
          "DELETE FROM ai_requalification_flags WHERE provider_id = @provider_id AND model_id = @model_id AND capability_id = @capability_id",
        );
    },
  };
}

export function selectCertificationPersistence(
  env: NodeJS.ProcessEnv = process.env,
): CertificationPersistence {
  return (env.AI_CERTIFICATION_STORE ?? "memory").trim() === "sql"
    ? createSqlCertificationPersistence()
    : createMemoryCertificationPersistence();
}

/**
 * Carga la persistencia al arranque (server.ts). Fail-closed:
 * - sql: BD vacía o con error => el registro queda VACÍO (NOT_ELIGIBLE todo);
 *   un error de conexión/lectura ABORTA el arranque (fail fast).
 * - memory: mantiene los seeds + flags por defecto (tests/desarrollo).
 */
export async function initializeCertificationPersistence(
  env: NodeJS.ProcessEnv = process.env,
): Promise<CertificationPersistence> {
  const persistence = selectCertificationPersistence(env);
  if (persistence.kind === "memory") {
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
  flag = parseRequalificationFlag(flag);
  await selectCertificationPersistence(env).markRequalification(flag);
  clinicalCertificationRegistry.markRequalificationRequired(
    flag.providerId,
    flag.modelId,
    flag.capabilityId,
    flag.reasonRef,
    flag.flaggedAt,
  );
}

/** Persiste un registro de certificación en el store + registra en el registry (onboarding). */
export async function persistCertificationRecord(
  record: ClinicalCertificationRecord,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  record = parsePersistedCertificationRecord(record);
  await selectCertificationPersistence(env).saveCertificationRecord(record);
  clinicalCertificationRegistry.register(record);
}
