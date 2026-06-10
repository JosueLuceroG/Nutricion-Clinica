import { describe, expect, it } from 'vitest';
import router, {
  generatePortalToken,
  hashPortalToken,
  isUuid,
  parseMealPhotoDataUrl,
  parsePortalMeals,
  parsePortalScopes,
} from './patientPortalRoutes.js';

interface ExpressLayerLike {
  route?: { path?: string };
}

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
    const scopes = parsePortalScopes('["summary","plan","summary","documents","adherence","messaging","meal_photos"]');
    expect(scopes).toEqual(['summary', 'plan', 'documents', 'adherence', 'messaging', 'meal_photos']);
  });

  it('parsePortalScopes por defecto incluye mensajeria y fotos de comidas para enlaces nuevos', () => {
    expect(parsePortalScopes(null)).toContain('messaging');
    expect(parsePortalScopes(null)).toContain('meal_photos');
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

  it('parseMealPhotoDataUrl acepta JPEG/PNG/WebP base64 y rechaza tipos no permitidos', () => {
    const parsed = parseMealPhotoDataUrl('data:image/jpeg;base64,QUJD');
    expect(parsed?.mimeType).toBe('image/jpeg');
    expect(parsed?.buffer.toString('utf8')).toBe('ABC');
    expect(parseMealPhotoDataUrl('data:image/gif;base64,QUJD')).toBeNull();
    expect(parseMealPhotoDataUrl('not-a-data-url')).toBeNull();
    const tooLarge = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
    expect(parseMealPhotoDataUrl(`data:image/png;base64,${tooLarge}`)).toBeNull();
  });

  it('rutas profesionales quedan antes de /:token para no capturarlas como token publico', () => {
    const stack = (router as unknown as { stack: ExpressLayerLike[] }).stack;
    const paths = stack.map((layer) => layer.route?.path).filter(Boolean);
    const tokenIndex = paths.indexOf('/:token');
    expect(paths.indexOf('/messages')).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf('/meal-photos')).toBeGreaterThanOrEqual(0);
    expect(paths.indexOf('/messages')).toBeLessThan(tokenIndex);
    expect(paths.indexOf('/meal-photos')).toBeLessThan(tokenIndex);
  });
});
