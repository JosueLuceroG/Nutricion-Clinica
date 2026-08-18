import { describe, expect, it } from 'vitest';
import {
  SMAE_CATALOG,
  SMAE_CATALOG_SOURCE_LABEL,
  SMAE_CATALOG_VERSION,
  SMAE_ENGINE_VERSION,
  SYSTEM_FOODS,
  activeEntries,
  computeSmaeCatalogFingerprint,
  getSmaeFoodById,
  loadSmaeCatalog,
  searchSmaeFoods,
  validateSmaeCatalogItem,
  type SmaeCatalogItemInput,
} from './smaeCatalog.js';
import { suggestSubstitutions, summarizeExchanges } from './smaeEngine.js';

const VALID_ITEM: SmaeCatalogItemInput = {
  id: 'verdura-berenjena-test',
  group: 'verduras',
  name: 'Berenjena (sintética)',
  shortName: 'Berenjena',
  serving: '1 taza cocida',
  servingGrams: 100,
  keywords: ['morada', 'vegetal'],
  nutrition: { kcal: 25, proteinG: 2, carbsG: 5, fatG: 0 },
  status: 'active',
};

describe('Catálogo SMAE incremental (Build 06.1, spec 18)', () => {
  it('37/37 del catálogo ACTUAL de NutriClínica: 37 activos cargados y soportados', () => {
    expect(activeEntries(SMAE_CATALOG)).toHaveLength(37);
    expect(SYSTEM_FOODS).toHaveLength(37);
    expect(SMAE_CATALOG.entries).toHaveLength(37);
  });

  it('versiones separadas: ENGINE vs CATALOG, ambas trazables', () => {
    expect(SMAE_ENGINE_VERSION).toBe('smae-engine-v1');
    expect(SMAE_CATALOG_VERSION).toMatch(/^smae-catalog-[0-9a-f]{8}$/);
    expect(SMAE_CATALOG.engineVersion).toBe(SMAE_ENGINE_VERSION);
    expect(SMAE_CATALOG.version).toBe(SMAE_CATALOG_VERSION);
    expect(SMAE_CATALOG.sourceLabel).toBe(SMAE_CATALOG_SOURCE_LABEL);
  });

  it('el fingerprint es determinista y sensible al contenido', () => {
    const a = computeSmaeCatalogFingerprint(SMAE_CATALOG.entries);
    const b = computeSmaeCatalogFingerprint(SMAE_CATALOG.entries);
    expect(a).toBe(b);
    const added = loadSmaeCatalog([...SMAE_CATALOG.entries, VALID_ITEM]);
    expect(computeSmaeCatalogFingerprint(added.entries)).not.toBe(a);
    expect(added.version).not.toBe(SMAE_CATALOG_VERSION);
  });

  it('un alimento nuevo NO requiere cambios del motor (extensibilidad, 18.4)', () => {
    const synthetic = loadSmaeCatalog([...SMAE_CATALOG.entries, VALID_ITEM]);
    expect(getSmaeFoodById('verdura-berenjena-test', synthetic)).toMatchObject({ group: 'verduras', servingGrams: 100 });
    expect(searchSmaeFoods('berenjena', synthetic).map((f) => f.id)).toContain('verdura-berenjena-test');
    const summary = summarizeExchanges([{ foodId: 'verdura-berenjena-test', group: 'verduras', portions: 2 }], synthetic);
    expect(summary.totals.kcal).toBe(50);
    expect(summary.catalogVersion).toBe(synthetic.version);
    expect(summary.engineVersion).toBe(SMAE_ENGINE_VERSION);
    const subs = suggestSubstitutions('verdura-berenjena-test', { allergenTexts: [], intoleranceTexts: [] }, synthetic);
    expect(subs.unmatched).toBe(false);
    expect(subs.candidates.length).toBeGreaterThan(0);
  });

  it('validación fail-closed: ítems malformados nunca entran al catálogo', () => {
    const badId = validateSmaeCatalogItem({ ...VALID_ITEM, id: 'UPPER-BAD' });
    expect(badId.ok).toBe(false);
    const badGroup = validateSmaeCatalogItem({ ...VALID_ITEM, group: 'grupo-inexistente' });
    expect(badGroup.ok).toBe(false);
    const badGrams = validateSmaeCatalogItem({ ...VALID_ITEM, servingGrams: -5 });
    expect(badGrams.ok).toBe(false);
    const badKcal = validateSmaeCatalogItem({ ...VALID_ITEM, nutrition: { ...VALID_ITEM.nutrition, kcal: -1 } });
    expect(badKcal.ok).toBe(false);
    const badName = validateSmaeCatalogItem({ ...VALID_ITEM, name: '' });
    expect(badName.ok).toBe(false);
    const badPortion = validateSmaeCatalogItem({ ...VALID_ITEM, servingGrams: 0 });
    expect(badPortion.ok).toBe(false);
    expect(() => loadSmaeCatalog([...SMAE_CATALOG.entries, { ...VALID_ITEM, id: 'con espacios' }])).toThrow(/fail-closed/);
    expect(() => loadSmaeCatalog([...SMAE_CATALOG.entries, VALID_ITEM, VALID_ITEM])).toThrow(/duplicado/);
  });

  it('ítems inactivos: válidos pero excluidos de búsqueda/sustitución, presentes en el fingerprint', () => {
    const inactive = { ...VALID_ITEM, id: 'verdura-inactiva-test', status: 'inactive' as const };
    const catalog = loadSmaeCatalog([...SMAE_CATALOG.entries, inactive]);
    expect(catalog.entries).toHaveLength(38);
    expect(activeEntries(catalog)).toHaveLength(37);
    expect(getSmaeFoodById('verdura-inactiva-test', catalog)).toBeNull();
    expect(searchSmaeFoods('inactiva', catalog)).toHaveLength(0);
    expect(computeSmaeCatalogFingerprint(catalog.entries)).not.toBe(computeSmaeCatalogFingerprint(SMAE_CATALOG.entries));
  });

  it('la versión del catálogo fluye a provenance de cálculos y evidencia', () => {
    const summary = summarizeExchanges([{ foodId: 'fruta-manzana', group: 'frutas', portions: 1 }]);
    expect(summary.catalogVersion).toBe(SMAE_CATALOG_VERSION);
    expect(summary.engineVersion).toBe(SMAE_ENGINE_VERSION);
  });
});