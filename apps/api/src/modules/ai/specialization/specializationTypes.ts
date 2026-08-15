import type { AIModelCapability } from '../evaluation/capabilities.js';

export type SpecializationKind = 'fine_tuning' | 'lora' | 'distillation' | 'specialized_model' | 'predictive_analytics';
export type SpecializationStatus = 'blocked' | 'approved';
export type EvidenceKind = 'rag_recall' | 'model_pass_rate' | 'cost_per_completion';

export interface EvidenceCriterion {
  kind: EvidenceKind;
  comparison: 'lt' | 'gt';
  value: number;
  capability?: AIModelCapability;
}

export interface SpecializationGovernance {
  requiresPHI: boolean;
  legalReview: boolean;
  privacyReview: boolean;
  deidentification: boolean;
  retentionDays: number | null;
  professionalApproval: boolean;
}

export interface SpecializationCandidate {
  id: string;
  name: string;
  description: string;
  kind: SpecializationKind;
  dataSource: 'synthetic' | 'deidentified_clinic' | 'phi';
  governance: SpecializationGovernance;
  evidenceCriteria: EvidenceCriterion[];
}

export interface EvidenceSnapshot {
  ragRecall: number | null;
  passRates: Partial<Record<AIModelCapability, number>>;
  costPerCompletion: number | null;
}

export interface EvaluationVerdict {
  candidateId: string;
  status: SpecializationStatus;
  reasons: string[];
  evaluatedAt: string;
}

export interface SpecializationLedger {
  recordDecision(verdict: EvaluationVerdict): Promise<void>;
  latestDecision(candidateId: string): Promise<EvaluationVerdict | undefined>;
  listDecisions(): Promise<EvaluationVerdict[]>;
}