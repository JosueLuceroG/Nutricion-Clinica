import type { CalculatorResult } from './calculators.js';
import type { PatientContext } from './contextBuilder.js';
import type { SafetyFlag } from './safetyEngine.js';
import type { CitationVerification } from '../rag/citationVerifier.js';
import type { RetrievedChunk } from '../rag/retrieval.js';
import type { MemoryEntry } from '../memory/memoryTypes.js';
import type { ClinicalClaim } from '../contracts/evidenceEnvelope.js';
import type { Contradiction } from '../contracts/contradictionDetection.js';
import type { MissingInfoItem } from '../contracts/missingInformation.js';
import type { ConfidenceCategory } from '../contracts/confidenceEngine.js';
import type { RiskLevel } from '../contracts/riskModel.js';
import type { AbstentionResult } from '../contracts/abstentionContract.js';

export type EvidenceSourceType = 'erp' | 'calculator' | 'golden_rule' | 'ai' | 'knowledge' | 'memory';

export interface EvidenceSource {
  type: EvidenceSourceType;
  ref: string;
  basis?: string;
  retrievedAt?: string;
  maxAgeMs?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface AiEvidence {
  provider: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason?: 'stop' | 'length' | 'error';
}

/** Contrato clínico (Build 05) anexo al envelope: riesgo, claims, confianza, abstención formal, revisión. */
export interface EvidenceEnvelopeClinical {
  capability: string;
  baseRisk: RiskLevel;
  effectiveRisk: RiskLevel;
  claims: ClinicalClaim[];
  confidence: ConfidenceCategory;
  missingInformation: MissingInfoItem[];
  contradictions: Contradiction[];
  requiresProfessionalReview: boolean;
  abstention?: AbstentionResult;
}

export interface EvidenceEnvelope {
  version: '1.0';
  generatedAt: string;
  patient: { pacienteId: string; sucursalId: string };
  sources: EvidenceSource[];
  calculators: CalculatorResult[];
  safetyFlags: SafetyFlag[];
  abstention?: { kind: string; reason: string };
  ai?: AiEvidence;
  citations?: CitationVerification;
  reviewRequired: boolean;
  clinical?: EvidenceEnvelopeClinical;
}

export function buildEnvelope(input: {
  ctx: PatientContext;
  calculators: CalculatorResult[];
  safetyFlags: SafetyFlag[];
  ai?: AiEvidence;
  abstention?: { kind: string; reason: string };
  knowledge?: RetrievedChunk[];
  memory?: MemoryEntry[];
  citations?: CitationVerification;
  reviewRequired: boolean;
  generatedAt?: Date;
  clinical?: EvidenceEnvelopeClinical;
}): EvidenceEnvelope {
  const sources: EvidenceSource[] = [];
  if (!input.ctx.profileMissing) {
    sources.push({ type: 'erp', ref: 'patient_profile', riskLevel: 'high' });
  }
  if (input.ctx.anthropometry) {
    sources.push({ type: 'erp', ref: 'anthropometry_tool', retrievedAt: input.ctx.anthropometry.measuredAt, riskLevel: 'high' });
  }
  if (input.ctx.activePlan) {
    sources.push({ type: 'erp', ref: 'meal_plan', riskLevel: 'medium' });
  }
  if (input.ctx.recentLabs.length > 0) {
    sources.push({ type: 'erp', ref: 'lab_results', riskLevel: 'high' });
  }
  if (input.ctx.adherence.length > 0) {
    sources.push({ type: 'erp', ref: 'adherence_summary', riskLevel: 'medium' });
  }
  if (input.ctx.recentConsultations.length > 0) {
    sources.push({ type: 'erp', ref: 'recent_consultations', riskLevel: 'high' });
  }
  for (const calc of input.calculators) {
    sources.push({ type: 'calculator', ref: calc.id, basis: calc.basis });
  }
  if (input.ai) {
    sources.push({ type: 'ai', ref: `${input.ai.provider}/${input.ai.model}` });
  }
  for (const chunk of input.knowledge ?? []) {
    sources.push({ type: 'knowledge', ref: chunk.docId, basis: chunk.title, retrievedAt: input.generatedAt?.toISOString() });
  }
  for (const entry of input.memory ?? []) {
    sources.push({ type: 'memory', ref: entry.id, basis: entry.source });
  }
  return {
    version: '1.0',
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    patient: { pacienteId: input.ctx.pacienteId, sucursalId: input.ctx.sucursalId },
    sources,
    calculators: input.calculators,
    safetyFlags: input.safetyFlags,
    abstention: input.abstention,
    ai: input.ai,
    citations: input.citations,
    reviewRequired: input.reviewRequired,
    clinical: input.clinical,
  };
}