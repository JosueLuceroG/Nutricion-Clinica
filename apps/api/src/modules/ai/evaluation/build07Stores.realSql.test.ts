import { describe, expect, it, beforeAll } from 'vitest';
import {
  approveVersion,
  buildDocumentVersion,
  chunkVersion,
  revokeVersion,
  supersedeVersion,
  SqlKnowledgeVersionStore,
  type KnowledgeDocumentVersion,
} from '../rag/knowledgeVersioning.js';
import { SqlConversationMemoryStore, buildConversationMemoryEntry } from '../memory/conversationMemory.js';
import { SqlUserPreferenceStore, buildUserPreference } from '../memory/userPreferenceMemory.js';
import { getPool } from '../../../db/connection.js';

const REAL_SQL = process.env.AI_REAL_SQL_TEST === '1';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const DOC = '30000000-0000-0000-0000-000000000001';
const SUCURSAL_A = '40000000-0000-0000-0000-000000000001';
const SUCURSAL_B = '40000000-0000-0000-0000-000000000002';
const USER_1 = '50000000-0000-0000-0000-000000000001';
const USER_2 = '50000000-0000-0000-0000-000000000002';
const PATIENT_A = '60000000-0000-0000-0000-000000000001';

function versionV1(): KnowledgeDocumentVersion {
  return buildDocumentVersion({
    documentId: DOC,
    version: 1,
    title: 'Protocolo hipertension v1 (SQL real)',
    category: 'hipertension',
    tier: 'institutional_protocol',
    content: 'Reducir sodio; vigencia 400 dias.',
    sourceIssuer: 'NutriClinica Comite',
    allowedRoles: ['nutriologa', 'admin'],
    now: new Date(NOW.getTime() - 400 * DAY),
  });
}

function versionV2(): KnowledgeDocumentVersion {
  return buildDocumentVersion({
    documentId: DOC,
    version: 2,
    title: 'Protocolo hipertension v2 (SQL real)',
    category: 'hipertension',
    tier: 'institutional_protocol',
    content: 'Limitar sodio, porciones equilibradas, hidratacion y fibra.',
    sourceIssuer: 'NutriClinica Comite',
    supersedesVersion: 1,
    allowedRoles: ['nutriologa', 'admin'],
    now: new Date(NOW.getTime() - 100 * DAY),
  });
}

