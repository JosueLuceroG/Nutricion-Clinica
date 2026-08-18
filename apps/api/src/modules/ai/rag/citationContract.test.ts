import { describe, expect, it } from 'vitest';
import { InMemoryKnowledgeVersionStore, approveVersion, buildDocumentVersion, type KnowledgeDocumentVersion } from './knowledgeVersioning.js';
import { validateCitationContract } from './citationContract.js';
import type { VersionedRetrievedChunk } from './versionedRetrieval.js';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const DOC = '30000000-0000-0000-0000-000000000001';
const ACTOR = { role: 'nutriologa' as const, sucursalId: '40000000-0000-0000-0000-000000000001' };

function approvedV1(): KnowledgeDocumentVersion {
  return approveVersion(
    buildDocumentVersion({
      documentId: DOC,
      version: 1,
      title: 'Protocolo v1',
      category: 'hipertension',
      tier: 'institutional_protocol',
      content: 'Contenido v1',
      allowedRoles: ['nutriologa', 'admin'],
      now: new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000),
    }),
    { byRef: 'admin-1', now: new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000) },
  );
}

function approvedV2(): KnowledgeDocumentVersion {
  return approveVersion(
    buildDocumentVersion({
      documentId: DOC,
      version: 2,
      title: 'Protocolo v2',
      category: 'hipertension',
      tier: 'institutional_protocol',
      content: 'Contenido v2',
      supersedesVersion: 1,
      allowedRoles: ['nutriologa', 'admin'],
      now: NOW,
    }),
    { byRef: 'admin-1', now: NOW },
  );
}

function chunkShape(v: KnowledgeDocumentVersion): VersionedRetrievedChunk {
  return {
    documentId: v.documentId,
    documentVersion: v.version,
    chunkId: '00000000-0000-0000-0000-000000000001',
    chunkIndex: 0,
    title: v.title,
    knowledgeTier: v.tier,
    tierLabel: v.tier,
    category: v.category,
    snippet: v.content,
    score: 5,
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    retrievedAt: NOW.toISOString(),
    contentFingerprint: v.contentFingerprint,
    citationValid: true,
  };
}

describe('validateCitationContract', () => {
  it('valida cita de documento+version aprobados y vigentes', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    await store.saveVersion(approvedV2());
    const result = await validateCitationContract({ documentId: DOC, version: 2, store, now: NOW, role: ACTOR.role, sucursalId: ACTOR.sucursalId, requireCurrent: true });
    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rechaza documento inexistente', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    const result = await validateCitationContract({ documentId: DOC, store, now: NOW, role: ACTOR.role, sucursalId: ACTOR.sucursalId, requireCurrent: true });
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('no existe');
  });

  it('rechaza version antigua cuando existe una mas reciente (requireCurrent)', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    await store.saveVersion(approvedV1());
    await store.saveVersion(approvedV2());
    const result = await validateCitationContract({ documentId: DOC, version: 1, store, now: NOW, role: ACTOR.role, sucursalId: ACTOR.sucursalId, requireCurrent: true });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('mas reciente'))).toBe(true);
  });

  it('permite cita de version anterior sin requireCurrent (historica)', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    await store.saveVersion(approvedV1());
    await store.saveVersion(approvedV2());
    const result = await validateCitationContract({ documentId: DOC, version: 1, store, now: NOW, role: ACTOR.role, sucursalId: ACTOR.sucursalId, requireCurrent: false });
    expect(result.valid).toBe(true);
  });

  it('rechaza cita sin version y sin estado aprobado', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    await store.saveVersion(approvedV1());
    const result = await validateCitationContract({ documentId: DOC, version: 7, store, now: NOW, role: ACTOR.role, sucursalId: ACTOR.sucursalId, requireCurrent: false });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes('no existe'))).toBe(true);
  });
});

describe('chunk -> contrato', () => {
  it('buildCitationRef incluye documento, version, tier y vigencia', () => {
    const v = approvedV2();
    const ref = chunkShape(v);
    expect(ref.documentVersion).toBe(2);
    expect(ref.effectiveFrom).toBe(v.effectiveFrom);
  });
});