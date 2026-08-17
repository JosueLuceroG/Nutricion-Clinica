/**
 * Motor determinista de interacciones medicamento-nutriente.
 *
 * Las reglas provienen de la fuente autoritativa del producto: el módulo
 * `src/modules/medication/application/medicationAlertEngine.ts` del cliente
 * (reglas documentadas hardcoded del catálogo de medicamentos). Se portan
 * al servidor con versión explícita para que la capacidad
 * reviewDrugNutrientInteractions sea determinista y auditable.
 *
 * Alcance (PARTIAL): cubre únicamente las reglas documentadas del producto
 * (9 patrones). No se inventan interacciones nuevas ni se afirma cobertura
 * farmacológica completa.
 */

export const DRUG_NUTRIENT_RULES_VERSION = 'drug-nutrient.v1';

export type InteractionSeverity = 'leve' | 'moderada' | 'severa';

export interface DrugNutrientRule {
  drugPattern: string;
  nutrient: string;
  tipo: string;
  severidad: InteractionSeverity;
  recomendacion: string;
}

export interface MedicationForRules {
  id?: string;
  nombre?: string;
  principio_activo?: string;
}

export interface DrugNutrientAlert {
  ruleId: string;
  medicamentoId: string | null;
  medicamentoNombre: string;
  principioActivo: string;
  nutriente: string;
  tipo: string;
  severidad: InteractionSeverity;
  recomendacion: string;
}

export const DRUG_NUTRIENT_RULES: readonly DrugNutrientRule[] = [
  { drugPattern: 'warfarina', nutrient: 'vitamina K', tipo: 'antagoniza_efecto', severidad: 'severa', recomendacion: 'Alerta de INR. Sugerir consistencia en consumo de verduras verdes.' },
  { drugPattern: 'tetraciclina', nutrient: 'calcio / hierro', tipo: 'reduce_absorcion', severidad: 'moderada', recomendacion: 'Separar 2h de lácteos y suplementos de calcio/hierro.' },
  { drugPattern: 'quinolona', nutrient: 'calcio / hierro', tipo: 'reduce_absorcion', severidad: 'moderada', recomendacion: 'Separar 2h de lácteos y suplementos de calcio/hierro.' },
  { drugPattern: 'IECA', nutrient: 'potasio', tipo: 'potencia_efecto', severidad: 'moderada', recomendacion: 'Vigilar K sérico. Evitar suplementos de potasio y sales sucedáneas.' },
  { drugPattern: 'ARA-II', nutrient: 'potasio', tipo: 'potencia_efecto', severidad: 'moderada', recomendacion: 'Vigilar K sérico. Evitar suplementos de potasio y sales sucedáneas.' },
  { drugPattern: 'metformina', nutrient: 'vitamina B12', tipo: 'reduce_absorcion', severidad: 'moderada', recomendacion: 'Vigilar déficit de B12 a largo plazo. Considerar suplementación.' },
  { drugPattern: 'levotiroxina', nutrient: 'calcio / hierro', tipo: 'reduce_absorcion', severidad: 'moderada', recomendacion: 'Separar 4h de suplementos de calcio/hierro.' },
  { drugPattern: 'corticoide', nutrient: 'calcio / vitamina D', tipo: 'reduce_absorcion', severidad: 'moderada', recomendacion: 'Sugerir suplementación de calcio y vitamina D a largo plazo.' },
  { drugPattern: 'estatina', nutrient: 'pomelo', tipo: 'toxicidad', severidad: 'severa', recomendacion: 'Evitar consumo de pomelo (toronja) durante el tratamiento.' },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesDrug(principioActivo: string, pattern: string): boolean {
  const normalized = normalize(principioActivo);
  return normalized.includes(normalize(pattern));
}

export function evaluateDrugNutrientInteractions(medications: MedicationForRules[]): {
  version: string;
  alerts: DrugNutrientAlert[];
  rulesEvaluated: number;
} {
  const alerts: DrugNutrientAlert[] = [];
  for (const med of medications) {
    const principioActivo = String(med.principio_activo ?? med.nombre ?? '').trim();
    if (!principioActivo) continue;
    for (const rule of DRUG_NUTRIENT_RULES) {
      if (matchesDrug(principioActivo, rule.drugPattern)) {
        alerts.push({
          ruleId: `drug-nutrient.${normalize(rule.drugPattern)}`,
          medicamentoId: med.id ?? null,
          medicamentoNombre: String(med.nombre ?? '(sin nombre)'),
          principioActivo,
          nutriente: rule.nutrient,
          tipo: rule.tipo,
          severidad: rule.severidad,
          recomendacion: rule.recomendacion,
        });
      }
    }
  }
  return { version: DRUG_NUTRIENT_RULES_VERSION, alerts, rulesEvaluated: DRUG_NUTRIENT_RULES.length };
}