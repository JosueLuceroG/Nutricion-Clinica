import type { VersionedRetrievedChunk } from './versionedRetrieval.js';

export type ConflictSource = Pick<VersionedRetrievedChunk, 'documentId' | 'documentVersion' | 'knowledgeTier' | 'effectiveFrom' | 'title' | 'category' | 'contentFingerprint'>;

export interface KnowledgeConflict {
  topic: string;
  sources: Array<{ documentId: string; documentVersion: number; knowledgeTier: string; effectiveFrom: string; title: string }>;
  reason: string;
}

/**
 * Detecta documentos aprobados distintos sobre el mismo tema con guia distinta.
 * NO elige por score: expone la contradiccion para que la capacidad decida
 * (degradar confianza / ABSTAIN / revision profesional).
 */
export function detectKnowledgeConflicts(chunks: ConflictSource[]): KnowledgeConflict[] {
  const byTopic = new Map<string, ConflictSource[]>();
  for (const chunk of chunks) {
    const topic = chunk.category.trim().toLowerCase();
    const list = byTopic.get(topic) ?? [];
    list.push(chunk);
    byTopic.set(topic, list);
  }
  const conflicts: KnowledgeConflict[] = [];
  for (const [topic, group] of byTopic) {
    const distinctDocs = new Map<string, ConflictSource>();
    for (const chunk of group) {
      if (!distinctDocs.has(chunk.documentId)) distinctDocs.set(chunk.documentId, chunk);
    }
    if (distinctDocs.size < 2) continue;
    const docs = [...distinctDocs.values()];
    const fingerprints = new Set(docs.map((d) => d.contentFingerprint));
    if (fingerprints.size < 2) continue;
    conflicts.push({
      topic,
      sources: docs.map((d) => ({
        documentId: d.documentId,
        documentVersion: d.documentVersion,
        knowledgeTier: d.knowledgeTier,
        effectiveFrom: d.effectiveFrom,
        title: d.title,
      })),
      reason: `${docs.length} fuentes aprobadas distintas sobre "${topic}" con contenido diferente`,
    });
  }
  return conflicts;
}