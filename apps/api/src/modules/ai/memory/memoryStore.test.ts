import { describe, expect, it } from 'vitest';
import { buildMemoryEntry, type MemoryEntry } from './memoryTypes.js';
import { InMemoryMemoryStore } from './memoryStore.js';

const now = new Date('2026-08-14T00:00:00.000Z');

function entry(id: string, overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    ...buildMemoryEntry({
      id,
      pacienteId: 'pac-1',
      sucursalId: 'suc-1',
      actorId: 'prof-1',
      content: 'Prefiere consultas en la tarde',
      visibility: 'shared',
      source: 'professional_note',
      now,
      retentionDays: 90,
    }),
    ...overrides,
  };
}

describe('buildMemoryEntry', () => {
  it('computes expiration from retention days', () => {
    const built = buildMemoryEntry({
      id: 'e1',
      pacienteId: 'p',
      sucursalId: 's',
      actorId: 'a',
      content: 'x',
      visibility: 'shared',
      source: 'professional_note',
      now,
      retentionDays: 90,
    });
    expect(built.createdAt).toBe(now.toISOString());
    expect(new Date(built.expiresAt).getTime()).toBe(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  });
});

describe('InMemoryMemoryStore', () => {
  it('lists non-expired entries for the patient and sucursal', async () => {
    const store = new InMemoryMemoryStore();
    await store.save(entry('e1'));
    await store.save(entry('e2', { content: 'Otra nota' }));
    const list = await store.list({ pacienteId: 'pac-1', sucursalId: 'suc-1', actorId: 'prof-2', now });
    expect(list.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('isolates by patient and sucursal', async () => {
    const store = new InMemoryMemoryStore();
    await store.save(entry('e1'));
    await store.save(entry('e2', { pacienteId: 'pac-2' }));
    await store.save(entry('e3', { sucursalId: 'suc-2' }));
    const list = await store.list({ pacienteId: 'pac-1', sucursalId: 'suc-1', actorId: 'prof-2', now });
    expect(list.map((e) => e.id)).toEqual(['e1']);
  });

  it('hides expired entries and purges them', async () => {
    const store = new InMemoryMemoryStore();
    await store.save(entry('fresh'));
    await store.save(entry('stale', { expiresAt: '2026-01-01T00:00:00.000Z' }));
    const list = await store.list({ pacienteId: 'pac-1', sucursalId: 'suc-1', actorId: 'prof-2', now });
    expect(list.map((e) => e.id)).toEqual(['fresh']);
    expect(await store.purgeExpired(now)).toBe(1);
    expect(await store.get('stale')).toBeUndefined();
  });

  it('keeps private entries visible only to their author', async () => {
    const store = new InMemoryMemoryStore();
    await store.save(entry('mine', { visibility: 'private' }));
    const author = await store.list({ pacienteId: 'pac-1', sucursalId: 'suc-1', actorId: 'prof-1', now });
    const stranger = await store.list({ pacienteId: 'pac-1', sucursalId: 'suc-1', actorId: 'prof-2', now });
    expect(author.map((e) => e.id)).toEqual(['mine']);
    expect(stranger).toEqual([]);
  });

  it('deletes entries hard', async () => {
    const store = new InMemoryMemoryStore();
    await store.save(entry('e1'));
    expect(await store.delete('e1')).toBe(true);
    expect(await store.delete('e1')).toBe(false);
    expect(await store.get('e1')).toBeUndefined();
  });
});