import { describe, expect, it } from 'vitest';
import {
  buildConversationMemoryEntry,
  CONVERSATION_MEMORY_POLICY,
  InMemoryConversationMemoryStore,
  isConversationMemoryWithinPolicy,
  renderConversationMemoryForEgress,
  type ConversationMemoryEntry,
} from './conversationMemory.js';
import { buildMemoryEntry } from './memoryTypes.js';
import { InMemoryMemoryStore } from './memoryStore.js';
import { buildUserPreference, InMemoryUserPreferenceStore, SAFE_PREFERENCE_KEYS, FORBIDDEN_PREFERENCE_KEYS, applyUserPreferences } from './userPreferenceMemory.js';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const PATIENT_A = '30000000-0000-0000-0000-000000000001';
const PATIENT_B = '30000000-0000-0000-0000-000000000002';
const SUCURSAL_A = '40000000-0000-0000-0000-000000000001';
const SUCURSAL_B = '40000000-0000-0000-0000-000000000002';
const USER_1 = '50000000-0000-0000-0000-000000000001';
const USER_2 = '50000000-0000-0000-0000-000000000002';

function entry(overrides: Partial<Parameters<typeof buildConversationMemoryEntry>[0]> = {}): ConversationMemoryEntry {
  return buildConversationMemoryEntry({
    id: '60000000-0000-0000-0000-000000000001',
    conversationId: 'conv-1',
    userId: USER_1,
    pacienteId: PATIENT_A,
    sucursalId: SUCURSAL_A,
    domain: 'nutricion',
    summary: 'Paciente prefiere evitar lactosa; se acordaron porciones de fruta.',
    sensitivity: 'PHI',
    turnCount: 5,
    now: NOW,
    ...overrides,
  });
}

describe('memoria conversacional', () => {
  it('respeta aislamiento por paciente y por sucursal', async () => {
    const store = new InMemoryConversationMemoryStore();
    await store.save(entry({ id: 'e1' }));
    await store.save(entry({ id: 'e2', pacienteId: PATIENT_B }));
    await store.save(entry({ id: 'e3', sucursalId: SUCURSAL_B }));
    const mine = await store.list({ userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, now: NOW });
    expect(mine.map((e) => e.id)).toEqual(['e1']);
    const otherSucursal = await store.list({ userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_B, now: NOW });
    expect(otherSucursal.map((e) => e.id)).toEqual(['e3']);
  });

  it('nunca filtra memoria de otro usuario aunque comparta paciente', async () => {
    const store = new InMemoryConversationMemoryStore();
    await store.save(entry({ id: 'e1', userId: USER_1, summary: 'Dato sensible de USER_1' }));
    await store.save(entry({ id: 'e2', userId: USER_2, summary: 'Dato sensible de USER_2' }));
    const asUser2 = await store.list({ userId: USER_2, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, now: NOW });
    expect(asUser2.map((e) => e.summary)).toEqual(['Dato sensible de USER_2']);
  });

  it('excluye expiradas y purga al vencer TTL', async () => {
    const store = new InMemoryConversationMemoryStore();
    await store.save(entry({ id: 'expired', ttlDays: 1 }));
    await store.save(entry({ id: 'alive', now: NOW, ttlDays: 30 }));
    const later = new Date(NOW.getTime() + 2 * DAY);
    const visible = await store.list({ userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, now: later });
    expect(visible.map((e) => e.id)).toEqual(['alive']);
    expect(await store.purgeExpired(later)).toBe(1);
  });

  it('respeta limites de turnos y bytes de la politica', () => {
    expect(isConversationMemoryWithinPolicy(entry({ turnCount: CONVERSATION_MEMORY_POLICY.maxTurns + 1 }))).toBe(false);
    expect(isConversationMemoryWithinPolicy(entry({ summary: 'x'.repeat(CONVERSATION_MEMORY_POLICY.maxBytes + 1) }))).toBe(false);
    expect(isConversationMemoryWithinPolicy(entry())).toBe(true);
  });

  it('egress filtra PHI cuando el canal no la permite', () => {
    const lines = renderConversationMemoryForEgress({ entries: [entry({ id: 'phi', sensitivity: 'PHI' }), entry({ id: 'np', sensitivity: 'NON_PHI', summary: 'Resumen general' })], allowPhi: false });
    expect(lines).toEqual(['nutricion: Resumen general']);
    const withPhi = renderConversationMemoryForEgress({ entries: [entry({ id: 'phi', sensitivity: 'PHI' })], allowPhi: true });
    expect(withPhi).toHaveLength(1);
  });

  it('borrado logico excluye de listados', async () => {
    const store = new InMemoryConversationMemoryStore();
    await store.save({ ...entry({ id: 'e1' }), deletedAt: NOW.toISOString() });
    await store.save(entry({ id: 'e2' }));
    const visible = await store.list({ userId: USER_1, pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, now: NOW });
    expect(visible.map((e) => e.id)).toEqual(['e2']);
  });
});