describe.skipIf(!REAL_SQL)('Stores versionados Build 07 contra SQL Server real', () => {
  beforeAll(async () => {
    const pool = await getPool();
    await pool.request().query('DELETE FROM knowledge_chunks; DELETE FROM knowledge_doc_versions; DELETE FROM ai_conversation_memory; DELETE FROM ai_user_preferences;');
  });

  it('ciclo de vida completo de knowledge_doc_versions (draft → approved → superseded)', async () => {
    const store = new SqlKnowledgeVersionStore();
    const v1 = approveVersion(versionV1(), { byRef: 'admin-1', now: new Date(NOW.getTime() - 400 * DAY), effectiveFrom: new Date(NOW.getTime() - 400 * DAY), effectiveTo: new Date(NOW.getTime() - 100 * DAY) });
    const v2 = approveVersion(versionV2(), { byRef: 'admin-1', now: new Date(NOW.getTime() - 100 * DAY) });
    await store.saveVersion(v1);
    await store.saveVersion(v2);
    await store.saveVersion(supersedeVersion(v1, 'admin-1', new Date(NOW.getTime() - 100 * DAY)));
    await store.saveChunk(chunkVersion(v2, 900)[0]);

    const fetched = await store.getVersion(DOC, 2);
    expect(fetched?.status).toBe('APPROVED');
    expect(fetched?.contentFingerprint).toBe(v2.contentFingerprint);
    const versions = await store.listVersions(DOC);
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    expect(versions.find((v) => v.version === 1)?.status).toBe('SUPERSEDED');

    const eligible = await store.listEligible({ sucursalId: SUCURSAL_A, now: NOW });
    const current = eligible.find((v) => v.documentId === DOC);
    expect(current?.version).toBe(2);
    expect(eligible.some((v) => v.documentId === DOC && v.version === 1)).toBe(false);

    const chunks = await store.listChunks(DOC, 2);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].documentVersion).toBe(2);
  });

  it('revocar y expirar bloquea elegibilidad; borrado logico idem', async () => {
    const store = new SqlKnowledgeVersionStore();
    const revoked = approveVersion(
      buildDocumentVersion({ documentId: DOC, version: 10, title: 'Protocolo ayuno', category: 'ayuno', tier: 'institutional_protocol', content: 'Ayuno retirado.', allowedRoles: ['nutriologa', 'admin'], now: NOW }),
      { byRef: 'admin-1', now: NOW },
    );
    await store.saveVersion(revokeVersion(revoked, 'admin-2', NOW));
    const stored = await store.getVersion(DOC, 10);
    expect(stored?.status).toBe('REVOKED');
    expect(stored?.revokedByRef).toBe('admin-2');
    const eligible = await store.listEligible({ sucursalId: SUCURSAL_A, now: NOW });
    expect(eligible.some((v) => v.documentId === DOC && v.version === 10)).toBe(false);
  });

  it('aislamiento de sucursal en knowledge_doc_versions', async () => {
    const store = new SqlKnowledgeVersionStore();
    const docB = approveVersion(
      buildDocumentVersion({
        documentId: '30000000-0000-0000-0000-000000000002',
        version: 1,
        title: 'Protocolo sucursal B',
        category: 'hipertension',
        tier: 'institutional_protocol',
        content: 'Solo sucursal B.',
        sucursalScope: SUCURSAL_B,
        allowedRoles: ['nutriologa', 'admin'],
        now: NOW,
      }),
      { byRef: 'admin-1', now: NOW },
    );
    await store.saveVersion(docB);
    const inA = await store.listEligible({ sucursalId: SUCURSAL_A, now: NOW });
    expect(inA.some((v) => v.documentId === '30000000-0000-0000-0000-000000000002')).toBe(false);
    const inB = await store.listEligible({ sucursalId: SUCURSAL_B, now: NOW });
    expect(inB.some((v) => v.documentId === '30000000-0000-0000-0000-000000000002')).toBe(true);
  });

  it('ai_conversation_memory: aislamiento por usuario/paciente/sucursal + TTL + borrado', async () => {
    const store = new SqlConversationMemoryStore();
    const base = { userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, domain: 'nutricion', sensitivity: 'PHI' as const, turnCount: 3, now: NOW };
    await store.save(buildConversationMemoryEntry({ id: '70000000-0000-0000-0000-000000000001', conversationId: 'conv-1', summary: 'Resumen paciente A (USER_1)', ...base }));
    await store.save(buildConversationMemoryEntry({ id: '70000000-0000-0000-0000-000000000002', conversationId: 'conv-2', summary: 'Resumen de otro usuario', ...base, userId: USER_2 }));
    await store.save(buildConversationMemoryEntry({ id: '70000000-0000-0000-0000-000000000003', conversationId: 'conv-3', summary: 'Resumen paciente A sucursal B', ...base, sucursalId: SUCURSAL_B }));
    await store.save(buildConversationMemoryEntry({ id: '70000000-0000-0000-0000-000000000004', conversationId: 'conv-4', summary: 'Resumen vencido', ttlDays: 1, ...base }));
    await store.save({ ...buildConversationMemoryEntry({ id: '70000000-0000-0000-0000-000000000005', conversationId: 'conv-5', summary: 'Resumen borrado', ...base }), deletedAt: NOW.toISOString() });

    const mine = await store.list({ userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, now: NOW });
    expect(mine.map((e) => e.summary).sort()).toEqual(['Resumen paciente A (USER_1)', 'Resumen vencido']);
    const later = new Date(NOW.getTime() + 2 * DAY);
    expect(await store.purgeExpired(later)).toBe(1);
    expect(await store.delete('70000000-0000-0000-0000-000000000001')).toBe(true);
    const remaining = await store.list({ userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, now: later });
    expect(remaining.map((e) => e.summary)).toEqual([]);
  });

  it('ai_user_preferences: upsert real, lista, borrado y claves prohibidas', async () => {
    const store = new SqlUserPreferenceStore();
    await store.save(buildUserPreference({ prefKey: 'language', value: 'es', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW }));
    await store.save(buildUserPreference({ prefKey: 'language', value: 'en', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW }));
    await store.save(buildUserPreference({ prefKey: 'verbosity', value: 'concise', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW }));
    const lang = await store.get(USER_1, SUCURSAL_A, 'language');
    expect(lang?.value).toBe('en');
    const all = await store.list(USER_1, SUCURSAL_A);
    expect(all.map((p) => p.prefKey).sort()).toEqual(['language', 'verbosity']);
    expect(await store.get(USER_2, SUCURSAL_A, 'language')).toBeUndefined();
    expect(() => buildUserPreference({ prefKey: 'professional_review_disabled', value: true, userId: USER_1, sucursalId: SUCURSAL_A, now: NOW })).toThrow();
    expect(await store.delete(USER_1, SUCURSAL_A, 'language')).toBe(true);
    expect(await store.get(USER_1, SUCURSAL_A, 'language')).toBeUndefined();
  });
});