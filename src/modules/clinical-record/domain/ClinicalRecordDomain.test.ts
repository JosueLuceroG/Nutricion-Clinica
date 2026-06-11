import { describe, it, expect } from "vitest";
import { Allergy, SeveritySchema, SeverityLabel, AllergyDiagnosisSchema, AllergyDiagnosisLabel } from "./Allergy";
import { AllergyId } from "./AllergyId";
import { Medication } from "./Medication";
import { ClinicalEvent } from "./ClinicalEvent";
import { DietHistory, DietTypeSchema, DietTypeLabel, MealPlaceSchema, MealPlaceLabel } from "./DietHistory";
import { FamilyHistory, FamilyRelationshipSchema, FamilyRelationshipLabel, ConditionSchema, ConditionLabel } from "./FamilyHistory";
import { FoodFrequency, FrequencyValueSchema, FrequencyValueLabel } from "./FoodFrequency";
import { GiSymptom, GiSymptomTypeSchema, GiSymptomTypeLabel } from "./GiSymptom";
import { Habit, HabitCategorySchema, HabitCategoryLabel } from "./Habit";
import { Hospitalization } from "./Hospitalization";
import { Intolerance, MechanismSchema, MechanismLabel, IntoleranceSeveritySchema, IntoleranceSeverityLabel } from "./Intolerance";
import { PersonalHistory, PersonalConditionSchema, PersonalConditionLabel } from "./PersonalHistory";
import { PhysicalActivity, ActivityTypeSchema, ActivityTypeLabel, BorgIntensitySchema, BorgIntensityLabel } from "./PhysicalActivity";
import { Supplement, SupplementCategorySchema, SupplementCategoryLabel } from "./Supplement";
import { Surgery, SurgeryTypeSchema, SurgeryTypeLabel } from "./Surgery";
import { SnapshotExpediente, computeIntegrityHash } from "./SnapshotExpediente";
import { PatientId } from "@modules/patient/domain/PatientId";

describe("Allergy severity", () => {
  it("has labels for all severities", () => {
    const values = SeveritySchema.options;
    for (const v of values) {
      expect(SeverityLabel[v]).toBeDefined();
      expect(SeverityLabel[v].length).toBeGreaterThan(0);
    }
  });
});

describe("Allergy diagnosis", () => {
  it("has labels for all diagnosis types", () => {
    const values = AllergyDiagnosisSchema.options;
    for (const v of values) {
      expect(AllergyDiagnosisLabel[v]).toBeDefined();
      expect(AllergyDiagnosisLabel[v].length).toBeGreaterThan(0);
    }
  });
});

describe("Allergy", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    allergen: "Polen",
    reaction: "Estornudos",
    severity: "moderada" as const,
    diagnosis: "prick" as const,
  });

  it("creates with valid input", () => {
    const a = Allergy.create(valid());
    expect(a.id).toBeInstanceOf(AllergyId);
    expect(a.allergen).toBe("Polen");
    expect(a.reaction).toBe("Estornudos");
    expect(a.severity).toBe("moderada");
    expect(a.diagnosis).toBe("prick");
    expect(a.notes).toBeNull();
  });

  it("rejects short allergen", () => {
    expect(() => Allergy.create({ ...valid(), allergen: "A" })).toThrow("2 caracteres");
  });

  it("rejects short reaction", () => {
    expect(() => Allergy.create({ ...valid(), reaction: "R" })).toThrow("2 caracteres");
  });

  it("reconstitutes from props", () => {
    const original = Allergy.create(valid());
    const restored = Allergy.reconstitute(original.toProps());
    expect(restored.id.equals(original.id)).toBe(true);
  });

  it("withUpdates merges fields", () => {
    const a = Allergy.create(valid());
    const updated = a.withUpdates({ severity: "severa", notes: "Evolucionó" });
    expect(updated.severity).toBe("severa");
    expect(updated.notes).toBe("Evolucionó");
    expect(updated.allergen).toBe(a.allergen);
  });
});

