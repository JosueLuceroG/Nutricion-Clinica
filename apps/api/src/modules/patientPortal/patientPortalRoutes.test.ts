import { describe, expect, it } from 'vitest';
import { generatePortalToken, hashPortalToken, isUuid, parsePortalMeals, parsePortalScopes } from './patientPortalRoutes.js';

describe('patientPortalRoutes utilities', () => {
  it('hashPortalToken produce SHA-256 hex estable sin exponer el token', () => {
    const hash = hashPortalToken('portal-token-123456789012345678901234567890');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashPortalToken('portal-token-123456789012345678901234567890'));
    expect(hash).not.toContain('portal-token');
  });

  it('generatePortalToken produce token publico seguro compatible con la ruta', () => {
    const token = generatePortalToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(generatePortalToken()).not.toBe(token);
  });

  it('isUuid acepta UUID estandar 8-4-4-4-12', () => {
    expect(isUuid('18be803d-d16e-48cc-a2f1-c442da1c41af')).toBe(true);
    expect(isUuid('18be803d-d16e-48cc-a2f1c442da1c41af')).toBe(false);
  });

  it('parsePortalScopes acepta solo scopes conocidos y elimina duplicados', () => {
    const scopes = parsePortalScopes('["summary","plan","summary","documents","adherence"]');
    expect(scopes).toEqual(['summary', 'plan', 'documents', 'adherence']);
  });

  it('parsePortalScopes retorna arreglo vacio si el JSON es invalido', () => {
    expect(parsePortalScopes('{bad-json')).toEqual([]);
    expect(parsePortalScopes('["summary","admin"]')).toEqual([]);
  });

  it('parsePortalMeals normaliza meals_json valido', () => {
    const meals = parsePortalMeals(
      JSON.stringify([{ slot: 'breakfast', exchanges: [{ foodId: 'cereal-tortilla-maiz', count: 2 }] }]),
    );
    expect(meals).toEqual([{ slot: 'breakfast', exchanges: [{ foodId: 'cereal-tortilla-maiz', count: 2 }] }]);
  });

  it('parsePortalMeals retorna arreglo vacio para contenido no valido', () => {
    expect(parsePortalMeals('not-json')).toEqual([]);
    expect(parsePortalMeals(JSON.stringify([{ slot: '', exchanges: [] }]))).toEqual([]);
  });
});
