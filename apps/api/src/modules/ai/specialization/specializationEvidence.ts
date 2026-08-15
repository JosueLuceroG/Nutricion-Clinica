import { evaluateRetrieval } from '../rag/retrievalEvaluation.js';
import { buildGoldenDocs, RETRIEVAL_GOLDEN_QUERIES } from '../rag/retrievalGoldenSet.js';
import { estimateCost } from '../agents/agentBudget.js';
import type { AIModelCapability } from '../evaluation/capabilities.js';
import type { EvidenceSnapshot } from './specializationTypes.js';

export interface SpecializationEvidenceOptions {
  costModel?: string;
  costTokens?: { promptTokens: number; completionTokens: number };
}

export function collectRetrievalEvidence(): number {
  const report = evaluateRetrieval({
    queries: RETRIEVAL_GOLDEN_QUERIES,
    docs: buildGoldenDocs(),
  });
  return report.averageRecall;
}

export function collectCostEvidence(options: SpecializationEvidenceOptions = {}): number {
  const model = options.costModel ?? 'gpt-4o-mini';
  const tokens = options.costTokens ?? { promptTokens: 1000, completionTokens: 500 };
  return estimateCost(model, { ...tokens, totalTokens: tokens.promptTokens + tokens.completionTokens });
}

export function buildEvidenceSnapshot(
  passRates: Partial<Record<AIModelCapability, number>>,
  options: SpecializationEvidenceOptions = {},
): EvidenceSnapshot {
  return {
    ragRecall: collectRetrievalEvidence(),
    passRates,
    costPerCompletion: collectCostEvidence(options),
  };
}