describe("Medication", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    name: "Metformina",
    activeIngredient: "Metformina clorhidrato",
    dose: "850 mg",
    frequency: "cada-12h" as const,
    startDate: "2026-01-01",
  });

  it("creates with valid input", () => {
    const m = Medication.create(valid());
    expect(m.name).toBe("Metformina");
    expect(m.dose).toBe("850 mg");
    expect(m.frequency).toBe("cada-12h");
    expect(m.route).toBe("oral");
    expect(m.isActive).toBe(true);
  });

  it("rejects short name", () => {
    expect(() => Medication.create({ ...valid(), name: "X" })).toThrow("2 caracteres");
  });

  it("rejects short active ingredient", () => {
    expect(() => Medication.create({ ...valid(), activeIngredient: "X" })).toThrow("2 caracteres");
  });

  it("isActive returns false when endDate is past", () => {
    const m = Medication.create({ ...valid(), endDate: "2020-01-01" });
    expect(m.isActive).toBe(false);
  });

  it("reconstitutes from props", () => {
    const original = Medication.create(valid());
    const restored = Medication.reconstitute(original.toProps());
    expect(restored.name).toBe(original.name);
    expect(restored.frequency).toBe(original.frequency);
  });
});

describe("ClinicalEvent", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    type: "cirugia" as const,
    name: "Apendicectomía",
    date: "2026-03-15",
  });

  it("creates with valid input", () => {
    const e = ClinicalEvent.create(valid());
    expect(e.name).toBe("Apendicectomía");
    expect(e.type).toBe("cirugia");
    expect(e.description).toBeNull();
  });

  it("rejects short name", () => {
    expect(() => ClinicalEvent.create({ ...valid(), name: "A" })).toThrow("2 caracteres");
  });

  it("reconstitutes from props", () => {
    const original = ClinicalEvent.create(valid());
    const restored = ClinicalEvent.reconstitute(original.toProps());
    expect(restored.type).toBe(original.type);
  });
});

