import { describe, it, expect } from "vitest";
import { ClinicalSuggestionEngine, type SuggestionInputs } from "./ClinicalSuggestionEngine";
import { Patient } from "@modules/patient/domain/Patient";
import { PatientId } from "@modules/patient/domain/PatientId";
import { ConsentId } from "@modules/patient/domain/ConsentId";
import { Anthropometry } from "@modules/anthropometry/domain/Anthropometry";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { Weight, Height, Circumference } from "@modules/anthropometry/domain/Measurements";
import { LabPanel } from "@modules/laboratory/domain/LabPanel";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { LabResult } from "@modules/laboratory/domain/LabResult";
import type { LabTestCode } from "@modules/laboratory/domain/LabTest";
import { Vitals } from "@modules/consultation/domain/Vitals";
import { calculateCKDepi2021 } from "@utils/calculations/labCalculations";

function makePatient(overrides: Partial<Parameters<typeof Patient.reconstitute>[0]> = {}): Patient {
  return Patient.reconstitute({
    id: PatientId.generate(),
    firstName: "Test",
    lastName: "Patient",
    secondLastName: null,
    birthDate: new Date("1980-01-01"),
    sex: "female",
    gender: null,
    maritalStatus: null,
    occupation: null,
    education: null,
    email: null,
    phone: null,
    secondaryPhone: null,
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactPhone: null,
    recordStatus: "active",
    recordOpenedAt: new Date(),
    generalNotes: null,
    consentimientoInformadoId: ConsentId.generate(),
    fechaFirmaConsentimiento: new Date(),
    versionPoliticaPrivacidad: null,
    clinicalTags: [],
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
}

function makeAnthropometry(weightKg: number, heightCm: number, waistCm: number | null = null, hipCm: number | null = null): Anthropometry {
  return Anthropometry.reconstitute({
    id: AnthropometryId.generate(),
    patientId: PatientId.generate(),
    measuredAt: new Date(),
    weight: Weight.fromKg(weightKg),
    height: Height.fromCentimeters(heightCm),
    circumferences: {
      waist: waistCm !== null ? Circumference.fromCm(waistCm) : undefined,
      hip: hipCm !== null ? Circumference.fromCm(hipCm) : undefined,
    },
    skinfolds: {},
    bia: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

function makeLabPanel(tests: Partial<Record<LabTestCode, number>>): LabPanel {
  const codes = Object.keys(tests) as LabTestCode[];
  const results = codes.map((code) =>
    LabResult.from({
      test: code,
      value: tests[code]!,
    }),
  );
  return LabPanel.reconstitute({
    id: LabPanelId.generate(),
    patientId: PatientId.generate(),
    takenAt: new Date(),
    labName: null,
    results,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

function makeInputs(overrides: Partial<SuggestionInputs> = {}): SuggestionInputs {
  return {
    patient: makePatient(),
    anthropometry: null,
    labPanel: null,
    vitals: null,
    ...overrides,
  };
}

describe("ClinicalSuggestionEngine.suggestDiagnoses", () => {
  const engine = new ClinicalSuggestionEngine();

  it("retorna lista vac\u00eda sin inputs", () => {
    expect(engine.suggestDiagnoses(makeInputs())).toEqual([]);
  });

  it("detecta bajo peso con IMC < 18.5", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(45, 170) });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "bajo_peso")).toBe(true);
  });

  it("detecta sobrepeso", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(75, 170) });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "sobrepeso")).toBe(true);
  });

  it("detecta obesidad grado 1, 2 y 3 seg\u00fan IMC", () => {
    expect(engine.suggestDiagnoses(makeInputs({ anthropometry: makeAnthropometry(88, 170) })).some((s) => s.code === "obesidad_grado_1")).toBe(true);
    expect(engine.suggestDiagnoses(makeInputs({ anthropometry: makeAnthropometry(105, 170) })).some((s) => s.code === "obesidad_grado_2")).toBe(true);
    expect(engine.suggestDiagnoses(makeInputs({ anthropometry: makeAnthropometry(120, 170) })).some((s) => s.code === "obesidad_grado_3")).toBe(true);
  });

  it("detecta diabetes con glucosa en ayunas \u2265 126", () => {
    const inputs = makeInputs({ labPanel: makeLabPanel({ GLUCOSA: 130 }) });
    const result = engine.suggestDiagnoses(inputs);
    const dx = result.find((s) => s.code === "diabetes_tipo_2");
    expect(dx).toBeDefined();
    expect(dx?.confidence).toBe("high");
  });

  it("detecta prediabetes con glucosa 100-125", () => {
    const inputs = makeInputs({ labPanel: makeLabPanel({ GLUCOSA: 110 }) });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "prediabetes")).toBe(true);
  });

  it("detecta resistencia a la insulina con HOMA-IR \u2265 2.5", () => {
    const inputs = makeInputs({
      labPanel: makeLabPanel({ GLUCOSA: 100, INSULINA: 12 }),
    });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "resistencia_insulinica")).toBe(true);
  });

  it("detecta hipercolesterolemia", () => {
    const inputs = makeInputs({ labPanel: makeLabPanel({ COLESTEROL_TOTAL: 250 }) });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "hipercolesterolemia")).toBe(true);
  });

  it("detecta hipertrigliceridemia", () => {
    const inputs = makeInputs({ labPanel: makeLabPanel({ TRIGLICERIDOS: 220 }) });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "hipertrigliceridemia")).toBe(true);
  });

  it("detecta anemia seg\u00fan sexo del paciente", () => {
    const femaleInputs = makeInputs({
      patient: makePatient({ sex: "female" }),
      labPanel: makeLabPanel({ HEMOGLOBINA: 10 }),
    });
    expect(engine.suggestDiagnoses(femaleInputs).some((s) => s.code === "anemia")).toBe(true);

    const maleInputs = makeInputs({
      patient: makePatient({ sex: "male" }),
      labPanel: makeLabPanel({ HEMOGLOBINA: 11 }),
    });
    expect(engine.suggestDiagnoses(maleInputs).some((s) => s.code === "anemia")).toBe(true);
  });

  it("detecta hipertensi\u00f3n por tensi\u00f3n arterial elevada", () => {
    const inputs = makeInputs({ vitals: Vitals.from({ systolicMmHg: 150, diastolicMmHg: 95 }) });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "hipertension_arterial")).toBe(true);
  });

  it("detecta enfermedad renal cr\u00f3nica con creatinina elevada (eGFR < 60)", () => {
    const age = 60;
    const egfr = calculateCKDepi2021({ creatinineMgDl: 2.0, ageYears: age, sex: "female" });
    expect(egfr).toBeLessThan(60);
    const inputs = makeInputs({
      patient: makePatient({ sex: "female", birthDate: new Date(`1966-01-01`) }),
      labPanel: makeLabPanel({ CREATININA: 2.0 }),
    });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "enfermedad_renal_cronica")).toBe(true);
  });

  it("detecta sospecha de h\u00edgado graso con enzimas elevadas + sobrepeso", () => {
    const inputs = makeInputs({
      anthropometry: makeAnthropometry(80, 170),
      labPanel: makeLabPanel({ TGP_ALT: 60, TGO_AST: 50, GGT: 80 }),
    });
    const result = engine.suggestDiagnoses(inputs);
    expect(result.some((s) => s.code === "higado_graso_no_alcoholico")).toBe(true);
  });

  it("detecta disfunci\u00f3n tiroidea con TSH alterada", () => {
    const high = makeInputs({ labPanel: makeLabPanel({ TSH: 6.0 }) });
    expect(engine.suggestDiagnoses(high).some((s) => s.code === "tiroideo")).toBe(true);
    const low = makeInputs({ labPanel: makeLabPanel({ TSH: 0.2 }) });
    expect(engine.suggestDiagnoses(low).some((s) => s.code === "tiroideo")).toBe(true);
  });

  it("detecta riesgo cardiometab\u00f3lico por RCC elevada seg\u00fan sexo", () => {
    const femaleInputs = makeInputs({
      patient: makePatient({ sex: "female" }),
      anthropometry: makeAnthropometry(70, 165, 95, 100),
    });
    expect(engine.suggestDiagnoses(femaleInputs).some((s) => s.code === "sindrome_metabolico")).toBe(true);
  });

  it("ordena resultados por confianza descendente", () => {
    const inputs = makeInputs({
      anthropometry: makeAnthropometry(110, 170),
      labPanel: makeLabPanel({ GLUCOSA: 130, COLESTEROL_TOTAL: 250 }),
      vitals: Vitals.from({ systolicMmHg: 150, diastolicMmHg: 95 }),
    });
    const result = engine.suggestDiagnoses(inputs);
    const ranks = result.map((s) => (s.confidence === "high" ? 3 : s.confidence === "medium" ? 2 : 1));
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i - 1]).toBeGreaterThanOrEqual(ranks[i]);
    }
  });

  it("devuelve evidencia para cada sugerencia", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(95, 170) });
    const result = engine.suggestDiagnoses(inputs);
    const dx = result.find((s) => s.code === "obesidad_grado_1");
    expect(dx).toBeDefined();
    expect(dx?.evidence.length).toBeGreaterThan(0);
    expect(dx?.evidence[0].kind).toBe("anthropometry");
  });
});

