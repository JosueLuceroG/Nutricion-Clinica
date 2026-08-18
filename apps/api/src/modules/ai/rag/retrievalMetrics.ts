import type { VersionedRetrievedChunk } from './versionedRetrieval.js';
import type { GoldenRetrievalQuery } from './retrievalGoldenSetV2.js';
import { CITATION_CONTRACT_VERSION } from './citationContract.js';
import { RETRIEVAL_POLICY_VERSION, synonymPolicyFingerprint } from './synonymExpansion.js';

export interface RetrievalMetricsReport {
  datasetVersion: string;
  policyVersion: string;
  policyFingerprint: string;
  queries: number;
  recallAtK: number;
  hitRateAtK: number;
  mrr: number;
  citationValidity: number;
  unauthorizedRetrievalRate: number;
  revokedDocumentRetrievalRate: number;
  noAnswerCorrectness: number;
  perQuery: Array<{ id: string; kind: string; recall: number; hit: boolean; rank: number | null; securityOk: boolean; noAnswerOk: boolean }>;
}

export interface RetrievalRun {
  query: GoldenRetrievalQuery;
  chunks: VersionedRetrievedChunk[];
}

export function computeRetrievalMetrics(input: { runs: RetrievalRun[]; datasetVersion: string; topK: number; forbiddenDocIds?: string[] }): RetrievalMetricsReport {
  const forbidden = new Set((input.forbiddenDocIds ?? []).map((id) => id.toLowerCase()));
  let recallSum = 0;
  let hitCount = 0;
  let mrrSum = 0;
  let noAnswerOkCount = 0;
  const perQuery = input.runs.map((run) => {
    const expected = new Set(run.query.expectedDocIds.map((id) => id.toLowerCase()));
    const topKChunks = run.chunks.slice(0, input.topK);
    const retrievedIds = topKChunks.map((c) => c.documentId.toLowerCase());
    const hits = retrievedIds.filter((id) => expected.has(id));
    const recall = expected.size === 0 ? 1 : hits.length / expected.size;
    const hit = expected.size === 0 ? topKChunks.length === 0 : hits.length > 0;
    const rank = (() => {
      for (let i = 0; i < retrievedIds.length; i += 1) {
        if (expected.has(retrievedIds[i])) return i + 1;
      }
      return null;
    })();
    const noAnswerOk = run.query.expectsNoAnswer ? topKChunks.length === 0 : true;
    noAnswerOkCount += noAnswerOk ? 1 : 0;
    const securityOk = topKChunks.every((chunk) => !forbidden.has(chunk.documentId.toLowerCase()));
    recallSum += recall;
    hitCount += hit ? 1 : 0;
    mrrSum += rank !== null ? 1 / rank : 0;
    return { id: run.query.id, kind: run.query.kind, recall: Math.round(recall * 1000) / 1000, hit, rank, securityOk, noAnswerOk };
  });

  const unauthorized = perQuery.filter((row) => !row.securityOk).length;
  const revokedRetrieved = perQuery.filter((row) => row.kind === 'revoked_only' && !row.securityOk).length;

  const n = input.runs.length;
  return {
    datasetVersion: input.datasetVersion,
    policyVersion: RETRIEVAL_POLICY_VERSION,
    policyFingerprint: synonymPolicyFingerprint(),
    queries: n,
    recallAtK: Math.round((recallSum / n) * 1000) / 1000,
    hitRateAtK: Math.round((hitCount / n) * 1000) / 1000,
    mrr: Math.round((mrrSum / n) * 1000) / 1000,
    citationValidity: Math.round(((n - unauthorized) / n) * 1000) / 1000,
    unauthorizedRetrievalRate: unauthorized / n,
    revokedDocumentRetrievalRate: revokedRetrieved / n,
    noAnswerCorrectness: Math.round((noAnswerOkCount / n) * 1000) / 1000,
    perQuery,
  };
}

export const RETRIEVAL_METRICS_VERSION = `retrieval-metrics.${CITATION_CONTRACT_VERSION}`;