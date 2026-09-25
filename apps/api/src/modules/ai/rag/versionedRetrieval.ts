import type { Role } from '@nutriclinica/shared';
import {
  chunkVersion,
  isVersionEligible,
  type KnowledgeDocumentVersion,
  type KnowledgeVersionStore,
} from './knowledgeVersioning.js';
import { chunkContent, tokenize } from './retrieval.js';
import { expandPhraseMatches, expandTerms, RETRIEVAL_POLICY_VERSION, synonymPolicyFingerprint } from './synonymExpansion.js';
import { emitTelemetry } from '../../observability/telemetryService.js';

export const RETRIEVED_CHUNK_VERSION = 'retrieved-chunk.v1';

/**
 * Umbral de relevancia lexica: solo cuentan como relevantes los documentos con
 * al menos un match a nivel titulo (score >= 3) o varios matches de contenido.
 * Evita que un unico termino debil dispare DOCUMENTED_GUIDANCE.
 */
export const MIN_RELEVANCE_SCORE = 3;

/** Terminos genericos que no aportan relevancia (no suman score ni matched). */
export const STOP_TERMS: ReadonlySet<string> = new Set([
  'protocolo', 'guia', 'guia', 'material', 'manejo', 'manejar', 'nutricional', 'dieta',
  'v1', 'v2', 'vigente', 'exclusivo', 'sucursal', 'de', 'la', 'el', 'los', 'las', 'y',
  'o', 'no', 'con', 'para', 'como', 'pacientes', 'b',
]);

export interface VersionedRetrievedChunk {
  documentId: string;
  documentVersion: number;
  chunkId: string;
  chunkIndex: number;
  title: string;
  knowledgeTier: string;
  tierLabel: string;
  category: string;
  snippet: string;
  score: number;
  effectiveFrom: string;
  effectiveTo?: string;
  retrievedAt: string;
  contentFingerprint: string;
  citationValid: boolean;
}

export interface RetrievalEnvelope {
  query: string;
  chunks: VersionedRetrievedChunk[];
  noAnswer: boolean;
  policy: { version: string; fingerprint: string };
  candidateCount: number;
  eligibleCount: number;
}

/** Devuelve las versiones elegibles y marca como SUPERSEDED las anteriores aprobadas al aprobar una nueva. */
export async function publishApprovedVersion(input: {
  store: KnowledgeVersionStore;
  version: KnowledgeDocumentVersion;
  by: string;
  now: Date;
}): Promise<{ published: KnowledgeDocumentVersion; superseded: string[] }> {
  const existing = await input.store.listVersions(input.version.documentId);
  const superseded: string[] = [];
  for (const old of existing) {
    if (old.status === 'APPROVED' && old.version < input.version.version && old.deletedAt === undefined) {
      await input.store.saveVersion({ ...old, status: 'SUPERSEDED', updatedAt: input.now.toISOString() });
      superseded.push(`${old.documentId}:v${old.version}`);
    }
  }
  await input.store.saveVersion(input.version);
  return { published: input.version, superseded };
}

export function scoreVersionedDoc(queryTerms: string[], expandedTerms: string[], doc: KnowledgeDocumentVersion): number {
  if (queryTerms.length === 0) return 0;
  const title = tokenize(doc.title);
  const content = tokenize(doc.content);
  const specific = expandedTerms.filter((term) => !STOP_TERMS.has(term));
  const nonStopQuery = queryTerms.filter((term) => !STOP_TERMS.has(term));
  if (specific.length === 0 || nonStopQuery.length === 0) return 0;
  let score = 0;
  let matched = 0;
  for (const term of specific) {
    if (title.includes(term)) {
      score += 3;
      matched += 1;
    } else if (content.includes(term)) {
      score += 1;
      matched += 1;
    }
  }
  const originalMatched = nonStopQuery.filter((term) => title.includes(term) || content.includes(term)).length;
  const ratio = matched / (specific.length * 10) + originalMatched / (nonStopQuery.length * 10);
  return score + ratio;
}

