import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryKnowledgeVersionStore, type KnowledgeDocumentVersion } from '../modules/ai/rag/knowledgeVersioning.js';
import { buildGoldenKnowledge, GOLDEN_NOW, RETRIEVAL_GOLDEN_QUERIES, goldenSetFingerprint, FORBIDDEN_DOC_IDS, type GoldenRetrievalQuery } from '../modules/ai/rag/retrievalGoldenSetV2.js';
import { expandQueryTerms, MIN_RELEVANCE_SCORE, scoreVersionedDoc, type RetrievalEnvelope, type VersionedRetrievedChunk } from '../modules/ai/rag/versionedRetrieval.js';
import { computeRetrievalMetrics } from '../modules/ai/rag/retrievalMetrics.js';
import { RETRIEVAL_POLICY_VERSION, synonymPolicyFingerprint } from '../modules/ai/rag/synonymExpansion.js';
import { tokenize } from '../modules/ai/rag/retrieval.js';

const REPORTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules', 'ai', 'evaluation', 'reports');

async function main(): Promise<void> {
  const store = new InMemoryKnowledgeVersionStore();
  const eligible = await buildGoldenKnowledge({ store });
  const topK = Number(process.env.RAG_EVAL_TOP_K ?? 4);

  const mode = process.env.RAG_BASELINE_MODE ?? 'v2';
  const useExpansion = mode === 'v1' ? false : true;

  const runs = RETRIEVAL_GOLDEN_QUERIES.map((query) => {
    const envelope = runQuery(query, eligible, topK, useExpansion);
    return { query, chunks: envelope.chunks };
  });

  const metrics = computeRetrievalMetrics({ runs, datasetVersion: goldenSetFingerprint(), topK, forbiddenDocIds: [...FORBIDDEN_DOC_IDS] });
  metrics.policyVersion = RETRIEVAL_POLICY_VERSION;
  metrics.policyFingerprint = synonymPolicyFingerprint();

  console.log(`Baseline de retrieval (${mode}): dataset ${goldenSetFingerprint()}`);
  console.log(`Recall@${topK}=${metrics.recallAtK} HitRate@${topK}=${metrics.hitRateAtK} MRR=${metrics.mrr}`);
  console.log(`unauthorized=${metrics.unauthorizedRetrievalRate} revoked=${metrics.revokedDocumentRetrievalRate} noAnswer=${metrics.noAnswerCorrectness}`);
  for (const row of metrics.perQuery) {
    console.log(`  ${row.id} (${row.kind}): recall=${row.recall} hit=${row.hit} rank=${row.rank ?? '-'} noAnswerOk=${row.noAnswerOk}`);
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(join(REPORTS_DIR, `retrieval-baseline-${mode}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`Reporte: reports/retrieval-baseline-${mode}.json`);

  const failed = metrics.unauthorizedRetrievalRate > 0 || metrics.revokedDocumentRetrievalRate > 0 || metrics.noAnswerCorrectness < 1;
  process.exit(failed ? 1 : 0);
}

function runQuery(query: GoldenRetrievalQuery, eligible: KnowledgeDocumentVersion[], topK: number, useExpansion: boolean): RetrievalEnvelope {
  const versions = eligible;
  const queryTerms = tokenize(query.query);
  const expandedTerms = useExpansion ? expandQueryTerms(query.query) : queryTerms;
  const ranked = versions
    .map((version) => ({ version, score: scoreVersionedDoc(queryTerms, expandedTerms, version) }))
    .filter((entry) => entry.score > MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score || a.version.documentId.localeCompare(b.version.documentId) || b.version.version - a.version.version)
    .slice(0, topK);
  const retrievedAt = GOLDEN_NOW.toISOString();
  const chunks: VersionedRetrievedChunk[] = ranked.map(({ version, score }) => ({
    documentId: version.documentId,
    documentVersion: version.version,
    chunkId: `${version.documentId}:c0`,
    chunkIndex: 0,
    title: version.title,
    knowledgeTier: version.tier,
    tierLabel: version.tier,
    category: version.category,
    snippet: version.content.slice(0, 200),
    score: Math.round(score * 1000) / 1000,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    retrievedAt,
    contentFingerprint: version.contentFingerprint,
    citationValid: true,
  }));
  return { query: query.query, chunks, noAnswer: chunks.length === 0, policy: { version: RETRIEVAL_POLICY_VERSION, fingerprint: synonymPolicyFingerprint() }, candidateCount: versions.length, eligibleCount: versions.length };
}

main().catch((err) => {
  console.error('Fallo el baseline de retrieval:', err instanceof Error ? err.message : err);
  process.exit(1);
});