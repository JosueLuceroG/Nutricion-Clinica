import type { KnowledgeDoc } from './knowledgeGovernance.js';
import type { RetrievalGoldenQuery } from './retrievalEvaluation.js';
import { retrieveFromDocs, type RetrievedChunk } from './retrieval.js';
import { verifyCitations } from './citationVerifier.js';

export interface GroundnessQueryResult {
  id: string;
  query: string;
  retrievedDocIds: string[];
  cited: string[];
  verified: string[];
  missing: string[];
  grounded: boolean;
}

export interface GroundnessReport {
  queries: GroundnessQueryResult[];
  groundedQueries: number;
  totalQueries: number;
  passed: boolean;
}

export async function evaluateGroundness(input: {
  queries: RetrievalGoldenQuery[];
  docs: KnowledgeDoc[];
  generate: (q: { query: string; retrieved: RetrievedChunk[] }) => Promise<string>;
  topK?: number;
}): Promise<GroundnessReport> {
  const queries: GroundnessQueryResult[] = [];
  for (const query of input.queries) {
    const retrieved = retrieveFromDocs({ query: query.query, docs: input.docs, topK: input.topK ?? 4 });
    const content = await input.generate({ query: query.query, retrieved });
    const verification = verifyCitations({ content, retrievedDocIds: retrieved.map((chunk) => chunk.docId) });
    queries.push({
      id: query.id,
      query: query.query,
      retrievedDocIds: retrieved.map((chunk) => chunk.docId),
      cited: verification.cited,
      verified: verification.verified,
      missing: verification.missing,
      grounded: verification.ok,
    });
  }
  const groundedQueries = queries.filter((q) => q.grounded).length;
  return {
    queries,
    groundedQueries,
    totalQueries: queries.length,
    passed: groundedQueries === queries.length,
  };
}