import type { KnowledgeDoc, KnowledgeDocStore } from './knowledgeGovernance.js';
import { retrieve } from './retrieval.js';
import type { Role } from '@nutriclinica/shared';

export const POISONING_MARKERS: readonly string[] = [
  'ignora las instrucciones',
  'ignore all previous instructions',
  'ignora tu prompt',
  'prompt injection',
  'eres un modelo de ia',
  'no mencionar las reglas de oro',
];

export interface PoisoningClassification {
  isPoisoningAttempt: boolean;
  suspicious: boolean;
  reason?: string;
}

export function classifyPoisoning(doc: KnowledgeDoc): PoisoningClassification {
  const marker = POISONING_MARKERS.find((markerText) => doc.content.toLowerCase().includes(markerText));
  if (!marker) return { isPoisoningAttempt: false, suspicious: false };
  if (doc.status !== 'approved') {
    return { isPoisoningAttempt: true, suspicious: true, reason: `Documento no aprobado con marcador de inyeccion: ${marker}` };
  }
  return { isPoisoningAttempt: false, suspicious: true, reason: `Documento aprobado con marcador de inyeccion: ${marker}` };
}

export interface PoisoningTestReport {
  passed: boolean;
  poisonedRetrieved: string[];
  benignRetrieved: string[];
}

export async function runPoisoningTests(input: {
  store: KnowledgeDocStore;
  benignDocs: KnowledgeDoc[];
  poisonedDocs: KnowledgeDoc[];
  query: string;
  actor: { role: Role; sucursalId: string };
  now?: Date;
}): Promise<PoisoningTestReport> {
  for (const doc of [...input.benignDocs, ...input.poisonedDocs]) {
    await input.store.save(doc);
  }
  const retrieved = await retrieve({
    store: input.store,
    query: input.query,
    now: input.now ?? new Date(),
    actor: input.actor,
  });
  const poisonedRetrieved = retrieved.filter((chunk) => input.poisonedDocs.some((doc) => doc.id === chunk.docId));
  const benignRetrieved = retrieved.filter((chunk) => input.benignDocs.some((doc) => doc.id === chunk.docId));
  return {
    passed: poisonedRetrieved.length === 0,
    poisonedRetrieved: poisonedRetrieved.map((chunk) => chunk.docId),
    benignRetrieved: benignRetrieved.map((chunk) => chunk.docId),
  };
}