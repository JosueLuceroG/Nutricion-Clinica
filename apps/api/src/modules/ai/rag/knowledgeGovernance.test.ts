import { describe, expect, it } from 'vitest';
import { approveDoc, InMemoryKnowledgeDocStore, isDocUsable, isTierUsableForClinical, TIER_RANK, type KnowledgeDoc } from './knowledgeGovernance.js';

const base: KnowledgeDoc = {
  id: 'doc-1',
  sucursalId: null,
  title: 'Guia de hidratacion',
  category: 'hidratacion',
  tier: 'clinical_guideline',
  content: '30 ml por kg.',
  status: 'approved',
  approvedBy: 'admin-1',
  approvedAt: '2026-08-01T00:00:00.000Z',
  allowedRoles: ['nutriologa', 'admin'],
  createdAt: '2026-07-01T00:00:00.000Z',
};

const now = new Date('2026-08-14T00:00:00.000Z');

describe('isTierUsableForClinical', () => {
  it('allows tiers at or above educational', () => {
    expect(isTierUsableForClinical('clinical_guideline')).toBe(true);
    expect(isTierUsableForClinical('institutional_protocol')).toBe(true);
    expect(isTierUsableForClinical('peer_reviewed')).toBe(true);
    expect(isTierUsableForClinical('educational')).toBe(true);
  });

  it('blocks unverified tiers from clinical use', () => {
    expect(isTierUsableForClinical('unverified')).toBe(false);
  });
});

describe('isDocUsable', () => {
  it('accepts an approved in-scope doc', () => {
    expect(isDocUsable(base, { now, role: 'nutriologa', sucursalId: 's1' })).toBe(true);
  });

  it('rejects drafts, revoked and expired docs', () => {
    expect(isDocUsable({ ...base, status: 'draft' }, { now, role: 'nutriologa', sucursalId: null })).toBe(false);
    expect(isDocUsable({ ...base, status: 'revoked' }, { now, role: 'nutriologa', sucursalId: null })).toBe(false);
    expect(isDocUsable({ ...base, expiresAt: '2026-01-01T00:00:00.000Z' }, { now, role: 'nutriologa', sucursalId: null })).toBe(false);
  });

  it('enforces the role ACL', () => {
    expect(isDocUsable(base, { now, role: 'asistente', sucursalId: null })).toBe(false);
  });

  it('restricts sucursal-scoped docs and allows global ones', () => {
    const scoped = { ...base, sucursalId: 's1' };
    expect(isDocUsable(scoped, { now, role: 'nutriologa', sucursalId: 's1' })).toBe(true);
    expect(isDocUsable(scoped, { now, role: 'nutriologa', sucursalId: 's2' })).toBe(false);
    expect(isDocUsable(base, { now, role: 'nutriologa', sucursalId: 's2' })).toBe(true);
  });

  it('blocks unverified tiers even when approved', () => {
    expect(isDocUsable({ ...base, tier: 'unverified' }, { now, role: 'nutriologa', sucursalId: null })).toBe(false);
  });
});

describe('approveDoc', () => {
  it('approves a draft with approver and timestamp', () => {
    const approved = approveDoc({ ...base, status: 'draft' }, { by: 'admin-2', now });
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('admin-2');
    expect(approved.approvedAt).toBe(now.toISOString());
  });

  it('rejects a past expiry date', () => {
    expect(() => approveDoc({ ...base, status: 'draft' }, { by: 'a', now, expiresAt: '2026-01-01T00:00:00.000Z' })).toThrow('La vigencia debe ser futura');
  });
});

describe('InMemoryKnowledgeDocStore', () => {
  it('saves, gets and lists with status filters', async () => {
    const store = new InMemoryKnowledgeDocStore();
    await store.save(base);
    await store.save({ ...base, id: 'doc-2', status: 'draft', sucursalId: 's1' });
    expect((await store.get('doc-1'))?.title).toBe('Guia de hidratacion');
    expect((await store.list({ sucursalId: null, status: 'approved' })).map((d) => d.id)).toEqual(['doc-1']);
    expect((await store.list({ sucursalId: 's1' })).map((d) => d.id).sort()).toEqual(['doc-1', 'doc-2']);
  });
});

describe('TIER_RANK', () => {
  it('orders tiers by evidence strength', () => {
    expect(TIER_RANK.clinical_guideline).toBeGreaterThan(TIER_RANK.institutional_protocol);
    expect(TIER_RANK.institutional_protocol).toBeGreaterThan(TIER_RANK.peer_reviewed);
    expect(TIER_RANK.peer_reviewed).toBeGreaterThan(TIER_RANK.educational);
    expect(TIER_RANK.educational).toBeGreaterThan(TIER_RANK.unverified);
  });
});