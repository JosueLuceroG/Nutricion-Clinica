import { describe, expect, it } from 'vitest';
import {
  approveVersion,
  buildDocumentVersion,
  chunkVersion,
  computeContentFingerprint,
  isVersionEligible,
  markDeleted,
  markExpired,
  revokeVersion,
  supersedeVersion,
  uuidFromString,
  InMemoryKnowledgeVersionStore,
  type KnowledgeDocumentVersion,
} from './knowledgeVersioning.js';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function draft(overrides: Partial<Parameters<typeof buildDocumentVersion>[0]> = {}): KnowledgeDocumentVersion {
  return buildDocumentVersion({
    documentId: '30000000-0000-0000-0000-000000000001',
    version: 1,
    title: 'Protocolo manejo nutricional hipertension',
    category: 'hipertension',
    tier: 'institutional_protocol',
    content: 'Reducir sodio y sal, priorizar hidratacion y fibra.',
    sourceIssuer: 'NutriClinica Comite',
    allowedRoles: ['nutriologa', 'admin'],
    now: NOW,
    ...overrides,
  });
}

describe('buildDocumentVersion + fingerprints', () => {
  it('genera fingerprint determinista y distinto por contenido', () => {
    expect(computeContentFingerprint('a')).toBe(computeContentFingerprint('a'));
    expect(computeContentFingerprint('a')).not.toBe(computeContentFingerprint('b'));
  });

  it('uuidFromString es determinista y compatible con UNIQUEIDENTIFIER', () => {
    const a = uuidFromString('doc:v1:c0');
    expect(a).toBe(uuidFromString('doc:v1:c0'));
    expect(a).not.toBe(uuidFromString('doc:v1:c1'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('chunkVersion parte contenido largo por espacio y conserva fingerprint', () => {
    const doc = draft({ content: `${'palabra '.repeat(300).trim()}` });
    const chunks = chunkVersion(doc, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(100);
    expect(chunks[0].contentFingerprint).toBe(computeContentFingerprint(chunks[0].content));
    expect(new Set(chunks.map((c) => c.id)).size).toBe(chunks.length);
  });
});

describe('ciclo de vida de versiones', () => {
  it('aprueba y fija vigencia; estado DRAFT no es elegible', () => {
    const doc = draft();
    expect(isVersionEligible(doc, { now: NOW, role: 'nutriologa', sucursalId: null })).toBe(false);
    const approved = approveVersion(doc, { byRef: 'admin-1', now: NOW });
    expect(approved.status).toBe('APPROVED');
    expect(isVersionEligible(approved, { now: NOW, role: 'nutriologa', sucursalId: null })).toBe(true);
  });

  it('supersede/revoke/expire/deleted bloquean la elegibilidad', () => {
    const approved = approveVersion(draft(), { byRef: 'admin-1', now: NOW });
    expect(isVersionEligible(supersedeVersion(approved, 'admin-1', NOW), { now: NOW, role: 'nutriologa', sucursalId: null })).toBe(false);
    expect(isVersionEligible(revokeVersion(approved, 'admin-1', NOW), { now: NOW, role: 'nutriologa', sucursalId: null })).toBe(false);
    expect(isVersionEligible(markExpired(approved, NOW), { now: NOW, role: 'nutriologa', sucursalId: null })).toBe(false);
    expect(isVersionEligible(markDeleted(approved, NOW), { now: NOW, role: 'nutriologa', sucursalId: null })).toBe(false);
  });

  it('revokeVersion registra revokedByRef y supersedeVersion registra supersededByRef', () => {
    const revoked = revokeVersion(approveVersion(draft(), { byRef: 'admin-1', now: NOW }), 'admin-2', NOW);
    expect(revoked.revokedByRef).toBe('admin-2');
    const superseded = supersedeVersion(approveVersion(draft(), { byRef: 'admin-1', now: NOW }), 'admin-3', NOW);
    expect(superseded.supersededByRef).toBe('admin-3');
  });

  it('bloquea vigencia futura lejana y vigencia invertida', () => {
    const doc = draft();
    expect(() => approveVersion(doc, { byRef: 'admin-1', now: NOW, effectiveFrom: new Date(NOW.getTime() + 2 * 60 * 1000) })).toThrow();
    expect(() => approveVersion(doc, { byRef: 'admin-1', now: NOW, effectiveFrom: NOW, effectiveTo: new Date(NOW.getTime() - DAY) })).toThrow();
  });
});

describe('InMemoryKnowledgeVersionStore', () => {
  it('persiste versiones y chunks; listEligible respeta estado y sucursal', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    const approved = approveVersion(draft(), { byRef: 'admin-1', now: NOW });
    await store.saveVersion(approved);
    await store.saveChunk(chunkVersion(approved, 900)[0]);
    const eligible = await store.listEligible({ sucursalId: null, now: NOW });
    expect(eligible.map((v) => v.version)).toEqual([1]);
    const versions = await store.listVersions(approved.documentId);
    expect(versions).toHaveLength(1);
    const chunks = await store.listChunks(approved.documentId, 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].documentVersion).toBe(1);
  });

  it('listEligible excluye versiones de otra sucursal', async () => {
    const store = new InMemoryKnowledgeVersionStore();
    const doc = approveVersion(draft({ sucursalScope: '40000000-0000-0000-0000-000000000001' }), { byRef: 'admin-1', now: NOW });
    await store.saveVersion(doc);
    expect(await store.listEligible({ sucursalId: '40000000-0000-0000-0000-000000000002', now: NOW })).toHaveLength(0);
    expect(await store.listEligible({ sucursalId: '40000000-0000-0000-0000-000000000001', now: NOW })).toHaveLength(1);
  });
});