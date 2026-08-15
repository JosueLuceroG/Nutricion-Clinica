import type { Role } from '@nutriclinica/shared';
import { isDocUsable, type KnowledgeDoc, type KnowledgeDocStore } from './knowledgeGovernance.js';

export interface RetrievedChunk {
  docId: string;
  title: string;
  tier: string;
  category: string;
  chunkIndex: number;
  snippet: string;
  score: number;
}

export function chunkContent(content: string, maxChars: number): string[] {
  const clean = content.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxChars) return [clean];
  const chunks: string[] = [];
  let remaining = clean;
  while (remaining.length > maxChars) {
    let cut = remaining.lastIndexOf(' ', maxChars);
    if (cut <= 0) cut = maxChars;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u00e0-\u00ff]+/).filter((t) => t.length > 1);
}

export function scoreDoc(queryTerms: string[], doc: KnowledgeDoc): number {
  if (queryTerms.length === 0) return 0;
  const title = tokenize(doc.title);
  const content = tokenize(doc.content);
  let score = 0;
  let matched = 0;
  for (const term of queryTerms) {
    if (title.includes(term)) {
      score += 3;
      matched += 1;
    } else if (content.includes(term)) {
      score += 1;
      matched += 1;
    }
  }
  return score + matched / (queryTerms.length * 10);
}

export function retrieveFromDocs(input: {
  query: string;
  docs: KnowledgeDoc[];
  topK?: number;
  maxChunkChars?: number;
}): RetrievedChunk[] {
  const topK = input.topK ?? 4;
  const maxChars = input.maxChunkChars ?? 900;
  const terms = tokenize(input.query);
  const ranked = input.docs
    .map((doc) => ({ doc, score: scoreDoc(terms, doc) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.id.localeCompare(b.doc.id))
    .slice(0, topK);
  return ranked.map(({ doc, score }) => {
    const chunks = chunkContent(doc.content, maxChars);
    const firstHit = chunks.findIndex((chunk) => terms.some((term) => chunk.toLowerCase().includes(term)));
    const chunkIndex = firstHit >= 0 ? firstHit : 0;
    return {
      docId: doc.id,
      title: doc.title,
      tier: doc.tier,
      category: doc.category,
      chunkIndex,
      snippet: chunks[chunkIndex] ?? doc.content.slice(0, maxChars),
      score: Math.round(score * 1000) / 1000,
    };
  });
}

export async function retrieve(input: {
  store: KnowledgeDocStore;
  query: string;
  topK?: number;
  now: Date;
  actor: { role: Role; sucursalId: string };
}): Promise<RetrievedChunk[]> {
  const docs = await input.store.list({ sucursalId: input.actor.sucursalId });
  const usable = docs.filter((doc) => isDocUsable(doc, { now: input.now, role: input.actor.role, sucursalId: input.actor.sucursalId }));
  return retrieveFromDocs({ query: input.query, docs: usable, topK: input.topK });
}