describe('memoria de paciente (regresion Build 06.1)', () => {
  it('sigue aislada por paciente y visibilidad', async () => {
    const store = new InMemoryMemoryStore();
    await store.save(buildMemoryEntry({ id: 'm1', pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, actorId: USER_1, content: 'nota compartida', visibility: 'shared', source: 'professional_note', now: NOW, retentionDays: 30 }));
    await store.save(buildMemoryEntry({ id: 'm2', pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, actorId: USER_2, content: 'nota privada', visibility: 'private', source: 'professional_note', now: NOW, retentionDays: 30 }));
    const asUser1 = await store.list({ pacienteId: PATIENT_A, sucursalId: SUCURSAL_A, actorId: USER_1, now: NOW });
    expect(asUser1.map((e) => e.content)).toEqual(['nota compartida']);
  });
});

describe('preferencias de usuario', () => {
  it('permite claves seguras y rechaza overrides de politica', () => {
    expect(SAFE_PREFERENCE_KEYS.has('language')).toBe(true);
    expect(FORBIDDEN_PREFERENCE_KEYS.has('professional_review_disabled')).toBe(true);
    expect(() => buildUserPreference({ prefKey: 'professional_review_disabled', value: true, userId: USER_1, sucursalId: SUCURSAL_A, now: NOW })).toThrow();
    expect(() => buildUserPreference({ prefKey: 'clave_desconocida', value: 'x', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW })).toThrow();
    expect(() => buildUserPreference({ prefKey: 'measurement_units', value: 'cubits', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW })).toThrow();
  });

  it('aplica solo hints de estilo/formato/routing; el hint de modelo no desbloquea nada', () => {
    const applied = applyUserPreferences({
      preferences: [
        buildUserPreference({ prefKey: 'language', value: 'es', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW }),
        buildUserPreference({ prefKey: 'preferred_model_hint', value: 'llama3.2', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW }),
      ],
    });
    const applications = applied.hints.map((h) => h.application);
    expect(applications).toEqual(['format', 'routing']);
  });

  it('aísla preferencias por usuario y sucursal', async () => {
    const store = new InMemoryUserPreferenceStore();
    await store.save(buildUserPreference({ prefKey: 'language', value: 'es', userId: USER_1, sucursalId: SUCURSAL_A, now: NOW }));
    await store.save(buildUserPreference({ prefKey: 'language', value: 'en', userId: USER_2, sucursalId: SUCURSAL_A, now: NOW }));
    expect((await store.get(USER_1, SUCURSAL_A, 'language'))?.value).toBe('es');
    expect(await store.get(USER_1, SUCURSAL_A, 'verbosity')).toBeUndefined();
    expect(await store.delete(USER_1, SUCURSAL_A, 'language')).toBe(true);
    expect(await store.get(USER_1, SUCURSAL_A, 'language')).toBeUndefined();
  });
});