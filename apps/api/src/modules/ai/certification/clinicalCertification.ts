import type { AIModelCapability } from '../evaluation/capabilities.js';
import { GOLDEN_DATASET_V1_FINGERPRINT } from '../evaluation/certification.js';
import { CURRENT_VERSIONS, type CurrentVersions } from './versions.js';
import { stateSatisfies, type CertificationState } from './certificationStates.js';
import type { RequalificationFlag } from './certificationPersistence.js';

/** Clave EXACTA de certificación: la combinación completa, nunca solo provider+model. */
export interface CertificationKey {
  providerId: string;
  modelId: string;
  modelVersion: string;
  capabilityId: AIModelCapability;
  promptVersion: string;
  toolsetVersion: string;
  policyVersion: string;
  outputSchemaVersion: string;
  evaluationDatasetVersion?: string;
  knowledgePolicyVersion?: string;
  /** retrieval-policy.v2 (Build 07): sinonimos + retrieval versionado. */
  retrievalPolicyVersion?: string;
  /** Fingerprint del catálogo SMAE vigente al momento de la certificación. */
  smaeCatalogVersion?: string;
  /**
   * Fingerprint del deployment (digest/cuantización/runtime/settings).
   * Mismo modelo en deployment materialmente distinto => NO se reutiliza la
   * certificación (Build 09.5A §57). Sin fingerprint = legado/semilla.
   */
  deploymentFingerprint?: string;
}

export interface ClinicalCertificationRecord {
  certificationId: string;
  key: CertificationKey;
  state: CertificationState;
  /** Solo para RESTRICTED: capabilities explícitamente permitidas. */
  restrictedCapabilities?: AIModelCapability[];
  evaluatedAt: string;
  datasetFingerprint: string;
  reportRef: string;
  knownFailures?: string[];
}

export interface CertificationResolution {
  eligible: boolean;
  state?: CertificationState;
  certificationId?: string;
  stale: boolean;
  requalificationRequired: boolean;
  reason?: string;
}

