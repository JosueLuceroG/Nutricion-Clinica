import type { MedicationCatalog } from "../domain/MedicationCatalog";
import type { NutrientInteraction } from "../domain/NutrientInteraction";
import type { InteractionSeverity } from "../domain/MedicationCatalogTypes";

export interface MedicationAlert {
  medicamento_id: string;
  medicamento_nombre: string;
  principio_activo: string;
  nutriente: string;
  tipo: string;
  severidad: InteractionSeverity;
  recomendacion: string;
}

interface HardcodedRule {
  drugPattern: string;
  nutrient: string;
  tipo: string;
  severidad: InteractionSeverity;
  recomendacion: string;
}

const HARDCODED_RULES: HardcodedRule[] = [
  {
    drugPattern: "warfarina",
    nutrient: "vitamina K",
    tipo: "antagoniza_efecto",
    severidad: "severa",
    recomendacion: "Alerta de INR. Sugerir consistencia en consumo de verduras verdes.",
  },
  {
    drugPattern: "tetraciclina",
    nutrient: "calcio / hierro",
    tipo: "reduce_absorcion",
    severidad: "moderada",
    recomendacion: "Separar 2h de lácteos y suplementos de calcio/hierro.",
  },
  {
    drugPattern: "quinolona",
    nutrient: "calcio / hierro",
    tipo: "reduce_absorcion",
    severidad: "moderada",
    recomendacion: "Separar 2h de lácteos y suplementos de calcio/hierro.",
  },
  {
    drugPattern: "IECA",
    nutrient: "potasio",
    tipo: "potencia_efecto",
    severidad: "moderada",
    recomendacion: "Vigilar K sérico. Evitar suplementos de potasio y sales sucedáneas.",
  },
  {
    drugPattern: "ARA-II",
    nutrient: "potasio",
    tipo: "potencia_efecto",
    severidad: "moderada",
    recomendacion: "Vigilar K sérico. Evitar suplementos de potasio y sales sucedáneas.",
  },
  {
    drugPattern: "metformina",
    nutrient: "vitamina B12",
    tipo: "reduce_absorcion",
    severidad: "moderada",
    recomendacion: "Vigilar déficit de B12 a largo plazo. Considerar suplementación.",
  },
  {
    drugPattern: "levotiroxina",
    nutrient: "calcio / hierro",
    tipo: "reduce_absorcion",
    severidad: "moderada",
    recomendacion: "Separar 4h de suplementos de calcio/hierro.",
  },
  {
    drugPattern: "corticoide",
    nutrient: "calcio / vitamina D",
    tipo: "reduce_absorcion",
    severidad: "moderada",
    recomendacion: "Sugerir suplementación de calcio y vitamina D a largo plazo.",
  },
  {
    drugPattern: "estatina",
    nutrient: "pomelo",
    tipo: "toxicidad",
    severidad: "severa",
    recomendacion: "Evitar consumo de pomelo (toronja) durante el tratamiento.",
  },
];

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matchesDrug(principioActivo: string, pattern: string): boolean {
  const normalized = normalize(principioActivo);
  return normalized.includes(normalize(pattern));
}

export function evaluateAlerts(
  medications: MedicationCatalog[],
  interactions: NutrientInteraction[],
): MedicationAlert[] {
  const alerts: MedicationAlert[] = [];

  for (const med of medications) {
    for (const rule of HARDCODED_RULES) {
      if (matchesDrug(med.principio_activo, rule.drugPattern)) {
        alerts.push({
          medicamento_id: med.id,
          medicamento_nombre: med.nombre_comercial,
          principio_activo: med.principio_activo,
          nutriente: rule.nutrient,
          tipo: rule.tipo,
          severidad: rule.severidad,
          recomendacion: rule.recomendacion,
        });
      }
    }

    for (const interaction of interactions) {
      if (interaction.medicamento_id === med.id) {
        alerts.push({
          medicamento_id: med.id,
          medicamento_nombre: med.nombre_comercial,
          principio_activo: med.principio_activo,
          nutriente: interaction.nutriente,
          tipo: interaction.tipo,
          severidad: interaction.severidad,
          recomendacion: interaction.recomendacion,
        });
      }
    }
  }

  return alerts;
}