describe("DietHistory", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    dietType: "omnivoro" as const,
    mealsPerDay: 3,
  });

  it("tiene labels para todos los tipos de dieta", () => {
    const values = DietTypeSchema.options;
    for (const v of values) {
      expect(DietTypeLabel[v]).toBeDefined();
      expect(DietTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los lugares de comida", () => {
    const values = MealPlaceSchema.options;
    for (const v of values) {
      expect(MealPlaceLabel[v]).toBeDefined();
      expect(MealPlaceLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const d = DietHistory.create(valid());
    expect(d.dietType).toBe("omnivoro");
    expect(d.mealsPerDay).toBe(3);
    expect(d.mealPlace).toBe("hogar");
    expect(d.householdPeople).toBe(1);
    expect(d.labelReading).toBe(false);
  });

  it("rechaza mealsPerDay menor a 1", () => {
    expect(() => DietHistory.create({ ...valid(), mealsPerDay: 0 })).toThrow("1 y 20");
  });

  it("rechaza mealsPerDay mayor a 20", () => {
    expect(() => DietHistory.create({ ...valid(), mealsPerDay: 21 })).toThrow("1 y 20");
  });

  it("rechaza householdPeople mayor a 50", () => {
    expect(() => DietHistory.create({ ...valid(), householdPeople: 51 })).toThrow("1 y 50");
  });

  it("reconstituye desde props", () => {
    const original = DietHistory.create(valid());
    const restored = DietHistory.reconstitute(original.toProps());
    expect(restored.dietType).toBe(original.dietType);
    expect(restored.mealsPerDay).toBe(original.mealsPerDay);
  });
});

describe("FamilyHistory", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    relationship: "padre" as const,
    condition: "diabetes" as const,
  });

  it("tiene labels para todos los parentescos", () => {
    const values = FamilyRelationshipSchema.options;
    for (const v of values) {
      expect(FamilyRelationshipLabel[v]).toBeDefined();
      expect(FamilyRelationshipLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todas las condiciones", () => {
    const values = ConditionSchema.options;
    for (const v of values) {
      expect(ConditionLabel[v]).toBeDefined();
      expect(ConditionLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const f = FamilyHistory.create(valid());
    expect(f.relationship).toBe("padre");
    expect(f.condition).toBe("diabetes");
    expect(f.diagnosisAge).toBeNull();
    expect(f.notes).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = FamilyHistory.create(valid());
    const restored = FamilyHistory.reconstitute(original.toProps());
    expect(restored.relationship).toBe(original.relationship);
    expect(restored.condition).toBe(original.condition);
  });
});

describe("FoodFrequency", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    foodGroupId: "grupo-01",
    frequency: "diario" as const,
  });

  it("tiene labels para todos los valores de frecuencia", () => {
    const values = FrequencyValueSchema.options;
    for (const v of values) {
      expect(FrequencyValueLabel[v]).toBeDefined();
      expect(FrequencyValueLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const f = FoodFrequency.create(valid());
    expect(f.foodGroupId).toBe("grupo-01");
    expect(f.frequency).toBe("diario");
    expect(f.foodGroupName).toBe("");
    expect(f.quantity).toBe("");
  });

  it("reconstituye desde props", () => {
    const original = FoodFrequency.create(valid());
    const restored = FoodFrequency.reconstitute(original.toProps());
    expect(restored.frequency).toBe(original.frequency);
    expect(restored.foodGroupId).toBe(original.foodGroupId);
  });
});

describe("GiSymptom", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    symptomType: "reflujo" as const,
  });

  it("tiene labels para todos los tipos de síntoma GI", () => {
    const values = GiSymptomTypeSchema.options;
    for (const v of values) {
      expect(GiSymptomTypeLabel[v]).toBeDefined();
      expect(GiSymptomTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const g = GiSymptom.create(valid());
    expect(g.symptomType).toBe("reflujo");
    expect(g.severity).toBe(5);
    expect(g.description).toBe("");
    expect(g.foodRelation).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = GiSymptom.create(valid());
    const restored = GiSymptom.reconstitute(original.toProps());
    expect(restored.symptomType).toBe(original.symptomType);
    expect(restored.severity).toBe(original.severity);
  });
});

describe("Habit", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    category: "smoking" as const,
    status: "activo",
  });

  it("tiene labels para todas las categorías", () => {
    const values = HabitCategorySchema.options;
    for (const v of values) {
      expect(HabitCategoryLabel[v]).toBeDefined();
      expect(HabitCategoryLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const h = Habit.create(valid());
    expect(h.category).toBe("smoking");
    expect(h.status).toBe("activo");
    expect(h.frequency).toBeNull();
    expect(h.quantity).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = Habit.create(valid());
    const restored = Habit.reconstitute(original.toProps());
    expect(restored.category).toBe(original.category);
    expect(restored.status).toBe(original.status);
  });
});

describe("Hospitalization", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    reason: "Neumonía",
    admissionDate: "2026-03-01",
  });

  it("crea con entrada válida", () => {
    const h = Hospitalization.create(valid());
    expect(h.reason).toBe("Neumonía");
    expect(h.admissionDate).toBe("2026-03-01");
    expect(h.stayDays).toBe(0);
    expect(h.hospital).toBe("");
    expect(h.dischargeDate).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = Hospitalization.create(valid());
    const restored = Hospitalization.reconstitute(original.toProps());
    expect(restored.reason).toBe(original.reason);
    expect(restored.stayDays).toBe(original.stayDays);
  });
});