const RECORD_SEEDS: ClinicalCertificationRecord[] = [
  {
    certificationId: 'cert-openai-gpt-4o-mini-chat_general-v1',
    key: {
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      modelVersion: 'gpt-4o-mini-2024-07-18',
      capabilityId: 'chat_general',
      promptVersion: CURRENT_VERSIONS.promptVersion.chat_general,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.chat_general,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_GENERAL',
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'gpt-4o-mini-chat-general-v1.json',
  },
  {
    certificationId: 'cert-openai-gpt-4o-mini-structured_json-v1',
    key: {
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      modelVersion: 'gpt-4o-mini-2024-07-18',
      capabilityId: 'structured_json',
      promptVersion: CURRENT_VERSIONS.promptVersion.structured_json,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.structured_json,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_ANALYTICS',
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'gpt-4o-mini-structured-json-v1.json',
  },
  {
    certificationId: 'cert-openai-gpt-4o-mini-nutrition_reasoning-v1',
    key: {
      providerId: 'openai',
      modelId: 'gpt-4o-mini',
      modelVersion: 'gpt-4o-mini-2024-07-18',
      capabilityId: 'nutrition_reasoning',
      promptVersion: CURRENT_VERSIONS.promptVersion.nutrition_reasoning,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.nutrition_reasoning,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_NUTRITION_SUPPORT',
    evaluatedAt: '2026-08-14T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'gpt-4o-mini-nutrition-v1.json',
  },
  {
    certificationId: 'cert-openai-gpt-4o-chat_general-v1',
    key: {
      providerId: 'openai',
      modelId: 'gpt-4o',
      modelVersion: 'gpt-4o-2024-08-06',
      capabilityId: 'chat_general',
      promptVersion: CURRENT_VERSIONS.promptVersion.chat_general,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.chat_general,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_GENERAL',
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'gpt-4o-chat-general-v1.json',
  },
  {
    certificationId: 'cert-openai-gpt-4o-structured_json-v1',
    key: {
      providerId: 'openai',
      modelId: 'gpt-4o',
      modelVersion: 'gpt-4o-2024-08-06',
      capabilityId: 'structured_json',
      promptVersion: CURRENT_VERSIONS.promptVersion.structured_json,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.structured_json,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_ANALYTICS',
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'gpt-4o-structured-json-v1.json',
  },
  {
    certificationId: 'cert-openai-gpt-4o-nutrition_reasoning-exp',
    key: {
      providerId: 'openai',
      modelId: 'gpt-4o',
      modelVersion: 'gpt-4o-2024-08-06',
      capabilityId: 'nutrition_reasoning',
      promptVersion: CURRENT_VERSIONS.promptVersion.nutrition_reasoning,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.nutrition_reasoning,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'EXPERIMENTAL',
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: '',
  },
  {
    certificationId: 'cert-ollama-llama3.2-chat_general-v1',
    key: {
      providerId: 'ollama',
      modelId: 'llama3.2',
      modelVersion: '3.2',
      capabilityId: 'chat_general',
      promptVersion: CURRENT_VERSIONS.promptVersion.chat_general,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.chat_general,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_GENERAL',
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'llama3.2-chat-general-v1.json',
  },
  {
    certificationId: 'cert-ollama-llama3.2-structured_json-restricted',
    key: {
      providerId: 'ollama',
      modelId: 'llama3.2',
      modelVersion: '3.2',
      capabilityId: 'structured_json',
      promptVersion: CURRENT_VERSIONS.promptVersion.structured_json,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.structured_json,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'RESTRICTED',
    restrictedCapabilities: [],
    evaluatedAt: '2026-08-13T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: '',
  },
  {
    certificationId: 'cert-ollama-llama3.2-nutrition_reasoning-v1',
    key: {
      providerId: 'ollama',
      modelId: 'llama3.2',
      modelVersion: '3.2',
      capabilityId: 'nutrition_reasoning',
      promptVersion: CURRENT_VERSIONS.promptVersion.nutrition_reasoning,
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion.nutrition_reasoning,
      evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
      knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
      retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
      smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    },
    state: 'APPROVED_NUTRITION_SUPPORT',
    evaluatedAt: '2026-08-14T00:00:00.000Z',
    datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
    reportRef: 'llama3.2-nutrition-v1.json',
  },
];

export interface ResolveContext {
  requiredState: CertificationState;
  allowExperimental?: boolean;
  versions?: CurrentVersions;
  evaluationDatasetVersion?: string;
  knowledgePolicyVersion?: string;
  /** Fingerprint del deployment vigente (Build 09.5A §57): exige coincidencia exacta. */
  deploymentFingerprint?: string;
}

/**
 * Flags de requalificación POR DEFECTO (Build 07.5A, resultado del torneo
 * clínico). En runtime el estado proviene de la BD (ai_requalification_flags,
 * migración 039); aquí codificamos el mismo resultado como estado base para
 * que tests/desarrollo reflejen la realidad: los modelos con re-evaluación
 * histórica FALLIDA NO pueden aparecer elegibles.
 */
export const DEFAULT_REQUALIFICATION_FLAGS: RequalificationFlag[] = [
  { providerId: 'ollama', modelId: 'llama3.2', capabilityId: 'chat_general', reasonRef: 'FAILED_REQUALIFICATION: torneo clínico 07.5A' },
  { providerId: 'ollama', modelId: 'llama3.2', capabilityId: 'nutrition_reasoning', reasonRef: 'FAILED_REQUALIFICATION: torneo clínico 07.5A' },
  { providerId: 'openai', modelId: 'gpt-4o-mini', capabilityId: 'chat_general', reasonRef: 'FAILED_REQUALIFICATION: re-evaluación histórica 07.5A (4/8)' },
  { providerId: 'openai', modelId: 'gpt-4o-mini', capabilityId: 'structured_json', reasonRef: 'FAILED_REQUALIFICATION: re-evaluación histórica 07.5A (4/8)' },
  { providerId: 'openai', modelId: 'gpt-4o-mini', capabilityId: 'nutrition_reasoning', reasonRef: 'FAILED_REQUALIFICATION: re-evaluación histórica 07.5A (4/8)' },
];

export class ClinicalCertificationRegistry {
  private readonly records = new Map<string, ClinicalCertificationRecord>();
  private readonly requalificationFlags = new Set<string>();

  constructor(
    seed: ClinicalCertificationRecord[] = RECORD_SEEDS,
    requalificationFlags: readonly RequalificationFlag[] = DEFAULT_REQUALIFICATION_FLAGS,
  ) {
    for (const record of seed) this.register(record);
    for (const flag of requalificationFlags) {
      this.markRequalificationRequired(flag.providerId, flag.modelId, flag.capabilityId);
    }
  }

  register(record: ClinicalCertificationRecord): void {
    this.records.set(record.certificationId, record);
  }

  list(): ClinicalCertificationRecord[] {
    return Array.from(this.records.values());
  }

  get(certificationId: string): ClinicalCertificationRecord | undefined {
    return this.records.get(certificationId);
  }

  /** Reemplaza TODO el estado por el persistido en BD (Build 09.5A §56). */
  replaceAll(records: ClinicalCertificationRecord[], requalificationFlags: readonly RequalificationFlag[]): void {
    this.records.clear();
    this.requalificationFlags.clear();
    for (const record of records) this.register(record);
    for (const flag of requalificationFlags) {
      this.markRequalificationRequired(flag.providerId, flag.modelId, flag.capabilityId);
    }
  }

  markRequalificationRequired(providerId: string, modelId: string, capabilityId: AIModelCapability): void {
    this.requalificationFlags.add(`${providerId}/${modelId}/${capabilityId}`);
  }

  clearRequalificationRequired(providerId: string, modelId: string, capabilityId: AIModelCapability): void {
    this.requalificationFlags.delete(`${providerId}/${modelId}/${capabilityId}`);
  }

  listRequalificationFlags(): RequalificationFlag[] {
    return Array.from(this.requalificationFlags).map((key) => {
      const [providerId, modelId, capabilityId] = key.split('/');
      return { providerId: providerId!, modelId: modelId!, capabilityId: capabilityId! as AIModelCapability };
    });
  }

  isRequalificationFlagged(providerId: string, modelId: string, capabilityId: AIModelCapability): boolean {
    return this.requalificationFlags.has(`${providerId}/${modelId}/${capabilityId}`);
  }

  /**
   * Resuelve la certificación clínica EXACTA para la combinación completa.
   * Stale: cualquier componente de versión cambió → requalification; no se borra el registro histórico.
   */
  resolve(
    providerId: string,
    modelId: string,
    modelVersion: string,
    capabilityId: AIModelCapability,
    context: ResolveContext,
  ): CertificationResolution {
    const versions = context.versions ?? CURRENT_VERSIONS;

    let match: ClinicalCertificationRecord | undefined;
    for (const record of this.records.values()) {
      const key = record.key;
      if (key.providerId === providerId && key.modelId === modelId && key.capabilityId === capabilityId) {
        const keyFields = [
          ['modelVersion', key.modelVersion, modelVersion],
          ['promptVersion', key.promptVersion, versions.promptVersion[capabilityId]],
          ['toolsetVersion', key.toolsetVersion, versions.toolsetVersion],
          ['policyVersion', key.policyVersion, versions.policyVersion],
          ['outputSchemaVersion', key.outputSchemaVersion, versions.outputSchemaVersion[capabilityId]],
          ['knowledgePolicyVersion', key.knowledgePolicyVersion, versions.knowledgePolicyVersion],
          ['retrievalPolicyVersion', key.retrievalPolicyVersion, versions.retrievalPolicyVersion],
          ['smaeCatalogVersion', key.smaeCatalogVersion, versions.smaeCatalogVersion],
        ] as const;
        const mismatches = keyFields.filter(([, expected, actual]) => expected !== undefined && expected !== actual);
        if (mismatches.length === 0) {
          match = record;
          break;
        }
      }
    }

    if (!match) {
      return {
        eligible: false,
        stale: true,
        requalificationRequired: true,
        reason: `Sin certificación clínica exacta para ${providerId}/${modelId}@${modelVersion}/${capabilityId}`,
      };
    }

    // Build 09.5A §57: fingerprint de deployment distinto (o ausente cuando el
    // contexto lo exige) => la certificación NO se reutiliza => requalification.
    if (context.deploymentFingerprint !== undefined && match.key.deploymentFingerprint !== context.deploymentFingerprint) {
      return {
        eligible: false,
        state: match.state,
        certificationId: match.certificationId,
        stale: true,
        requalificationRequired: true,
        reason: `Deployment fingerprint distinto: certificación no reutilizable (esperado ${context.deploymentFingerprint})`,
      };
    }

    if (match.state === 'BLOCKED') {
      return {
        eligible: false,
        state: 'BLOCKED',
        certificationId: match.certificationId,
        stale: false,
        requalificationRequired: false,
        reason: `Modelo BLOCKED: nunca elegible (${match.certificationId})`,
      };
    }

    if (match.state === 'RESTRICTED') {
      const allowed = (match.restrictedCapabilities ?? []).includes(capabilityId);
      return {
        eligible: allowed,
        state: 'RESTRICTED',
        certificationId: match.certificationId,
        stale: false,
        requalificationRequired: false,
        reason: allowed ? undefined : `RESTRICTED no permite la capability '${capabilityId}'`,
      };
    }

    if (match.state === 'EXPERIMENTAL') {
      if (!context.allowExperimental) {
        return {
          eligible: false,
          state: 'EXPERIMENTAL',
          certificationId: match.certificationId,
          stale: false,
          requalificationRequired: false,
          reason: 'EXPERIMENTAL no es elegible en producción clínica',
        };
      }
    }

    const satisfied = stateSatisfies(match.state, context.requiredState, context.allowExperimental);
    const flagged = this.requalificationFlags.has(`${providerId}/${modelId}/${capabilityId}`);
    if (!satisfied || flagged) {
      return {
        eligible: false,
        state: match.state,
        certificationId: match.certificationId,
        stale: false,
        requalificationRequired: flagged,
        reason: flagged
          ? 'REQUALIFICATION_REQUIRED marcada por el operador'
          : `Estado ${match.state} no satisface el requisito ${context.requiredState}`,
      };
    }

    return {
      eligible: true,
      state: match.state,
      certificationId: match.certificationId,
      stale: false,
      requalificationRequired: false,
    };
  }
}

export const clinicalCertificationRegistry = new ClinicalCertificationRegistry();