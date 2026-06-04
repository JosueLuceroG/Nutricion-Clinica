/**
 * Motor de sugerencias cl\u00ednicas (Fase 3, Sprint 13).
 *
 * Genera dos tipos de recomendaciones a partir del estado cl\u00ednico del paciente:
 *
 *  1. **Sugerencias diagn\u00f3sticas** (`suggestDiagnoses`): basadas en antropometr\u00eda,
 *     laboratorio, signos vitales e historia (RN-EXP-11: las etiquetas cl\u00ednicas se
 *     generan a partir de reglas).
 *  2. **Sugerencia de plan base** (`suggestMealPlanTargets`): calcula kcal y
 *     distribuci\u00f3n de macronutrientes ajustadas al objetivo (p\u00e9rdida/mantenimiento/ganancia).
 *
 * El motor NUNCA diagnostica ni prescribe (RN-EXP-12). Las sugerencias se presentan
 * como `confidence` (low/medium/high) con `evidence[]` para que la nutri\u00f3loga
 * decida qu\u00e9 acepta.
 *
 * El sistema **no** implementa SNOMED CT completo: usa un subconjunto de c\u00f3digos
 * can\u00f3nicos para consulta nutricional adulta (ver `DiagnosticCode`).
 */
import type { Patient } from "@modules/patient/domain/Patient";
import type { Vitals } from "@modules/consultation/domain/Vitals";
import type { Anthropometry } from "@modules/anthropometry/domain/Anthropometry";
import type { LabPanel } from "@modules/laboratory/domain/LabPanel";
import type { LabTestCode } from "@modules/laboratory/domain/LabTest";
import { calculateBMR, type BMRFormula } from "@utils/calculations/bmr";
import { calculateTDEE, ActivityLevel, type ActivityLevelKey, type MacroDistribution } from "@utils/calculations/tdee";
import { calculateHOMA, HOMAThreshold, interpretHOMA } from "@utils/calculations/labCalculations";
import type {
  DiagnosticSuggestion,
  EvidenceRef,
  PlanTargetSuggestion,
  Confidence,
} from "../domain/Suggestion";
import { DiagnosticCodeLabel } from "../domain/Suggestion";

const BMI_UNDERWEIGHT = 18.5;
const BMI_OVERWEIGHT = 25;
const BMI_OBESITY_1 = 30;
const BMI_OBESITY_2 = 35;
const BMI_OBESITY_3 = 40;

const WAIST_HIP_RISK_MALE = 0.95;
const WAIST_HIP_RISK_FEMALE = 0.85;

const SYSTOLIC_HIGH = 130;
const DIASTOLIC_HIGH = 85;
const FASTING_GLUCOSE_IMPAIRED = 100;
const FASTING_GLUCOSE_DIABETES = 126;
const HBA1C_IMPAIRED = 5.7;
const HBA1C_DIABETES = 6.5;
const CHOLESTEROL_HIGH = 200;
const CHOLESTEROL_VERY_HIGH = 240;
const TRIGLYCERIDES_HIGH = 150;
const TRIGLYCERIDES_VERY_HIGH = 200;
const HDL_LOW_MALE = 40;
const HDL_LOW_FEMALE = 50;
const HEMOGLOBIN_LOW_MALE = 13;
const HEMOGLOBIN_LOW_FEMALE = 12;
const EGFR_REDUCED = 60;
const EGFR_STAGE_3A = 45;
const ALT_UPPER_LIMIT = 40;
const AST_UPPER_LIMIT = 40;
const GGT_UPPER_LIMIT = 50;
const TSH_ABNORMAL_LOW = 0.4;
const TSH_ABNORMAL_HIGH = 4.0;

export interface SuggestionInputs {
  patient: Patient;
  anthropometry: Anthropometry | null;
  labPanel: LabPanel | null;
  vitals: Vitals | null;
}

