import type { LabReferenceRange } from "../domain/LabReferenceRange";

/**
 * Rangos de referencia orientativos para población adulta mexicana.
 *
 * Basados en guías de la Asociación Mexicana de Diabetes y valores de
 * referencia de laboratorios clínicos mexicanos. NO sustituyen el criterio
 * del laboratorio que emitió el resultado.
 *
 * Para niños y adolescentes, los rangos difieren y deben consultarse en
 * tablas pediátricas específicas.
 */
export const MEXICO_REFERENCE_RANGES: LabReferenceRange[] = [
  // ── Glucosa y metabolismo ──────────────────────────────────────────
  { test: "GLUCOSA", sex: "all", low: 70, high: 99, criticalLow: 50, criticalHigh: 250, notes: "Normoglucosa 70-99; intolerancia 100-125; DM ≥126 (ADA)." },
  { test: "GLUCOSA", sex: "all", ageMinYears: 0, ageMaxYears: 18, low: 60, high: 100, notes: "Rango pediátrico aproximado." },
  { test: "INSULINA", sex: "all", low: 2, high: 25, notes: "Ayuno 8-12 h. HOMA-IR >2.5 sugiere resistencia." },
  { test: "HBA1C", sex: "all", low: 4, high: 5.6, criticalHigh: 10, notes: "Normal <5.7; prediabetes 5.7-6.4; DM ≥6.5 (ADA)." },

  // ── Perfil lipídico (ATP IV / NOM-037-SSA1-2023) ──────────────────
  { test: "COLESTEROL_TOTAL", sex: "all", low: null, high: 200, criticalHigh: 300, notes: "Deseable <200; limítrofe 200-239; alto ≥240." },
  { test: "LDL", sex: "all", low: null, high: 100, criticalHigh: 190, notes: "Óptimo <100; limítrofe 130-159; alto 160-189; muy alto ≥190." },
  { test: "LDL", sex: "all", ageMinYears: 0, ageMaxYears: 20, low: null, high: 110, notes: "Meta más flexible en <20 años." },
  { test: "HDL", sex: "male", low: 40, high: null, notes: "Bajo <40 (hombres); deseable >60." },
  { test: "HDL", sex: "female", low: 50, high: null, notes: "Bajo <50 (mujeres); deseable >60." },
  { test: "TRIGLICERIDOS", sex: "all", low: null, high: 150, criticalHigh: 500, notes: "Deseable <150; limítrofe 150-199; alto 200-499; muy alto ≥500." },

  // ── Función renal ──────────────────────────────────────────────────
  { test: "CREATININA", sex: "male", low: 0.7, high: 1.3, notes: "Hombres adultos." },
  { test: "CREATININA", sex: "female", low: 0.6, high: 1.1, notes: "Mujeres adultas." },
  { test: "BUN", sex: "all", low: 7, high: 20, criticalHigh: 100, notes: "Nitrógeno ureico en sangre." },
  { test: "ACIDO_URICO", sex: "male", low: 3.4, high: 7.0, notes: "Hombres." },
  { test: "ACIDO_URICO", sex: "female", low: 2.4, high: 6.0, notes: "Mujeres premenopáusicas." },

  // ── Función hepática ──────────────────────────────────────────────
  { test: "TGO_AST", sex: "all", low: null, high: 40, criticalHigh: 500 },
  { test: "TGP_ALT", sex: "all", low: null, high: 41, criticalHigh: 500 },
  { test: "GGT", sex: "male", low: null, high: 60 },
  { test: "GGT", sex: "female", low: null, high: 40 },
  { test: "BILIRRUBINA_TOTAL", sex: "all", low: 0.1, high: 1.2, criticalHigh: 5 },

  // ── Proteínas ─────────────────────────────────────────────────────
  { test: "ALBUMINA", sex: "all", low: 3.5, high: 5.0, criticalLow: 2.5, notes: "Hipoalbuminemia <3.5 sugiere malnutrición." },
  { test: "PROTEINAS_TOTALES", sex: "all", low: 6.0, high: 8.3, notes: "Incluye albúmina + globulinas." },

  // ── Hemograma ─────────────────────────────────────────────────────
  { test: "HEMOGLOBINA", sex: "male", low: 13.0, high: 17.0, criticalLow: 7 },
  { test: "HEMOGLOBINA", sex: "female", low: 12.0, high: 15.5, criticalLow: 7 },
  { test: "HEMATOCRITO", sex: "male", low: 40, high: 52, criticalLow: 20 },
  { test: "HEMATOCRITO", sex: "female", low: 36, high: 48, criticalLow: 20 },

  // ── Hierro ───────────────────────────────────────────────────────
  { test: "HIERRO_SERICO", sex: "male", low: 65, high: 175 },
  { test: "HIERRO_SERICO", sex: "female", low: 50, high: 170 },
  { test: "FERRITINA", sex: "male", low: 30, high: 400 },
  { test: "FERRITINA", sex: "female", low: 15, high: 150, notes: "Mujeres premenopáusicas: <15 indica deficiencia de hierro." },

  // ── Vitaminas ────────────────────────────────────────────────────
  { test: "VITAMINA_D", sex: "all", low: 30, high: 100, criticalLow: 20, notes: "Deficiencia <20; insuficiencia 20-29; suficiente 30-100." },
  { test: "VITAMINA_B12", sex: "all", low: 200, high: 900, criticalLow: 100 },
  { test: "FOLATO", sex: "all", low: 3, high: 17, criticalLow: 2 },

  // ── Tiroides ─────────────────────────────────────────────────────
  { test: "TSH", sex: "all", low: 0.4, high: 4.0, notes: "Hipotiroides >4.5; hipertiroides <0.1." },
  { test: "TSH", sex: "female", ageMinYears: 18, ageMaxYears: 50, low: 0.4, high: 2.5, notes: "Rango más estricto en mujeres en edad fértil." },
];
