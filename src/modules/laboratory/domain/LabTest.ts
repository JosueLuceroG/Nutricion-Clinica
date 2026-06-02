import { z } from "zod";

/**
 * Catálogo de pruebas de laboratorio soportadas.
 * Cada código es estable y se usa como clave primaria del catálogo.
 */
export const LAB_TEST_CODES = [
  "GLUCOSA",
  "INSULINA",
  "HBA1C",
  "COLESTEROL_TOTAL",
  "LDL",
  "HDL",
  "TRIGLICERIDOS",
  "CREATININA",
  "BUN",
  "ACIDO_URICO",
  "TGO_AST",
  "TGP_ALT",
  "GGT",
  "BILIRRUBINA_TOTAL",
  "ALBUMINA",
  "PROTEINAS_TOTALES",
  "HEMOGLOBINA",
  "HEMATOCRITO",
  "HIERRO_SERICO",
  "FERRITINA",
  "VITAMINA_D",
  "VITAMINA_B12",
  "FOLATO",
  "TSH",
] as const;

export const LabTestCodeSchema = z.enum(LAB_TEST_CODES);
export type LabTestCode = z.infer<typeof LabTestCodeSchema>;

export const LabTestCategorySchema = z.enum([
  "glucosa",
  "lipidos",
  "renal",
  "hepatico",
  "proteinas",
  "hemograma",
  "hierro",
  "vitaminas",
  "tiroides",
  "otros",
]);
export type LabTestCategory = z.infer<typeof LabTestCategorySchema>;

export interface LabTestDefinition {
  code: LabTestCode;
  name: string;
  shortName: string;
  category: LabTestCategory;
  unit: string;
  decimals: number;
  description?: string;
}

