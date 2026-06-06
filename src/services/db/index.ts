import { db, NutriClinicaDB } from './dexieSchema';

export { db, NutriClinicaDB };

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __ncDb: NutriClinicaDB }).__ncDb = db;
}
