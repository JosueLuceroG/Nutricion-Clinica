import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieClinicalRecordRepository } from "./DexieClinicalRecordRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import type { AllergyProps, Severity, AllergyDiagnosis } from "../domain/Allergy";
import type { MedicationProps, MedicationFreq } from "../domain/Medication";
import type { ClinicalEventProps, EventType } from "../domain/ClinicalEvent";
import type { FamilyHistoryProps, FamilyRelationship, Condition } from "../domain/FamilyHistory";
import type { PersonalHistoryProps, PersonalCondition } from "../domain/PersonalHistory";
import type { HabitProps, HabitCategory } from "../domain/Habit";
import type { PhysicalActivityProps, ActivityType, BorgIntensity } from "../domain/PhysicalActivity";
import type { DietHistoryProps, DietType, MealPlace } from "../domain/DietHistory";
import type { IntoleranceProps, Mechanism, IntoleranceSeverity } from "../domain/Intolerance";
import type { SurgeryProps, SurgeryType } from "../domain/Surgery";
import type { HospitalizationProps } from "../domain/Hospitalization";
import type { SupplementProps, SupplementCategory } from "../domain/Supplement";
import type { FoodFrequencyProps, FrequencyValue } from "../domain/FoodFrequency";
import type { GiSymptomProps, GiSymptomType } from "../domain/GiSymptom";

const ts = () => new Date().toISOString();

const makeAllergy = (overrides: Partial<AllergyProps> = {}): AllergyProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  allergen: "Polen",
  reaction: "Estornudos",
  severity: "moderada" as Severity,
  diagnosis: "prick" as AllergyDiagnosis,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeMedication = (overrides: Partial<MedicationProps> = {}): MedicationProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  name: "Metformina",
  activeIngredient: "Metformina clorhidrato",
  dose: "850 mg",
  frequency: "cada-12h" as MedicationFreq,
  route: "oral",
  startDate: "2026-01-01",
  endDate: null,
  prescribedBy: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeClinicalEvent = (overrides: Partial<ClinicalEventProps> = {}): ClinicalEventProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  type: "evento-clinico" as EventType,
  name: "Consulta general",
  description: null,
  date: "2026-03-15",
  endDate: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeFamilyHistory = (overrides: Partial<FamilyHistoryProps> = {}): FamilyHistoryProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  relationship: "padre" as FamilyRelationship,
  condition: "diabetes" as Condition,
  diagnosisAge: 50,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makePersonalHistory = (overrides: Partial<PersonalHistoryProps> = {}): PersonalHistoryProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  condition: "hta" as PersonalCondition,
  diagnosisDate: "2020-01-01",
  status: "activo",
  treatingPhysician: null,
  treatment: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeHabit = (overrides: Partial<HabitProps> = {}): HabitProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  category: "smoking" as HabitCategory,
  status: "activo",
  frequency: "diario",
  quantity: "10 cigarros",
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makePhysicalActivity = (overrides: Partial<PhysicalActivityProps> = {}): PhysicalActivityProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  type: "caminata" as ActivityType,
  frequencyPerWeek: 3,
  durationMinutes: 30,
  intensity: "moderate" as BorgIntensity,
  startDate: null,
  endDate: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeDietHistory = (overrides: Partial<DietHistoryProps> = {}): DietHistoryProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  dietType: "omnivoro" as DietType,
  mealsPerDay: 3,
  mealSchedule: "08:00, 14:00, 20:00",
  mealPlace: "hogar" as MealPlace,
  mealPreparer: "ella",
  timeAvailable: "30 min",
  budget: "moderado",
  kitchenEquipment: "completa",
  previousDiets: "ninguna",
  labelReading: false,
  nutritionalKnowledge: "basica",
  preferences: "nada",
  aversions: "nada",
  chewing: "normal",
  workSchedule: "9-18",
  householdPeople: 2,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeIntolerance = (overrides: Partial<IntoleranceProps> = {}): IntoleranceProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  food: "Leche",
  symptom: "Distensión",
  severity: "moderada" as IntoleranceSeverity,
  thresholdDose: null,
  mechanism: "lactosa" as Mechanism,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeSurgery = (overrides: Partial<SurgeryProps> = {}): SurgeryProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  type: "apendicectomia" as SurgeryType,
  date: "2020-05-10",
  hospital: "Hospital General",
  complications: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeHospitalization = (overrides: Partial<HospitalizationProps> = {}): HospitalizationProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  reason: "Neumonía",
  admissionDate: "2025-01-10",
  dischargeDate: "2025-01-17",
  stayDays: 7,
  hospital: "Hospital General",
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeSupplement = (overrides: Partial<SupplementProps> = {}): SupplementProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  name: "Vitamina D3",
  brand: "Solaray",
  category: "vitamina_d" as SupplementCategory,
  composition: "2000 UI",
  dose: "1 tableta",
  frequency: "diario",
  prescribedBy: null,
  startDate: null,
  endDate: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeFoodFrequency = (overrides: Partial<FoodFrequencyProps> = {}): FoodFrequencyProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  foodGroupId: "fg-1",
  foodGroupName: "Frutas",
  frequency: "diario" as FrequencyValue,
  quantity: "2 porciones",
  preparation: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

