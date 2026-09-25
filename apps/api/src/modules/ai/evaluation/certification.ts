import type { AIProviderId } from '../credentialProvider.js';
import type { AIModelCapability } from './capabilities.js';

export type CertificationStatus = 'certified' | 'qualified' | 'not_qualified';

export interface CapabilityCertification {
  capability: AIModelCapability;
  status: CertificationStatus;
  evaluatedAt: string;
  /** Fingerprint del golden dataset con el que se evaluo (congelado por version). */
  datasetFingerprint: string;
  reportRef: string;
}

export interface ModelQualification {
  certifications: Partial<Record<AIModelCapability, CapabilityCertification>>;
}

export function modelKey(provider: AIProviderId, model: string): string {
  return `${provider}/${model}`;
}

/** Fingerprint congelado del dataset v1 (regenerar con `pnpm --filter @nutriclinica/api ai:evaluate` al cambiar el dataset). */
export const GOLDEN_DATASET_V1_FINGERPRINT = 'nutrition-golden-v1-7390ccd7';

const SEED_QUALIFICATIONS: Record<string, ModelQualification> = {
  'openai/gpt-4o-mini': {
    certifications: {
      chat_general: { capability: 'chat_general', status: 'certified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'gpt-4o-mini-chat-general-v1.json' },
      structured_json: { capability: 'structured_json', status: 'certified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'gpt-4o-mini-structured-json-v1.json' },
      nutrition_reasoning: { capability: 'nutrition_reasoning', status: 'certified', evaluatedAt: '2026-08-14T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'gpt-4o-mini-nutrition-v1.json' },
    },
  },
  'openai/gpt-4o': {
    certifications: {
      chat_general: { capability: 'chat_general', status: 'certified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'gpt-4o-chat-general-v1.json' },
      structured_json: { capability: 'structured_json', status: 'certified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'gpt-4o-structured-json-v1.json' },
      nutrition_reasoning: { capability: 'nutrition_reasoning', status: 'qualified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: '' },
    },
  },
  'ollama/llama3.2': {
    certifications: {
      chat_general: { capability: 'chat_general', status: 'certified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'llama3.2-chat-general-v1.json' },
      structured_json: { capability: 'structured_json', status: 'not_qualified', evaluatedAt: '2026-08-13T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: '' },
      nutrition_reasoning: { capability: 'nutrition_reasoning', status: 'certified', evaluatedAt: '2026-08-14T00:00:00.000Z', datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT, reportRef: 'llama3.2-nutrition-v1.json' },
    },
  },
};

export class ModelQualificationRegistry {
  private readonly qualifications = new Map<string, ModelQualification>();

  constructor(seed: Record<string, ModelQualification> = SEED_QUALIFICATIONS) {
    for (const [key, qualification] of Object.entries(seed)) {
      this.qualifications.set(key, qualification);
    }
  }

  getCertification(key: string, capability: AIModelCapability): CapabilityCertification | undefined {
    return this.qualifications.get(key)?.certifications[capability];
  }

  isCertified(key: string, capability: AIModelCapability): boolean {
    return this.getCertification(key, capability)?.status === 'certified';
  }

  certify(key: string, certification: CapabilityCertification): void {
    const existing = this.qualifications.get(key) ?? { certifications: {} };
    existing.certifications[certification.capability] = certification;
    this.qualifications.set(key, existing);
  }

  /** La certificacion queda obsoleta si el golden dataset cambio desde la evaluacion. */
  isStale(key: string, capability: AIModelCapability, currentFingerprint: string): boolean {
    const certification = this.getCertification(key, capability);
    if (!certification) return true;
    return certification.status === 'certified' && certification.datasetFingerprint !== currentFingerprint;
  }
}

export const modelQualificationRegistry = new ModelQualificationRegistry();