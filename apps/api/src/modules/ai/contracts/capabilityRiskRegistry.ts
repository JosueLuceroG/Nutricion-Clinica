import type { ClinicalSourceType } from './sourceTypes.js';
import type { RiskLevel } from './riskModel.js';
import type { ReviewPolicy } from './humanReviewPolicy.js';
import type { CertificationState } from '../certification/certificationStates.js';
import type { AbstentionReasonCode } from './abstentionContract.js';

export interface CapabilityRiskEntry {
  capabilityId: string;
  baseRisk: RiskLevel;
  minimumModelCertification: CertificationState;
  humanReviewPolicy: ReviewPolicy;
  evidenceRequirements: {
    requiredEvidenceCount: number;
    requiredSourceTypes: ClinicalSourceType[];
  };
  abstentionRequirements: {
    abstainOnInsufficientEvidence: boolean;
    abstainOnMissingRequiredData: boolean;
    abstainOnContradictions: boolean;
    reasonCodes: AbstentionReasonCode[];
  };
}

const COMMON_REASON_CODES: AbstentionReasonCode[] = [
  'INSUFFICIENT_EVIDENCE',
  'MISSING_REQUIRED_DATA',
  'CONTRADICTORY_DATA',
  'MODEL_NOT_CERTIFIED',
];

interface Seed {
  capabilityId: string;
  baseRisk: RiskLevel;
  minimumModelCertification: CertificationState;
  requiredEvidenceCount: number;
  requiredSourceTypes: ClinicalSourceType[];
  humanReviewPolicy?: ReviewPolicy;
  abstain?: boolean;
}

const SEEDS: Seed[] = [
  { capabilityId: 'model_evaluation', baseRisk: 'RISK_0', minimumModelCertification: 'APPROVED_GENERAL', requiredEvidenceCount: 1, requiredSourceTypes: ['MODEL_INFERENCE'] },
  { capabilityId: 'generic_assistant', baseRisk: 'RISK_1', minimumModelCertification: 'APPROVED_GENERAL', requiredEvidenceCount: 1, requiredSourceTypes: ['ERP'] },
  { capabilityId: 'chat_general', baseRisk: 'RISK_1', minimumModelCertification: 'APPROVED_GENERAL', requiredEvidenceCount: 1, requiredSourceTypes: ['ERP'] },
  { capabilityId: 'patient_education', baseRisk: 'RISK_1', minimumModelCertification: 'APPROVED_GENERAL', requiredEvidenceCount: 1, requiredSourceTypes: ['RAG'] },
  { capabilityId: 'structured_json', baseRisk: 'RISK_2', minimumModelCertification: 'APPROVED_ANALYTICS', requiredEvidenceCount: 1, requiredSourceTypes: ['ERP'], humanReviewPolicy: 'capability_dependent', abstain: true },
  { capabilityId: 'dashboard_analytics', baseRisk: 'RISK_2', minimumModelCertification: 'APPROVED_ANALYTICS', requiredEvidenceCount: 1, requiredSourceTypes: ['ERP'], humanReviewPolicy: 'capability_dependent', abstain: true },
  { capabilityId: 'clinical_summary', baseRisk: 'RISK_2', minimumModelCertification: 'APPROVED_ANALYTICS', requiredEvidenceCount: 2, requiredSourceTypes: ['ERP', 'RAG'], humanReviewPolicy: 'capability_dependent', abstain: true },
  { capabilityId: 'patient_overview', baseRisk: 'RISK_2', minimumModelCertification: 'APPROVED_ANALYTICS', requiredEvidenceCount: 2, requiredSourceTypes: ['ERP'], humanReviewPolicy: 'capability_dependent', abstain: true },
  { capabilityId: 'nutrition_reasoning', baseRisk: 'RISK_3', minimumModelCertification: 'APPROVED_NUTRITION_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'CALCULATOR', 'RAG'], abstain: true },
  { capabilityId: 'lab_interpretation', baseRisk: 'RISK_3', minimumModelCertification: 'APPROVED_NUTRITION_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'RULE_ENGINE'], abstain: true },
  { capabilityId: 'clinical_notes_draft', baseRisk: 'RISK_3', minimumModelCertification: 'APPROVED_CLINICAL_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'RAG'], abstain: true },
  { capabilityId: 'patient_support', baseRisk: 'RISK_3', minimumModelCertification: 'APPROVED_PATIENT', requiredEvidenceCount: 3, requiredSourceTypes: ['RAG', 'ERP'], abstain: true },
  { capabilityId: 'meal_substitution', baseRisk: 'RISK_4', minimumModelCertification: 'APPROVED_NUTRITION_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'CALCULATOR'], abstain: true },
  { capabilityId: 'goal_suggestion', baseRisk: 'RISK_4', minimumModelCertification: 'APPROVED_NUTRITION_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'CALCULATOR'], abstain: true },
  { capabilityId: 'meal_plan_generation', baseRisk: 'RISK_4', minimumModelCertification: 'APPROVED_NUTRITION_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'CALCULATOR'], abstain: true },
  { capabilityId: 'meal_plan_authoring', baseRisk: 'RISK_4', minimumModelCertification: 'APPROVED_NUTRITION_SUPPORT', requiredEvidenceCount: 3, requiredSourceTypes: ['ERP', 'CALCULATOR'], abstain: true },
];

export class CapabilityRiskRegistry {
  private readonly entries = new Map<string, CapabilityRiskEntry>();

  constructor(seed: Seed[] = SEEDS) {
    for (const item of seed) this.register(item);
  }

  register(item: Seed): void {
    this.entries.set(item.capabilityId, {
      capabilityId: item.capabilityId,
      baseRisk: item.baseRisk,
      minimumModelCertification: item.minimumModelCertification,
      humanReviewPolicy: item.humanReviewPolicy ?? (item.baseRisk === 'RISK_0' ? 'not_required' : 'required'),
      evidenceRequirements: {
        requiredEvidenceCount: item.requiredEvidenceCount,
        requiredSourceTypes: item.requiredSourceTypes,
      },
      abstentionRequirements: {
        abstainOnInsufficientEvidence: item.abstain ?? true,
        abstainOnMissingRequiredData: item.abstain ?? true,
        abstainOnContradictions: item.abstain ?? true,
        reasonCodes: COMMON_REASON_CODES,
      },
    });
  }

  get(capabilityId: string): CapabilityRiskEntry | undefined {
    return this.entries.get(capabilityId);
  }

  /** Capability desconocida: DENY (fail-closed). */
  getOrDeny(capabilityId: string): CapabilityRiskEntry | undefined {
    return this.entries.get(capabilityId);
  }

  list(): CapabilityRiskEntry[] {
    return Array.from(this.entries.values());
  }
}

export const capabilityRiskRegistry = new CapabilityRiskRegistry();