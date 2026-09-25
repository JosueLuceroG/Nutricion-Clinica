import { describe, expect, it } from 'vitest';
import { chunkContent, retrieve, retrieveFromDocs, scoreDoc, tokenize } from './retrieval.js';
import { InMemoryKnowledgeDocStore, type KnowledgeDoc } from './knowledgeGovernance.js';
import type { Role } from '@nutriclinica/shared';

const now = new Date('2026-08-14T00:00:00.000Z');

function doc(overrides: Partial<KnowledgeDoc>): KnowledgeDoc {
  return {
    id: 'doc-1',
    sucursalId: null,
    title: 'Guia de hidratacion',
    category: 'hidratacion',
    tier: 'clinical_guideline',
    content: 'La hidratacion diaria recomendada es de 30 ml por kilogramo de peso.',
    status: 'approved',
    allowedRoles: ['nutriologa', 'admin'],
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumeric characters', () => {
    expect(tokenize('Hidratacion, agua 30 ml!')).toEqual(['hidratacion', 'agua', '30', 'ml']);
  });
});

describe('chunkContent', () => {
  it('returns a single chunk for short content', () => {
    expect(chunkContent('hola mundo', 100)).toEqual(['hola mundo']);
  });

  it('splits long content at word boundaries', () => {
    const content = Array.from({ length: 40 }, (_, i) => `palabra${i}`).join(' ');
    const chunks = chunkContent(content, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe(content);
  });
});

describe('scoreDoc', () => {
  it('scores title matches higher than content matches', () => {
    const titleOnly = scoreDoc(['hidratacion'], doc({}));
    const contentOnly = scoreDoc(['kilogramo'], doc({}));
    expect(titleOnly).toBeGreaterThan(contentOnly);
  });

  it('returns zero when nothing matches', () => {
    expect(scoreDoc(['zzzz'], doc({}))).toBe(0);
  });
});

describe('retrieveFromDocs', () => {
  const docs = [
    doc({ id: 'a', title: 'Guia de hidratacion', content: '30 ml por kilogramo. El agua es esencial.' }),
    doc({ id: 'b', title: 'Proteina en adultos', content: '0.8 a 1.2 g por kilogramo de proteina.' }),
    doc({ id: 'c', title: 'Fibra', content: 'Frutas y verduras.' }),
  ];

  it('ranks docs by relevance and returns chunks with source metadata', () => {
    const result = retrieveFromDocs({ query: 'hidratacion agua', docs, topK: 2 });
    expect(result.map((r) => r.docId)).toEqual(['a']);
    expect(result[0]).toMatchObject({ tier: 'clinical_guideline', chunkIndex: 0 });
    expect(result[0]?.snippet).toContain('agua');
    expect(result[0]?.score).toBeGreaterThan(0);
  });

  it('respects topK', () => {
    const result = retrieveFromDocs({ query: 'kilogramo', docs, topK: 1 });
    expect(result).toHaveLength(1);
  });

  it('returns an empty list when nothing matches', () => {
    expect(retrieveFromDocs({ query: 'zzzz', docs })).toEqual([]);
  });

  it('breaks ties deterministically by doc id', () => {
    const tied = [doc({ id: 'b', title: 'X hidratacion' }), doc({ id: 'a', title: 'X hidratacion' })];
    const result = retrieveFromDocs({ query: 'hidratacion', docs: tied, topK: 2 });
    expect(result.map((r) => r.docId)).toEqual(['a', 'b']);
  });
});

describe('retrieve', () => {
  it('filters by usability before scoring', async () => {
    const store = new InMemoryKnowledgeDocStore();
    await store.save(doc({ id: 'ok', title: 'Hidratacion guia' }));
    await store.save(doc({ id: 'draft', title: 'Hidratacion borrador', status: 'draft' }));
    await store.save(doc({ id: 'acl', title: 'Hidratacion admin', allowedRoles: ['admin'] }));
    await store.save(doc({ id: 'unv', title: 'Hidratacion rumor', tier: 'unverified' }));

    const actor = { role: 'nutriologa' as Role, sucursalId: 's1' };
    const result = await retrieve({ store, query: 'hidratacion', now, actor });
    expect(result.map((r) => r.docId)).toEqual(['ok']);
  });

  it('includes global docs for any sucursal', async () => {
    const store = new InMemoryKnowledgeDocStore();
    await store.save(doc({ id: 'global', title: 'Hidratacion global' }));
    const result = await retrieve({ store, query: 'hidratacion', now, actor: { role: 'nutriologa', sucursalId: 's9' } });
    expect(result.map((r) => r.docId)).toEqual(['global']);
  });
});