export function expandQueryTerms(query: string): string[] {
  const queryTerms = tokenize(query);
  return [...expandTerms(queryTerms), ...expandPhraseMatches(query)];
}

export function retrieveVersionedFromDocs(input: {
  query: string;
  versions: KnowledgeDocumentVersion[];
  topK?: number;
  maxChunkChars?: number;
  now: Date;
  actor: { role: Role; sucursalId: string };
}): RetrievalEnvelope {
  const topK = input.topK ?? 4;
  const maxChars = input.maxChunkChars ?? 900;
  const queryTerms = tokenize(input.query);
  const expandedTerms = expandQueryTerms(input.query);
  const eligible = input.versions.filter((v) => isVersionEligible(v, { now: input.now, role: input.actor.role, sucursalId: input.actor.sucursalId }));
  const ranked = eligible
    .map((version) => ({ version, score: scoreVersionedDoc(queryTerms, expandedTerms, version) }))
    .filter((entry) => entry.score > MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score || a.version.documentId.localeCompare(b.version.documentId) || b.version.version - a.version.version)
    .slice(0, topK);
  const retrievedAt = input.now.toISOString();
  const chunks = ranked.map(({ version, score }) => {
    const pieces = chunkVersion(version, maxChars);
    const firstHit = pieces.findIndex((chunk) => expandedTerms.some((term) => chunk.content.toLowerCase().includes(term)));
    const chunkIndex = firstHit >= 0 ? firstHit : 0;
    const chunk = pieces[chunkIndex] ?? pieces[0];
    return {
      documentId: version.documentId,
      documentVersion: version.version,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      title: version.title,
      knowledgeTier: version.tier,
      tierLabel: version.tier,
      category: version.category,
      snippet: chunk.content,
      score: Math.round(score * 1000) / 1000,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      retrievedAt,
      contentFingerprint: chunk.contentFingerprint,
      citationValid: true,
    };
  });
  return {
    query: input.query,
    chunks,
    noAnswer: chunks.length === 0,
    policy: { version: RETRIEVAL_POLICY_VERSION, fingerprint: synonymPolicyFingerprint() },
    candidateCount: input.versions.length,
    eligibleCount: eligible.length,
  };
}

export async function retrieveVersioned(input: {
  store: KnowledgeVersionStore;
  query: string;
  topK?: number;
  now: Date;
  actor: { role: Role; sucursalId: string };
}): Promise<RetrievalEnvelope> {
  const eligible = await input.store.listEligible({ sucursalId: input.actor.sucursalId, now: input.now });
  const envelope = retrieveVersionedFromDocs({
    query: input.query,
    versions: eligible,
    topK: input.topK,
    now: input.now,
    actor: input.actor,
  });
  emitTelemetry({
    eventType: 'rag.retrieval',
    executionId: `retrieval-${Date.now()}-${Math.floor(Math.random() * 0xffff).toString(16)}`,
    retrievalId: `retrieval-${Date.now()}-${Math.floor(Math.random() * 0xffff).toString(16)}`,
    status: envelope.noAnswer ? 'no_answer' : 'found',
    capability: 'knowledge',
    counts: {
      candidate: envelope.candidateCount,
      eligible: envelope.eligibleCount,
      returned: envelope.chunks.length,
    },
  });
  return envelope;
}

/** Chunk ids citables para el contrato de cita [documentId]. */
export function chunkToLegacySnippet(chunk: VersionedRetrievedChunk): string {
  return chunk.snippet;
}

export { chunkContent }; // re-export para compatibilidad de chunking

export function boundRetrievalContext(input: { chunks: VersionedRetrievedChunk[]; maxChunks?: number; maxCharsPerChunk?: number }): VersionedRetrievedChunk[] {
  const maxChunks = input.maxChunks ?? 10;
  const maxChars = input.maxCharsPerChunk ?? 900;
  return input.chunks.slice(0, maxChunks).map((chunk) => ({ ...chunk, snippet: chunk.snippet.slice(0, maxChars) }));
}