import type { LabResult } from "./LabResult";
import { classifyLabValue, type LabFlag } from "./LabResult";
import { findReferenceRange, type LabReferenceRange } from "./LabReferenceRange";
import type { Sex } from "@modules/patient/domain/Sex";
import type { LabTestCode } from "./LabTest";

export interface LabAlert {
  test: LabTestCode;
  testName: string;
  value: number;
  flag: LabFlag;
  severity: "info" | "warning" | "critical" | "blocking";
  message: string;
  recommendation: string;
}

const NUTRITIONAL_ALERTS: Record<string, { message: string; recommendation: string }> = {
  GLUCOSA: {
    message: "Glucosa alterada — evaluar riesgo de diabetes",
    recommendation: "Dieta baja en carbohidratos simples, monitoreo de HbA1c, consulta con endocrinología",
  },
  HBA1C: {
    message: "HbA1c elevada — control glucémico insuficiente",
    recommendation: "Ajustar plan alimentario, reducir hidratos de carbono refinados, aumentar fibra",
  },
  LDL: {
    message: "LDL elevado — riesgo cardiovascular aumentado",
    recommendation: "Reducir grasas saturadas y trans, aumentar ácidos grasos omega-3 y fibra soluble",
  },
  HDL: {
    message: "HDL bajo — factor de riesgo cardiovascular",
    recommendation: "Incrementar actividad física, incluir grasas monoinsaturadas (aguacate, aceite de oliva, nueces)",
  },
  TRIGLICERIDOS: {
    message: "Triglicéridos elevados — riesgo de enfermedad cardiovascular",
    recommendation: "Reducir carbohidratos simples y alcohol, aumentar omega-3, controlar peso",
  },
  CREATININA: {
    message: "Creatinina alterada — posible función renal comprometida",
    recommendation: "Evaluar TFGe, ajustar proteínas en plan alimentario, evitar antiinflamatorios",
  },
  HEMOGLOBINA: {
    message: "Hemoglobina baja — posible anemia nutricional",
    recommendation: "Evaluar ferritina, vitamina B12, ácido fólico; aumentar hierro hemínico y vitamina C",
  },
  FERRITINA: {
    message: "Ferritina alterada — posible deficiencia o sobrecarga de hierro",
    recommendation: "Correlacionar con hemoglobina y saturación de transferrina; ajustar plan según resultado",
  },
  ALBUMINA: {
    message: "Albúmina baja — posible desnutrición proteica",
    recommendation: "Evaluar ingesta proteica, función hepática, estado inflamatorio",
  },
  VITAMINA_D: {
    message: "Vitamina D alterada — riesgo óseo e inmune",
    recommendation: "Exposición solar 15-20 min/día, suplementación según déficit, alimentos fortificados",
  },
  COLESTEROL_TOTAL: {
    message: "Colesterol total elevado — riesgo cardiovascular",
    recommendation: "Reducir grasas saturadas y trans, aumentar fibra soluble y ácidos grasos omega-3",
  },
  VITAMINA_B12: {
    message: "Vitamina B12 alterada — posible deficiencia nutricional",
    recommendation: "Evaluar ingesta de B12, función gástrica, considerar suplementación sublingual o IM",
  },
  FOLATO: {
    message: "Folato alterado — riesgo de anemia megaloblástica",
    recommendation: "Aumentar consumo de verduras de hoja verde, legumbres; considerar suplementación",
  },
};

export function generateNutritionalAlerts(
  results: LabResult[],
  ranges: LabReferenceRange[],
  sex: Sex,
  ageYears: number,
): LabAlert[] {
  const alerts: LabAlert[] = [];

  for (const result of results) {
    const range = findReferenceRange(result.test, sex, ageYears, ranges);
    const flag = classifyLabValue(result.value, range);
    if (flag === "normal") continue;

    const alertConfig = NUTRITIONAL_ALERTS[result.test];
    const severity: LabAlert["severity"] =
      flag === "critical-low" || flag === "critical-high"
        ? "blocking"
        : flag === "low" || flag === "high"
          ? "warning"
          : "info";

    alerts.push({
      test: result.test,
      testName: result.test,
      value: result.value,
      flag,
      severity,
      message: alertConfig?.message ?? `${result.test} fuera de rango`,
      recommendation: alertConfig?.recommendation ?? "Evaluar clínicamente y ajustar plan alimentario",
    });
  }

  return alerts;
}

export function getBlockingAlerts(alerts: LabAlert[]): LabAlert[] {
  return alerts.filter((a) => a.severity === "blocking");
}

export function requiresImmediateReferral(alerts: LabAlert[]): boolean {
  return alerts.some((a) => a.severity === "blocking");
}

export interface RangeVersion {
  id: string;
  test: LabTestCode;
  version: number;
  ranges: LabReferenceRange[];
  updatedBy: string;
  updatedAt: number;
  changeReason: string;
}
