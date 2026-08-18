import { describe, expect, it } from 'vitest';
import { InMemoryKnowledgeVersionStore, type KnowledgeDocumentVersion } from './knowledgeVersioning.js';
import { retrieveVersioned, retrieveVersionedFromDocs } from './versionedRetrieval.js';
import { buildGoldenKnowledge, FORBIDDEN_DOC_IDS, GOLDEN_NOW, GOLDEN_UUIDS, RETRIEVAL_GOLDEN_QUERIES, goldenSetFingerprint } from './retrievalGoldenSetV2.js';
import { detectKnowledgeConflicts } from './knowledgeConflicts.js';
import { verifyVersionedCitations } from './citationContract.js';
import { computeRetrievalMetrics, type RetrievalRun } from './retrievalMetrics.js';
import { expandPhraseMatches, expandTerm, hasSynonymGroup, synonymPolicyFingerprint } from './synonymExpansion.js';

const ACTOR = { role: 'nutriologa' as const, sucursalId: GOLDEN_UUIDS.sucursalA };

async function goldenEligible(): Promise<KnowledgeDocumentVersion[]> {
  const store = new InMemoryKnowledgeVersionStore();
  return buildGoldenKnowledge({ store });
}

describe('synonymExpansion (retrieval-policy.v2)', () => {
  it('expande termino a sinonimos y detecta frases', () => {
    expect(expandTerm('hta')).toContain('hipertension');
    expect(hasSynonymGroup('imc')).toBe(true);
    expect(expandPhraseMatches('manejo de la presion arterial alta')).toContain('hipertension');
    expect(synonymPolicyFingerprint()).toMatch(/^retrieval-policy\.v2-fnv1a-[0-9a-f]{8}$/);
  });
});

describe('retrieveVersioned sobre el golden set', () => {
  it('ejecuta las 14 consultas con Recall y no-answer correctos y cero documentos prohibidos', async () => {
    const eligible = await goldenEligible();
    const runs: RetrievalRun[] = RETRIEVAL_GOLDEN_QUERIES.map((query) => {
      const envelope = retrieveVersionedFromDocs({ query: query.query, versions: eligible, topK: 4, now: GOLDEN_NOW, actor: ACTOR });
      return { query, chunks: envelope.chunks };
    });
    const metrics = computeRetrievalMetrics({ runs, datasetVersion: goldenSetFingerprint(), topK: 4, forbiddenDocIds: [...FORBIDDEN_DOC_IDS] });
    expect(metrics.recallAtK).toBe(1);
    expect(metrics.hitRateAtK).toBe(1);
    expect(metrics.unauthorizedRetrievalRate).toBe(0);
    expect(metrics.revokedDocumentRetrievalRate).toBe(0);
    expect(metrics.noAnswerCorrectness).toBe(1);
    for (const row of metrics.perQuery) {
      expect(row.recall, `${row.id} recall`).toBe(1);
      expect(row.securityOk, `${row.id} security`).toBe(true);
    }
  });

  it('nunca recupera expirados/revocados/no autorizados/envenenados ni borrados', async () => {
    const eligible = await goldenEligible();
    const allIds = new Set<string>();
    for (const query of RETRIEVAL_GOLDEN_QUERIES) {
      const envelope = retrieveVersionedFromDocs({ query: query.query, versions: eligible, topK: 10, now: GOLDEN_NOW, actor: ACTOR });
      for (const chunk of envelope.chunks) allIds.add(chunk.documentId.toLowerCase());
    }
    expect(allIds.has(GOLDEN_UUIDS.expiredDoc.toLowerCase())).toBe(false);
    expect(allIds.has(GOLDEN_UUIDS.revokedDoc.toLowerCase())).toBe(false);
    expect(allIds.has(GOLDEN_UUIDS.unauthorizedDoc.toLowerCase())).toBe(false);
    expect(allIds.has(GOLDEN_UUIDS.poisonedDoc.toLowerCase())).toBe(false);
  });

  it('no-answer explicito cuando no hay conocimiento relevante', async () => {
    const eligible = await goldenEligible();
    const envelope = retrieveVersionedFromDocs({ query: 'protocolo de quimioterapia pediatrica', versions: eligible, topK: 4, now: GOLDEN_NOW, actor: ACTOR });
    expect(envelope.noAnswer).toBe(true);
    expect(envelope.chunks).toHaveLength(0);
  });

  it('recupera la version vigente (v2) y no la superseded (v1)', async () => {
    const eligible = await goldenEligible();
    const envelope = retrieveVersionedFromDocs({ query: 'protocolo manejo nutricional hipertension', versions: eligible, topK: 10, now: GOLDEN_NOW, actor: ACTOR });
    const protocol = envelope.chunks.filter((c) => c.documentId === GOLDEN_UUIDS.protocolP);
    expect(protocol.map((c) => c.documentVersion)).toEqual([2]);
    expect(protocol[0].citationValid).toBe(true);
  });
});

describe('conflictos de conocimiento', () => {
  it('detecta fuentes aprobadas contradictorias sobre hipertension', async () => {
    const eligible = await goldenEligible();
    const envelope = retrieveVersionedFromDocs({ query: 'hipertension: limitar sodio o no', versions: eligible, topK: 10, now: GOLDEN_NOW, actor: ACTOR });
    const conflicts = detectKnowledgeConflicts(envelope.chunks);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].topic).toBe('hipertension');
    expect(conflicts[0].sources.map((s) => s.documentId).sort()).toEqual([GOLDEN_UUIDS.conflictDoc, GOLDEN_UUIDS.protocolP].sort());
  });
});

describe('contrato de citas versionado', () => {
  it('valida citas reales del contexto y rechaza citas inventadas', async () => {
    const eligible = await goldenEligible();
    const envelope = retrieveVersionedFromDocs({ query: 'protocolo manejo nutricional hipertension', versions: eligible, topK: 10, now: GOLDEN_NOW, actor: ACTOR });
    const real = envelope.chunks[0];
    const verification = verifyVersionedCitations({
      content: `Segun el protocolo oficial [${real.documentId}] se limita el sodio. [00000000-0000-0000-0000-000000000000]`,
      retrieved: envelope.chunks,
      now: GOLDEN_NOW,
    });
    expect(verification.ok).toBe(false);
    expect(verification.validCount).toBe(1);
    expect(verification.invalid).toEqual(['00000000-0000-0000-0000-000000000000']);
  });
});

describe('retrieveVersioned (store)', () => {
  it('usa listEligible del store y devuelve envelope con politica', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    await buildGoldenKnowledge({ store });
    const envelope = await retrieveVersioned({ store, query: 'protocolo manejo nutricional hipertension', topK: 4, now: GOLDEN_NOW, actor: ACTOR });
    expect(envelope.chunks.length).toBeGreaterThan(0);
    expect(envelope.policy.version).toBe('retrieval-policy.v2');
    expect(envelope.eligibleCount).toBe(envelope.candidateCount);
  });
});