export const LAB_TEST_DEFINITIONS: Record<LabTestCode, LabTestDefinition> = {
  GLUCOSA: {
    code: "GLUCOSA",
    name: "Glucosa en ayunas",
    shortName: "Glucosa",
    category: "glucosa",
    unit: "mg/dL",
    decimals: 0,
    description: "Glucosa plasmática en ayuno de 8-12 horas",
  },
  INSULINA: {
    code: "INSULINA",
    name: "Insulina",
    shortName: "Insulina",
    category: "glucosa",
    unit: "µUI/mL",
    decimals: 1,
  },
  HBA1C: {
    code: "HBA1C",
    name: "Hemoglobina glucosilada",
    shortName: "HbA1c",
    category: "glucosa",
    unit: "%",
    decimals: 1,
  },
  COLESTEROL_TOTAL: {
    code: "COLESTEROL_TOTAL",
    name: "Colesterol total",
    shortName: "Col. total",
    category: "lipidos",
    unit: "mg/dL",
    decimals: 0,
  },
  LDL: {
    code: "LDL",
    name: "Colesterol LDL",
    shortName: "LDL",
    category: "lipidos",
    unit: "mg/dL",
    decimals: 0,
  },
  HDL: {
    code: "HDL",
    name: "Colesterol HDL",
    shortName: "HDL",
    category: "lipidos",
    unit: "mg/dL",
    decimals: 0,
  },
  TRIGLICERIDOS: {
    code: "TRIGLICERIDOS",
    name: "Triglicéridos",
    shortName: "TG",
    category: "lipidos",
    unit: "mg/dL",
    decimals: 0,
  },
  CREATININA: {
    code: "CREATININA",
    name: "Creatinina sérica",
    shortName: "Creatinina",
    category: "renal",
    unit: "mg/dL",
    decimals: 2,
  },
  BUN: {
    code: "BUN",
    name: "Nitrógeno ureico",
    shortName: "BUN",
    category: "renal",
    unit: "mg/dL",
    decimals: 0,
  },
  ACIDO_URICO: {
    code: "ACIDO_URICO",
    name: "Ácido úrico",
    shortName: "Ác. úrico",
    category: "renal",
    unit: "mg/dL",
    decimals: 1,
  },
  TGO_AST: {
    code: "TGO_AST",
    name: "TGO (AST)",
    shortName: "TGO",
    category: "hepatico",
    unit: "U/L",
    decimals: 0,
  },
  TGP_ALT: {
    code: "TGP_ALT",
    name: "TGP (ALT)",
    shortName: "TGP",
    category: "hepatico",
    unit: "U/L",
    decimals: 0,
  },
  GGT: {
    code: "GGT",
    name: "Gamma-glutamil transferasa",
    shortName: "GGT",
    category: "hepatico",
    unit: "U/L",
    decimals: 0,
  },
  BILIRRUBINA_TOTAL: {
    code: "BILIRRUBINA_TOTAL",
    name: "Bilirrubina total",
    shortName: "Bil. T",
    category: "hepatico",
    unit: "mg/dL",
    decimals: 2,
  },
  ALBUMINA: {
    code: "ALBUMINA",
    name: "Albúmina sérica",
    shortName: "Albúmina",
    category: "proteinas",
    unit: "g/dL",
    decimals: 2,
  },
  PROTEINAS_TOTALES: {
    code: "PROTEINAS_TOTALES",
    name: "Proteínas totales",
    shortName: "Prot. T",
    category: "proteinas",
    unit: "g/dL",
    decimals: 2,
  },
  HEMOGLOBINA: {
    code: "HEMOGLOBINA",
    name: "Hemoglobina",
    shortName: "Hb",
    category: "hemograma",
    unit: "g/dL",
    decimals: 1,
  },
  HEMATOCRITO: {
    code: "HEMATOCRITO",
    name: "Hematocrito",
    shortName: "Hto",
    category: "hemograma",
    unit: "%",
    decimals: 1,
  },
  HIERRO_SERICO: {
    code: "HIERRO_SERICO",
    name: "Hierro sérico",
    shortName: "Hierro",
    category: "hierro",
    unit: "µg/dL",
    decimals: 0,
  },
  FERRITINA: {
    code: "FERRITINA",
    name: "Ferritina",
    shortName: "Ferritina",
    category: "hierro",
    unit: "ng/mL",
    decimals: 1,
  },
  VITAMINA_D: {
    code: "VITAMINA_D",
    name: "Vitamina D (25-OH)",
    shortName: "Vit. D",
    category: "vitaminas",
    unit: "ng/mL",
    decimals: 1,
  },
  VITAMINA_B12: {
    code: "VITAMINA_B12",
    name: "Vitamina B12",
    shortName: "B12",
    category: "vitaminas",
    unit: "pg/mL",
    decimals: 0,
  },
  FOLATO: {
    code: "FOLATO",
    name: "Folato",
    shortName: "Folato",
    category: "vitaminas",
    unit: "ng/mL",
    decimals: 1,
  },
  TSH: {
    code: "TSH",
    name: "Hormona estimulante de tiroides",
    shortName: "TSH",
    category: "tiroides",
    unit: "µUI/mL",
    decimals: 2,
  },
};

export const LabTestCategoryLabel: Record<LabTestCategory, string> = {
  glucosa: "Glucosa y metabolismo",
  lipidos: "Perfil lipídico",
  renal: "Función renal",
  hepatico: "Función hepática",
  proteinas: "Proteínas",
  hemograma: "Hemograma",
  hierro: "Metabolismo del hierro",
  vitaminas: "Vitaminas",
  tiroides: "Función tiroidea",
  otros: "Otros",
};

export const getLabTestDefinition = (code: LabTestCode): LabTestDefinition => {
  return LAB_TEST_DEFINITIONS[code];
};

export const getLabTestsByCategory = (): Record<LabTestCategory, LabTestDefinition[]> => {
  const grouped = {} as Record<LabTestCategory, LabTestDefinition[]>;
  for (const def of Object.values(LAB_TEST_DEFINITIONS)) {
    if (!grouped[def.category]) grouped[def.category] = [];
    grouped[def.category].push(def);
  }
  return grouped;
};
