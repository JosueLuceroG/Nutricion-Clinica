import type { NutriClinicaDB } from './dexieSchema';

const FIXED_TABLES = [
  { table: 'patients' as const, jsonKey: 'clinical_tags' as const },
  { table: 'consultations' as const, jsonKey: 'vitals_json' as const, legacyKey: 'vitals' as const },
  { table: 'meal_plans' as const, jsonKey: 'meals_json' as const, legacyKey: 'meals' as const },
];

let hasRun = false;

export async function fixLegacyJsonColumns(db: NutriClinicaDB): Promise<number> {
  if (hasRun) return 0;
  hasRun = true;
  let fixed = 0;

  for (const { table, jsonKey, legacyKey } of FIXED_TABLES) {
    const tbl = (db as unknown as Record<string, { toArray: () => Promise<unknown[]>; put: (v: unknown) => Promise<unknown> }>)[table];
    const rows = await tbl.toArray();
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const val = r[jsonKey];
      // Si ya es string o nullish, no hay que tocar
      if (typeof val === 'string' || val === null || val === undefined) {
        // Pero si ademas tiene la key legacy, la limpiamos
        if (legacyKey && legacyKey in r) {
          delete r[legacyKey];
          await tbl.put(r);
          fixed++;
        }
        continue;
      }
      // Si el valor es un objeto/array (legacy data antes del fix toLocalRow)
      r[jsonKey] = JSON.stringify(val);
      if (legacyKey && legacyKey in r) delete r[legacyKey];
      await tbl.put(r);
      fixed++;
    }
  }

  if (fixed > 0) {
    console.log(`[fixLegacyJsonColumns] ${fixed} filas reparadas`);
  }
  return fixed;
}