describe("Intolerance", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    food: "Leche",
    symptom: "Dolor abdominal",
    severity: "moderada" as const,
    mechanism: "lactosa" as const,
  });

  it("tiene labels para todos los mecanismos", () => {
    const values = MechanismSchema.options;
    for (const v of values) {
      expect(MechanismLabel[v]).toBeDefined();
      expect(MechanismLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todas las severidades", () => {
    const values = IntoleranceSeveritySchema.options;
    for (const v of values) {
      expect(IntoleranceSeverityLabel[v]).toBeDefined();
      expect(IntoleranceSeverityLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const i = Intolerance.create(valid());
    expect(i.food).toBe("Leche");
    expect(i.symptom).toBe("Dolor abdominal");
    expect(i.severity).toBe("moderada");
    expect(i.mechanism).toBe("lactosa");
  });

  it("rechaza food corto", () => {
    expect(() => Intolerance.create({ ...valid(), food: "L" })).toThrow("2 caracteres");
  });

  it("rechaza symptom corto", () => {
    expect(() => Intolerance.create({ ...valid(), symptom: "D" })).toThrow("2 caracteres");
  });

  it("reconstituye desde props", () => {
    const original = Intolerance.create(valid());
    const restored = Intolerance.reconstitute(original.toProps());
    expect(restored.food).toBe(original.food);
    expect(restored.severity).toBe(original.severity);
  });
});

describe("PersonalHistory", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    condition: "diabetes_tipo_2" as const,
  });

  it("tiene labels para todas las condiciones personales", () => {
    const values = PersonalConditionSchema.options;
    for (const v of values) {
      expect(PersonalConditionLabel[v]).toBeDefined();
      expect(PersonalConditionLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const p = PersonalHistory.create(valid());
    expect(p.condition).toBe("diabetes_tipo_2");
    expect(p.status).toBe("activo");
    expect(p.diagnosisDate).toBeNull();
    expect(p.treatingPhysician).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = PersonalHistory.create(valid());
    const restored = PersonalHistory.reconstitute(original.toProps());
    expect(restored.condition).toBe(original.condition);
    expect(restored.status).toBe(original.status);
  });
});

describe("PhysicalActivity", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    type: "caminata" as const,
    frequencyPerWeek: 3,
    durationMinutes: 30,
    intensity: "moderate" as const,
  });

  it("tiene labels para todos los tipos de actividad", () => {
    const values = ActivityTypeSchema.options;
    for (const v of values) {
      expect(ActivityTypeLabel[v]).toBeDefined();
      expect(ActivityTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todas las intensidades Borg", () => {
    const values = BorgIntensitySchema.options;
    for (const v of values) {
      expect(BorgIntensityLabel[v]).toBeDefined();
      expect(BorgIntensityLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const p = PhysicalActivity.create(valid());
    expect(p.type).toBe("caminata");
    expect(p.frequencyPerWeek).toBe(3);
    expect(p.durationMinutes).toBe(30);
    expect(p.intensity).toBe("moderate");
  });

  it("rechaza frequencyPerWeek menor a 0", () => {
    expect(() => PhysicalActivity.create({ ...valid(), frequencyPerWeek: -1 })).toThrow("0 y 14");
  });

  it("rechaza frequencyPerWeek mayor a 14", () => {
    expect(() => PhysicalActivity.create({ ...valid(), frequencyPerWeek: 15 })).toThrow("0 y 14");
  });

  it("rechaza durationMinutes menor a 1", () => {
    expect(() => PhysicalActivity.create({ ...valid(), durationMinutes: 0 })).toThrow("1 y 600");
  });

  it("rechaza durationMinutes mayor a 600", () => {
    expect(() => PhysicalActivity.create({ ...valid(), durationMinutes: 601 })).toThrow("1 y 600");
  });

  it("isActive devuelve true sin endDate", () => {
    const p = PhysicalActivity.create(valid());
    expect(p.isActive).toBe(true);
  });

  it("isActive devuelve false con endDate pasado", () => {
    const p = PhysicalActivity.create({ ...valid(), endDate: "2020-01-01" });
    expect(p.isActive).toBe(false);
  });

  it("reconstituye desde props", () => {
    const original = PhysicalActivity.create(valid());
    const restored = PhysicalActivity.reconstitute(original.toProps());
    expect(restored.type).toBe(original.type);
    expect(restored.frequencyPerWeek).toBe(original.frequencyPerWeek);
  });
});

describe("Supplement", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    name: "Vitamina D3",
  });

  it("tiene labels para todas las categorías", () => {
    const values = SupplementCategorySchema.options;
    for (const v of values) {
      expect(SupplementCategoryLabel[v]).toBeDefined();
      expect(SupplementCategoryLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const s = Supplement.create(valid());
    expect(s.name).toBe("Vitamina D3");
    expect(s.category).toBe("otro");
    expect(s.brand).toBe("");
    expect(s.prescribedBy).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = Supplement.create(valid());
    const restored = Supplement.reconstitute(original.toProps());
    expect(restored.name).toBe(original.name);
    expect(restored.category).toBe(original.category);
  });
});

describe("Surgery", () => {
  const valid = () => ({
    patientId: PatientId.generate(),
    type: "laparoscopica" as const,
    date: "2026-02-10",
  });

  it("tiene labels para todos los tipos de cirugía", () => {
    const values = SurgeryTypeSchema.options;
    for (const v of values) {
      expect(SurgeryTypeLabel[v]).toBeDefined();
      expect(SurgeryTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("crea con entrada válida", () => {
    const s = Surgery.create(valid());
    expect(s.type).toBe("laparoscopica");
    expect(s.date).toBe("2026-02-10");
    expect(s.hospital).toBe("");
    expect(s.complications).toBeNull();
  });

  it("reconstituye desde props", () => {
    const original = Surgery.create(valid());
    const restored = Surgery.reconstitute(original.toProps());
    expect(restored.type).toBe(original.type);
    expect(restored.date).toBe(original.date);
  });
});

describe("SnapshotExpediente", () => {
  const valid = () => ({
    consultaId: "cons-001",
    patientId: PatientId.generate().value,
    contenidoJsonExpediente: { nombre: "Paciente" },
    profesionalId: "prof-001",
  });

  it("crea con entrada válida", async () => {
    const s = await SnapshotExpediente.create(valid());
    expect(s.consultaId).toBe("cons-001");
    expect(s.profesionalId).toBe("prof-001");
    expect(s.versionSmae).toBe("1.0");
    expect(s.contenidoJsonExpediente).toBe(JSON.stringify({ nombre: "Paciente" }));
    expect(s.contenidoJsonAntropometria).toBeNull();
    expect(s.hashIntegridad).toBeTruthy();
  });

  it("asigna fechaSnapshot si no se provee", async () => {
    const s = await SnapshotExpediente.create(valid());
    expect(s.fechaSnapshot).toBeTruthy();
  });

  it("reconstituye desde props", async () => {
    const original = await SnapshotExpediente.create(valid());
    const restored = SnapshotExpediente.reconstitute(original.toProps());
    expect(restored.consultaId).toBe(original.consultaId);
    expect(restored.hashIntegridad).toBe(original.hashIntegridad);
  });

  it("verifyIntegrity devuelve true para snapshot intacto", async () => {
    const s = await SnapshotExpediente.create(valid());
    const ok = await s.verifyIntegrity();
    expect(ok).toBe(true);
  });

  it("verifyIntegrity devuelve false si se altera el contenido", async () => {
    const s = await SnapshotExpediente.create(valid());
    const corrupted = SnapshotExpediente.reconstitute({
      ...s.toProps(),
      contenidoJsonExpediente: JSON.stringify({ nombre: "Otro" }),
    });
    const ok = await corrupted.verifyIntegrity();
    expect(ok).toBe(false);
  });

  it("computeIntegrityHash produce un hash SHA-256", async () => {
    const hash = await computeIntegrityHash('{"a":1}', null, null, null, "1.0");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
