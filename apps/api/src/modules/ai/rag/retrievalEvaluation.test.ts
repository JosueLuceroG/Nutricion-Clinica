import { describe, expect, it } from 'vitest';
import { evaluateRetrieval } from './retrievalEvaluation.js';
import { buildGoldenDocs, RETRIEVAL_GOLDEN_QUERIES } from './retrievalGoldenSet.js';

describe('evaluateRetrieval', () => {
  it('passes the golden set with full recall', () => {
    const docs = buildGoldenDocs('nutriologa', true);
    const report = evaluateRetrieval({ queries: RETRIEVAL_GOLDEN_QUERIES, docs, topK: 4, threshold: 0.6 });
    expect(report.averageRecall).toBe(1);
    expect(report.passed).toBe(true);
    expect(report.queries.every((q) => q.missed.length === 0)).toBe(true);
  });

  it('reports recall and precision per query', () => {
    const docs = buildGoldenDocs('nutriologa', true);
    const report = evaluateRetrieval({ queries: [RETRIEVAL_GOLDEN_QUERIES[0]!], docs, topK: 4, threshold: 0.6 });
    expect(report.queries[0]?.recall).toBe(1);
    expect(report.queries[0]?.hits).toEqual([RETRIEVAL_GOLDEN_QUERIES[0]!.expectedDocIds[0]]);
  });

  it('fails when recall is below the threshold', () => {
    const docs = buildGoldenDocs('nutriologa', true);
    const badQuery = { id: 'q-none', query: 'zzzz inexistente', expectedDocIds: ['00000000-0000-4000-8000-000000000101'] };
    const report = evaluateRetrieval({ queries: [badQuery], docs, topK: 4, threshold: 0.6 });
    expect(report.queries[0]?.recall).toBe(0);
    expect(report.passed).toBe(false);
  });

  it('computes the average across queries', () => {
    const docs = buildGoldenDocs('nutriologa', true);
    const half = { id: 'q-half', query: 'hidratacion agua', expectedDocIds: ['00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000999'] };
    const report = evaluateRetrieval({ queries: [RETRIEVAL_GOLDEN_QUERIES[0]!, half], docs, topK: 4, threshold: 0.5 });
    expect(report.averageRecall).toBe(0.75);
    expect(report.passed).toBe(true);
  });

  it('keeps unverified tier docs out of the approved golden set', () => {
    const docs = buildGoldenDocs('nutriologa', true);
    const unverified = docs.find((d) => d.tier === 'unverified');
    expect(unverified?.status).toBe('draft');
  });
});