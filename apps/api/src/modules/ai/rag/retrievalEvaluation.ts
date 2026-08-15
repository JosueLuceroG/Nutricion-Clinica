import type { KnowledgeDoc } from './knowledgeGovernance.js';
import { retrieveFromDocs } from './retrieval.js';

export interface RetrievalGoldenQuery {
  id: string;
  query: string;
  expectedDocIds: string[];
}

export interface RetrievalQueryResult {
  id: string;
  recall: number;
  precision: number;
  hits: string[];
  missed: string[];
}

export interface RetrievalEvaluationReport {
  queries: RetrievalQueryResult[];
  averageRecall: number;
  averagePrecision: number;
  threshold: number;
  passed: boolean;
}

export function evaluateRetrieval(input: {
  queries: RetrievalGoldenQuery[];
  docs: KnowledgeDoc[];
  topK?: number;
  threshold?: number;
}): RetrievalEvaluationReport {
  const topK = input.topK ?? 4;
  const threshold = input.threshold ?? 0.6;
  const queries: RetrievalQueryResult[] = input.queries.map((query) => {
    const retrieved = retrieveFromDocs({ query: query.query, docs: input.docs, topK });
    const retrievedIds = new Set(retrieved.map((chunk) => chunk.docId));
    const hits = query.expectedDocIds.filter((id) => retrievedIds.has(id));
    const missed = query.expectedDocIds.filter((id) => !retrievedIds.has(id));
    const recall = query.expectedDocIds.length > 0 ? hits.length / query.expectedDocIds.length : 0;
    const precision = retrieved.length > 0 ? hits.length / retrieved.length : 0;
    return {
      id: query.id,
      recall: Math.round(recall * 1000) / 1000,
      precision: Math.round(precision * 1000) / 1000,
      hits,
      missed,
    };
  });
  const averageRecall = queries.length > 0 ? queries.reduce((sum, q) => sum + q.recall, 0) / queries.length : 0;
  const averagePrecision = queries.length > 0 ? queries.reduce((sum, q) => sum + q.precision, 0) / queries.length : 0;
  return {
    queries,
    averageRecall: Math.round(averageRecall * 1000) / 1000,
    averagePrecision: Math.round(averagePrecision * 1000) / 1000,
    threshold,
    passed: averageRecall >= threshold,
  };
}