describe("ClinicalSuggestionEngine.suggestMealPlanTargets", () => {
  const engine = new ClinicalSuggestionEngine();

  it("retorna null si no hay antropometr\u00eda", () => {
    expect(engine.suggestMealPlanTargets(makeInputs())).toBeNull();
  });

  it("retorna null si el sexo no es binario (reglas BMR no aplican)", () => {
    const inputs = makeInputs({
      patient: makePatient({ sex: "intersex" }),
      anthropometry: makeAnthropometry(70, 170),
    });
    expect(engine.suggestMealPlanTargets(inputs)).toBeNull();
  });

  it("objetivo = p\u00e9rdida cuando IMC \u2265 25", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(80, 170) });
    const result = engine.suggestMealPlanTargets(inputs, "sedentary");
    expect(result).not.toBeNull();
    expect(result!.goal).toBe("loss");
    expect(result!.kcalTarget).toBeLessThan(result!.tdeeKcal);
  });

  it("objetivo = ganancia cuando IMC < 18.5", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(45, 170) });
    const result = engine.suggestMealPlanTargets(inputs, "sedentary");
    expect(result!.goal).toBe("gain");
    expect(result!.kcalTarget).toBeGreaterThan(result!.tdeeKcal);
  });

  it("objetivo = mantenimiento cuando IMC 18.5\u201324.9", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(60, 170) });
    const result = engine.suggestMealPlanTargets(inputs, "sedentary");
    expect(result!.goal).toBe("maintenance");
    expect(result!.kcalTarget).toBe(result!.tdeeKcal);
  });

  it("kcal objetivo es mayor para nivel de actividad m\u00e1s alto", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(60, 170) });
    const sedentary = engine.suggestMealPlanTargets(inputs, "sedentary")!;
    const active = engine.suggestMealPlanTargets(inputs, "active")!;
    expect(active.tdeeKcal).toBeGreaterThan(sedentary.tdeeKcal);
  });

  it("la distribuci\u00f3n suma 100%", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(80, 170) });
    const result = engine.suggestMealPlanTargets(inputs, "moderate")!;
    const sum = result.distribution.carbsPct + result.distribution.proteinPct + result.distribution.fatPct;
    expect(sum).toBe(100);
  });

  it("macros en gramos cuadran con kcal objetivo (tolerancia 10 kcal)", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(70, 170) });
    const result = engine.suggestMealPlanTargets(inputs, "moderate")!;
    const recomputed = result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9;
    expect(Math.abs(recomputed - result.kcalTarget)).toBeLessThanOrEqual(10);
  });

  it("incluye f\u00f3rmula BMR y rationale", () => {
    const inputs = makeInputs({ anthropometry: makeAnthropometry(70, 170) });
    const result = engine.suggestMealPlanTargets(inputs, "moderate")!;
    expect(result.bmrFormula).toBe("mifflin-st-jeor");
    expect(result.rationale).toMatch(/TDEE/);
  });
});