const makeGiSymptom = (overrides: Partial<GiSymptomProps> = {}): GiSymptomProps => ({
  id: crypto.randomUUID(),
  patientId: "patient-1",
  symptomType: "reflujo" as GiSymptomType,
  description: "Ardor después de comer",
  frequency: "3-5_sem",
  severity: 6,
  foodRelation: "grasas",
  onsetDate: null,
  triggers: null,
  notes: null,
  createdAt: ts(),
  updatedAt: ts(),
  ...overrides,
});

describe("DexieClinicalRecordRepository", () => {
  let repo: DexieClinicalRecordRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieClinicalRecordRepository(db);
  });

  describe("Allergies", () => {
    it("guarda y recupera alergias por patientId", async () => {
      const a = makeAllergy({ patientId: "p1" });
      await repo.addAllergy(a);
      const results = await repo.findAllergies("p1");
      expect(results).toHaveLength(1);
      expect(results[0].allergen).toBe("Polen");
    });

    it("actualiza una alergia existente", async () => {
      const a = makeAllergy({ patientId: "p1" });
      await repo.addAllergy(a);
      await repo.updateAllergy({ ...a, allergen: "Ácaros" });
      const results = await repo.findAllergies("p1");
      expect(results).toHaveLength(1);
      expect(results[0].allergen).toBe("Ácaros");
    });

    it("retorna arreglo vacío cuando no hay alergias", async () => {
      const results = await repo.findAllergies("sin-alergias");
      expect(results).toEqual([]);
    });

    it("elimina una alergia por id", async () => {
      const a = makeAllergy({ patientId: "p1" });
      await repo.addAllergy(a);
      await repo.removeAllergy(a.id);
      const results = await repo.findAllergies("p1");
      expect(results).toEqual([]);
    });
  });

  describe("Medications", () => {
    it("guarda y recupera medicamentos", async () => {
      const m = makeMedication({ patientId: "p1" });
      await repo.addMedication(m);
      const results = await repo.findMedications("p1");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Metformina");
    });

    it("actualiza un medicamento", async () => {
      const m = makeMedication({ patientId: "p1" });
      await repo.addMedication(m);
      await repo.updateMedication({ ...m, dose: "500 mg" });
      const results = await repo.findMedications("p1");
      expect(results[0].dose).toBe("500 mg");
    });

    it("elimina un medicamento", async () => {
      const m = makeMedication({ patientId: "p1" });
      await repo.addMedication(m);
      await repo.removeMedication(m.id);
      const results = await repo.findMedications("p1");
      expect(results).toEqual([]);
    });
  });

  describe("ClinicalEvents", () => {
    it("guarda y recupera eventos clínicos", async () => {
      const e = makeClinicalEvent({ patientId: "p1" });
      await repo.addClinicalEvent(e);
      const results = await repo.findClinicalEvents("p1");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Consulta general");
    });

    it("actualiza un evento clínico", async () => {
      const e = makeClinicalEvent({ patientId: "p1" });
      await repo.addClinicalEvent(e);
      await repo.updateClinicalEvent({ ...e, description: "Paciente estable" });
      const results = await repo.findClinicalEvents("p1");
      expect(results[0].description).toBe("Paciente estable");
    });

    it("elimina un evento clínico", async () => {
      const e = makeClinicalEvent({ patientId: "p1" });
      await repo.addClinicalEvent(e);
      await repo.removeClinicalEvent(e.id);
      const results = await repo.findClinicalEvents("p1");
      expect(results).toEqual([]);
    });
  });

  describe("FamilyHistory + PersonalHistory + Habits", () => {
    it("guarda y recupera antecedentes familiares", async () => {
      const fh = makeFamilyHistory({ patientId: "p1" });
      await repo.addFamilyHistory(fh);
      const results = await repo.findFamilyHistories("p1");
      expect(results).toHaveLength(1);
      expect(results[0].relationship).toBe("padre");
      expect(results[0].condition).toBe("diabetes");
    });

    it("guarda y recupera antecedentes personales patológicos", async () => {
      const ph = makePersonalHistory({ patientId: "p1" });
      await repo.addPersonalHistory(ph);
      const results = await repo.findPersonalHistories("p1");
      expect(results).toHaveLength(1);
      expect(results[0].condition).toBe("hta");
    });

    it("guarda y recupera hábitos", async () => {
      const h = makeHabit({ patientId: "p1" });
      await repo.addHabit(h);
      const results = await repo.findHabits("p1");
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe("smoking");
    });
  });

  describe("PhysicalActivity + DietHistory + Intolerances", () => {
    it("guarda y recupera actividad física", async () => {
      const pa = makePhysicalActivity({ patientId: "p1" });
      await repo.addPhysicalActivity(pa);
      const results = await repo.findPhysicalActivities("p1");
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("caminata");
      expect(results[0].frequencyPerWeek).toBe(3);
    });

    it("guarda y recupera la historia dietética (singular)", async () => {
      const dh = makeDietHistory({ patientId: "p1" });
      await repo.saveDietHistory(dh);
      const result = await repo.findDietHistory("p1");
      expect(result).not.toBeNull();
      expect(result?.dietType).toBe("omnivoro");
      expect(result?.mealsPerDay).toBe(3);
    });

    it("retorna null cuando no hay historia dietética", async () => {
      const result = await repo.findDietHistory("sin-dieta");
      expect(result).toBeNull();
    });

    it("guarda y recupera intolerancias", async () => {
      const i = makeIntolerance({ patientId: "p1" });
      await repo.addIntolerance(i);
      const results = await repo.findIntolerances("p1");
      expect(results).toHaveLength(1);
      expect(results[0].food).toBe("Leche");
    });
  });

  describe("Surgeries + Hospitalizations + Supplements", () => {
    it("guarda y recupera cirugías", async () => {
      const s = makeSurgery({ patientId: "p1" });
      await repo.addSurgery(s);
      const results = await repo.findSurgeries("p1");
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("apendicectomia");
    });

    it("guarda y recupera hospitalizaciones", async () => {
      const h = makeHospitalization({ patientId: "p1" });
      await repo.addHospitalization(h);
      const results = await repo.findHospitalizations("p1");
      expect(results).toHaveLength(1);
      expect(results[0].reason).toBe("Neumonía");
    });

    it("guarda y recupera suplementos", async () => {
      const s = makeSupplement({ patientId: "p1" });
      await repo.addSupplement(s);
      const results = await repo.findSupplements("p1");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Vitamina D3");
    });

    it("actualiza y elimina suplemento", async () => {
      const s = makeSupplement({ patientId: "p1" });
      await repo.addSupplement(s);
      await repo.updateSupplement({ ...s, dose: "2 tabletas" });
      const afterUpdate = await repo.findSupplements("p1");
      expect(afterUpdate[0].dose).toBe("2 tabletas");
      await repo.removeSupplement(s.id);
      const afterDelete = await repo.findSupplements("p1");
      expect(afterDelete).toEqual([]);
    });
  });

  describe("FoodFrequencies + GiSymptoms", () => {
    it("guarda y recupera frecuencias de alimentos", async () => {
      const ff = makeFoodFrequency({ patientId: "p1" });
      await repo.addFoodFrequency(ff);
      const results = await repo.findFoodFrequencies("p1");
      expect(results).toHaveLength(1);
      expect(results[0].foodGroupName).toBe("Frutas");
    });

    it("guarda y recupera síntomas gastrointestinales", async () => {
      const gs = makeGiSymptom({ patientId: "p1" });
      await repo.addGiSymptom(gs);
      const results = await repo.findGiSymptoms("p1");
      expect(results).toHaveLength(1);
      expect(results[0].symptomType).toBe("reflujo");
    });

    it("filtra por patientId entre distintos pacientes", async () => {
      const gs1 = makeGiSymptom({ patientId: "p1", description: "Síntoma A" });
      const gs2 = makeGiSymptom({ patientId: "p2", description: "Síntoma B" });
      await repo.addGiSymptom(gs1);
      await repo.addGiSymptom(gs2);
      const p1Results = await repo.findGiSymptoms("p1");
      expect(p1Results).toHaveLength(1);
      expect(p1Results[0].description).toBe("Síntoma A");
      const p2Results = await repo.findGiSymptoms("p2");
      expect(p2Results).toHaveLength(1);
      expect(p2Results[0].description).toBe("Síntoma B");
    });
  });
});