function ageYears(birth: Date, now = new Date()): number {
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function fmt(n: number | null, suffix = ""): string {
  return n === null || n === undefined ? "—" : `${n}${suffix}`;
}

function sexBinary(sex: Patient["sex"]): "male" | "female" | null {
  return sex === "male" || sex === "female" ? sex : null;
}

export class ClinicalSuggestionEngine {
  constructor() {}

  /**
   * Genera sugerencias diagn\u00f3sticas a partir del estado cl\u00ednico actual.
   * Devuelve una lista ordenada por confianza descendente.
   */
  suggestDiagnoses(inputs: SuggestionInputs): DiagnosticSuggestion[] {
    const suggestions: DiagnosticSuggestion[] = [];
    const { patient, anthropometry, labPanel, vitals } = inputs;
    const sex = sexBinary(patient.sex);
    const age = ageYears(patient.birthDate);
    const bmi = anthropometry?.bmi ?? null;

    if (bmi !== null) {
      if (bmi < BMI_UNDERWEIGHT) {
        suggestions.push({
          code: "bajo_peso",
          label: "Bajo peso",
          confidence: bmi < 17 ? "high" : "medium",
          rationale: `IMC ${bmi.toFixed(1)} por debajo de ${BMI_UNDERWEIGHT}`,
          evidence: [
            {
              kind: "anthropometry",
              description: "IMC calculado desde peso y talla",
              value: bmi.toFixed(1),
            },
          ],
        });
      } else if (bmi >= BMI_OBESITY_3) {
        suggestions.push({
          code: "obesidad_grado_3",
          label: "Obesidad grado III",
          confidence: "high",
          rationale: `IMC ${bmi.toFixed(1)} ≥ ${BMI_OBESITY_3}`,
          evidence: [{ kind: "anthropometry", description: "IMC", value: bmi.toFixed(1) }],
        });
      } else if (bmi >= BMI_OBESITY_2) {
        suggestions.push({
          code: "obesidad_grado_2",
          label: "Obesidad grado II",
          confidence: "high",
          rationale: `IMC ${bmi.toFixed(1)} en rango ${BMI_OBESITY_2}–${BMI_OBESITY_3 - 0.1}`,
          evidence: [{ kind: "anthropometry", description: "IMC", value: bmi.toFixed(1) }],
        });
      } else if (bmi >= BMI_OBESITY_1) {
        suggestions.push({
          code: "obesidad_grado_1",
          label: "Obesidad grado I",
          confidence: "high",
          rationale: `IMC ${bmi.toFixed(1)} en rango ${BMI_OBESITY_1}–${BMI_OBESITY_2 - 0.1}`,
          evidence: [{ kind: "anthropometry", description: "IMC", value: bmi.toFixed(1) }],
        });
      } else if (bmi >= BMI_OVERWEIGHT) {
        suggestions.push({
          code: "sobrepeso",
          label: "Sobrepeso",
          confidence: "medium",
          rationale: `IMC ${bmi.toFixed(1)} en rango ${BMI_OVERWEIGHT}–${BMI_OBESITY_1 - 0.1}`,
          evidence: [{ kind: "anthropometry", description: "IMC", value: bmi.toFixed(1) }],
        });
      }
    }

    if (labPanel) {
      const glucose = labPanel.getValue("GLUCOSA");
      const hba1c = labPanel.getValue("HBA1C");
      const insulin = labPanel.getValue("INSULINA");
      const cholesterol = labPanel.getValue("COLESTEROL_TOTAL");
      const hdl = labPanel.getValue("HDL");
      const ldl = labPanel.getValue("LDL");
      const triglycerides = labPanel.getValue("TRIGLICERIDOS");
      const hemoglobin = labPanel.getValue("HEMOGLOBINA");
      const creatinine = labPanel.getValue("CREATININA");
      const ast = labPanel.getValue("TGO_AST");
      const alt = labPanel.getValue("TGP_ALT");
      const ggt = labPanel.getValue("GGT");
      const tsh = labPanel.getValue("TSH");

      if (glucose !== null) {
        if (glucose >= FASTING_GLUCOSE_DIABETES) {
          suggestions.push({
            code: "diabetes_tipo_2",
            label: "Diabetes mellitus tipo 2",
            confidence: "high",
            rationale: `Glucosa en ayunas ${glucose} mg/dL ≥ ${FASTING_GLUCOSE_DIABETES}`,
            evidence: [evLab("GLUCOSA", glucose, "mg/dL")],
          });
        } else if (glucose >= FASTING_GLUCOSE_IMPAIRED) {
          suggestions.push({
            code: "prediabetes",
            label: "Prediabetes",
            confidence: "medium",
            rationale: `Glucosa en ayunas ${glucose} mg/dL en rango ${FASTING_GLUCOSE_IMPAIRED}–${FASTING_GLUCOSE_DIABETES - 1}`,
            evidence: [evLab("GLUCOSA", glucose, "mg/dL")],
          });
        }
      }

      if (hba1c !== null) {
        if (hba1c >= HBA1C_DIABETES) {
          suggestions.push({
            code: "diabetes_tipo_2",
            label: "Diabetes mellitus tipo 2",
            confidence: "high",
            rationale: `HbA1c ${hba1c}% ≥ ${HBA1C_DIABETES}`,
            evidence: [evLab("HBA1C", hba1c, "%")],
          });
        } else if (hba1c >= HBA1C_IMPAIRED) {
          suggestions.push({
            code: "prediabetes",
            label: "Prediabetes",
            confidence: "medium",
            rationale: `HbA1c ${hba1c}% en rango ${HBA1C_IMPAIRED}–${(HBA1C_DIABETES - 0.1).toFixed(1)}`,
            evidence: [evLab("HBA1C", hba1c, "%")],
          });
        }
      }

      if (insulin !== null && glucose !== null && glucose > 0) {
        try {
          const homa = calculateHOMA({ insulinUUiMl: insulin, glucoseMgDl: glucose });
          const interp = interpretHOMA(homa);
          if (interp === "resistente") {
            suggestions.push({
              code: "resistencia_insulinica",
              label: "Resistencia a la insulina",
              confidence: "medium",
              rationale: `HOMA-IR ${homa.toFixed(2)} ≥ ${HOMAThreshold}`,
              evidence: [evLab("INSULINA", insulin, "µUI/mL"), evLab("GLUCOSA", glucose, "mg/dL")],
            });
          }
        } catch {
          /* valores inválidos — no se sugieren */
        }
      }

      if (cholesterol !== null && cholesterol >= CHOLESTEROL_VERY_HIGH) {
        suggestions.push({
          code: "hipercolesterolemia",
          label: "Hipercolesterolemia",
          confidence: "high",
          rationale: `Colesterol total ${cholesterol} mg/dL ≥ ${CHOLESTEROL_VERY_HIGH}`,
          evidence: [evLab("COLESTEROL_TOTAL", cholesterol, "mg/dL")],
        });
      } else if (cholesterol !== null && cholesterol >= CHOLESTEROL_HIGH) {
        suggestions.push({
          code: "hipercolesterolemia",
          label: "Hipercolesterolemia",
          confidence: "medium",
          rationale: `Colesterol total ${cholesterol} mg/dL ≥ ${CHOLESTEROL_HIGH}`,
          evidence: [evLab("COLESTEROL_TOTAL", cholesterol, "mg/dL")],
        });
      }

      if (triglycerides !== null) {
        if (triglycerides >= TRIGLYCERIDES_VERY_HIGH) {
          suggestions.push({
            code: "hipertrigliceridemia",
            label: "Hipertrigliceridemia",
            confidence: "high",
            rationale: `Triglicéridos ${triglycerides} mg/dL ≥ ${TRIGLYCERIDES_VERY_HIGH}`,
            evidence: [evLab("TRIGLICERIDOS", triglycerides, "mg/dL")],
          });
        } else if (triglycerides >= TRIGLYCERIDES_HIGH) {
          suggestions.push({
            code: "hipertrigliceridemia",
            label: "Hipertrigliceridemia",
            confidence: "medium",
            rationale: `Triglicéridos ${triglycerides} mg/dL ≥ ${TRIGLYCERIDES_HIGH}`,
            evidence: [evLab("TRIGLICERIDOS", triglycerides, "mg/dL")],
          });
        }
      }

      if (cholesterol !== null && triglycerides !== null && triglycerides >= TRIGLYCERIDES_HIGH && cholesterol >= CHOLESTEROL_HIGH) {
        suggestions.push({
          code: "dislipidemia_mixta",
          label: "Dislipidemia mixta",
          confidence: "medium",
          rationale: "Colesterol y triglicéridos elevados de forma concurrente",
          evidence: [
            evLab("COLESTEROL_TOTAL", cholesterol, "mg/dL"),
            evLab("TRIGLICERIDOS", triglycerides, "mg/dL"),
          ],
        });
      }

      if (hdl !== null && sex) {
        const threshold = sex === "male" ? HDL_LOW_MALE : HDL_LOW_FEMALE;
        if (hdl < threshold) {
          suggestions.push({
            code: "dislipidemia_mixta",
            label: "HDL bajo (factor de riesgo cardiovascular)",
            confidence: "low",
            rationale: `HDL ${hdl} mg/dL por debajo del umbral (${threshold} mg/dL para ${sex === "male" ? "hombres" : "mujeres"})`,
            evidence: [evLab("HDL", hdl, "mg/dL")],
          });
        }
      }

      if (ldl !== null && ldl >= 160) {
        suggestions.push({
          code: "hipercolesterolemia",
          label: "LDL elevado",
          confidence: ldl >= 190 ? "high" : "medium",
          rationale: `LDL ${ldl} mg/dL ≥ 160`,
          evidence: [evLab("LDL", ldl, "mg/dL")],
        });
      }

      if (hemoglobin !== null && sex) {
        const threshold = sex === "male" ? HEMOGLOBIN_LOW_MALE : HEMOGLOBIN_LOW_FEMALE;
        if (hemoglobin < threshold) {
          suggestions.push({
            code: "anemia",
            label: "Anemia",
            confidence: "medium",
            rationale: `Hemoglobina ${hemoglobin} g/dL < ${threshold}`,
            evidence: [evLab("HEMOGLOBINA", hemoglobin, "g/dL")],
          });
        }
      }

      if (creatinine !== null && sex) {
        const egfr = estimateEgfr(creatinine, age, sex);
        if (egfr < EGFR_STAGE_3A) {
          suggestions.push({
            code: "enfermedad_renal_cronica",
            label: "Enfermedad renal crónica (G3b o peor)",
            confidence: "high",
            rationale: `eGFR estimado ${egfr} mL/min/1.73m² < ${EGFR_STAGE_3A}`,
            evidence: [evLab("CREATININA", creatinine, "mg/dL")],
          });
        } else if (egfr < EGFR_REDUCED) {
          suggestions.push({
            code: "enfermedad_renal_cronica",
            label: "Enfermedad renal crónica (G3a)",
            confidence: "medium",
            rationale: `eGFR estimado ${egfr} mL/min/1.73m² < ${EGFR_REDUCED}`,
            evidence: [evLab("CREATININA", creatinine, "mg/dL")],
          });
        }
      }

      const liverEnzymesElevated = (ast ?? 0) > AST_UPPER_LIMIT || (alt ?? 0) > ALT_UPPER_LIMIT || (ggt ?? 0) > GGT_UPPER_LIMIT;
      if (liverEnzymesElevated && bmi !== null && bmi >= BMI_OVERWEIGHT) {
        suggestions.push({
          code: "higado_graso_no_alcoholico",
          label: "Hígado graso no alcohólico (sospecha)",
          confidence: "low",
          rationale: "Enzimas hepáticas elevadas con IMC en rango de sobrepeso/obesidad",
          evidence: [
            evLab("TGO_AST", ast, "U/L"),
            evLab("TGP_ALT", alt, "U/L"),
            evLab("GGT", ggt, "U/L"),
            { kind: "anthropometry", description: "IMC", value: bmi.toFixed(1) },
          ],
        });
      }

      if (tsh !== null && (tsh < TSH_ABNORMAL_LOW || tsh > TSH_ABNORMAL_HIGH)) {
        suggestions.push({
          code: "tiroideo",
          label: DiagnosticCodeLabel.tiroideo,
          confidence: "low",
          rationale: `TSH ${tsh} µUI/mL fuera del rango ${TSH_ABNORMAL_LOW}–${TSH_ABNORMAL_HIGH}`,
          evidence: [evLab("TSH", tsh, "µUI/mL")],
        });
      }
    }

    if (vitals && !vitals.isEmpty) {
      const sys = vitals.systolicMmHg;
      const dia = vitals.diastolicMmHg;
      if ((sys !== null && sys >= SYSTOLIC_HIGH) || (dia !== null && dia >= DIASTOLIC_HIGH)) {
        suggestions.push({
          code: "hipertension_arterial",
          label: "Hipertensión arterial",
          confidence: sys !== null && sys >= 140 ? "high" : "medium",
          rationale: `Presión arterial ${fmt(sys)}/${fmt(dia)} mmHg`,
          evidence: [
            { kind: "vitals", description: "Tensión arterial", value: `${fmt(sys)}/${fmt(dia)} mmHg` },
          ],
        });
      }
    }

    if (bmi !== null && anthropometry && sex) {
      const waist = anthropometry.circumferences.waist?.toCm() ?? null;
      const hip = anthropometry.circumferences.hip?.toCm() ?? null;
      if (waist !== null && hip !== null) {
        const ratio = waist / hip;
        const threshold = sex === "male" ? WAIST_HIP_RISK_MALE : WAIST_HIP_RISK_FEMALE;
        if (ratio > threshold) {
          suggestions.push({
            code: "sindrome_metabolico",
            label: "Riesgo cardiometabólico (RCC elevada)",
            confidence: "low",
            rationale: `Relación cintura-cadera ${ratio.toFixed(2)} > ${threshold}`,
            evidence: [
              { kind: "anthropometry", description: "Cintura", value: waist },
              { kind: "anthropometry", description: "Cadera", value: hip },
            ],
          });
        }
      }
    }

    return suggestions.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));
  }

  /**
   * Sugiere objetivos de plan alimentario a partir del BMR, nivel de actividad
   * y el IMC actual. Si el paciente tiene sobrepeso/obesidad sugiere d\u00e9ficit;
   * si tiene bajo peso sugiere super\u00e1vit; en caso contrario mantenimiento.
   *
   * @param activityLevel Nivel de actividad reportado por el paciente
   *   (o inferido de PhysicalActivity). Default: sedentary.
   */
  suggestMealPlanTargets(
    inputs: SuggestionInputs,
    activityLevel: ActivityLevelKey = "sedentary",
    formula: BMRFormula = "mifflin-st-jeor",
  ): PlanTargetSuggestion | null {
    const { patient, anthropometry } = inputs;
    const sex = sexBinary(patient.sex);
    if (!sex) return null;
    if (!anthropometry) return null;
    if (patient.birthDate === null) return null;

    const age = ageYears(patient.birthDate);
    const weightKg = anthropometry.weight.toKg();
    const heightCm = anthropometry.height.toCentimeters();

    const bmr = calculateBMR({
      sex,
      weightKg,
      heightCm,
      ageYears: age,
    }, formula);
    const tdee = calculateTDEE(bmr.value, ActivityLevel[activityLevel]);
    const bmi = anthropometry.bmi;
    const goal: "loss" | "maintenance" | "gain" =
      bmi >= BMI_OVERWEIGHT ? "loss" : bmi < BMI_UNDERWEIGHT ? "gain" : "maintenance";

    const kcalTarget = goal === "loss" ? Math.round(tdee * 0.8) : goal === "gain" ? Math.round(tdee * 1.15) : tdee;

    const dist: MacroDistribution =
      goal === "loss"
        ? { carbsPct: 40, proteinPct: 30, fatPct: 30 }
        : goal === "gain"
          ? { carbsPct: 50, proteinPct: 25, fatPct: 25 }
          : { carbsPct: 50, proteinPct: 20, fatPct: 30 };

    const proteinG = Math.round((kcalTarget * dist.proteinPct) / 100 / 4);
    const carbsG = Math.round((kcalTarget * dist.carbsPct) / 100 / 4);
    const fatG = Math.round((kcalTarget * dist.fatPct) / 100 / 9);

    const rationale =
      goal === "loss"
        ? `IMC ${bmi.toFixed(1)} sugiere d\u00e9ficit cal\u00f3rico del 20% sobre TDEE (${tdee} kcal)`
        : goal === "gain"
          ? `IMC ${bmi.toFixed(1)} sugiere super\u00e1vit del 15% sobre TDEE (${tdee} kcal)`
          : `IMC ${bmi.toFixed(1)} en rango normal: TDEE (${tdee} kcal) como objetivo`;

    return {
      bmrKcal: bmr.value,
      bmrFormula: formula,
      activityLevel,
      tdeeKcal: tdee,
      goal,
      kcalTarget,
      proteinG,
      carbsG,
      fatG,
      distribution: dist,
      rationale,
    };
  }
}

function evLab(test: LabTestCode, value: number | null, unit: string): EvidenceRef {
  return { kind: "lab", description: test, value: value === null ? null : `${value} ${unit}` };
}

function confidenceRank(c: Confidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

function estimateEgfr(creatinine: number, age: number, sex: "male" | "female"): number {
  const kappa = sex === "male" ? 0.9 : 0.7;
  const alpha = sex === "male" ? -0.302 : -0.241;
  const sexFactor = sex === "female" ? 1.012 : 1.0;
  const scrK = creatinine / kappa;
  const f = scrK < 1 ? Math.pow(scrK, alpha) : Math.pow(scrK, -1.2);
  const ageFactor = Math.pow(0.9938, age);
  const egfr = 142 * f * ageFactor * sexFactor;
  return Math.round(egfr * 10) / 10;
}
