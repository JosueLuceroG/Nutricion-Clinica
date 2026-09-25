import { describe, expect, it } from 'vitest';
import { evaluateGroundness } from './groundedGeneration.js';
import { buildGoldenDocs, RETRIEVAL_GOLDEN_QUERIES } from './retrievalGoldenSet.js';
import type { RetrievedChunk } from './retrieval.js';

const DOC_101 = '00000000-0000-4000-8000-000000000101';

describe('evaluateGroundness', () => {
  const docs = buildGoldenDocs('nutriologa', true);

  it('passes when every citation is backed by the retrieved set', async () => {
    const report = await evaluateGroundness({
      queries: RETRIEVAL_GOLDEN_QUERIES,
      docs,
      generate: async ({ retrieved }) => retrieved.map((chunk) => `Segun [${chunk.docId}].`).join(' '),
    });
    expect(report.passed).toBe(true);
    expect(report.groundedQueries).toBe(report.totalQueries);
  });

  it('fails when the generator cites a doc outside the retrieved set', async () => {
    const report = await evaluateGroundness({
      queries: [RETRIEVAL_GOLDEN_QUERIES[0]!],
      docs,
      generate: async () => `Consejo [${DOC_101}] y tambien [00000000-0000-4000-8000-000000000999].`,
    });
    expect(report.passed).toBe(false);
    expect(report.queries[0]?.grounded).toBe(false);
    expect(report.queries[0]?.missing).toEqual(['00000000-0000-4000-8000-000000000999']);
  });

  it('passes when no citations are emitted', async () => {
    const report = await evaluateGroundness({
      queries: [RETRIEVAL_GOLDEN_QUERIES[0]!],
      docs,
      generate: async () => 'Recomendacion general.',
    });
    expect(report.passed).toBe(true);
    expect(report.queries[0]?.cited).toEqual([]);
    expect(report.queries[0]?.verified).toEqual([]);
  });

  it('reports the retrieved doc ids per query', async () => {
    const report = await evaluateGroundness({
      queries: [RETRIEVAL_GOLDEN_QUERIES[0]!],
      docs,
      generate: async (_q: { query: string; retrieved: RetrievedChunk[] }) => 'Recomendacion.',
    });
    expect(report.queries[0]?.retrievedDocIds).toContain(DOC_101);
    expect(report.queries[0]?.retrievedDocIds.length).toBeGreaterThan(0);
  });
});