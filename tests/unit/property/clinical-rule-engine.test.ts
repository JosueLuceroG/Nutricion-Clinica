import { describe, it, expect } from "vitest";
import { ClinicalRuleEngine } from "@modules/clinical-record/application/clinicalRuleEngine";
import type { ClinicalRecordRepository } from "@modules/clinical-record/domain/ClinicalRecordRepository";
import type { AllergyProps } from "@modules/clinical-record/domain/Allergy";
import type { PersonalHistoryProps } from "@modules/clinical-record/domain/PersonalHistory";
import type { FamilyHistoryProps } from "@modules/clinical-record/domain/FamilyHistory";
import type { IntoleranceProps } from "@modules/clinical-record/domain/Intolerance";
import type { FoodRepository } from "@modules/smae/domain/FoodRepository";
import { Patient } from "@modules/patient/domain/Patient";
import { PatientId } from "@modules/patient/domain/PatientId";
import { ConsentId } from "@modules/patient/domain/ConsentId";
import type { PatientRepository } from "@modules/patient/domain/PatientRepository";

const makeFakeClinicalRepo = (overrides: Partial<ClinicalRecordRepository> = {}): ClinicalRecordRepository => ({
  findAllergies: async () => [],
  addAllergy: async () => {},
  updateAllergy: async () => {},
  removeAllergy: async () => {},
  findMedications: async () => [],
  addMedication: async () => {},
  updateMedication: async () => {},
  removeMedication: async () => {},
  findClinicalEvents: async () => [],
  addClinicalEvent: async () => {},
  updateClinicalEvent: async () => {},
  removeClinicalEvent: async () => {},
  findFamilyHistories: async () => [],
  addFamilyHistory: async () => {},
  updateFamilyHistory: async () => {},
  removeFamilyHistory: async () => {},
  findPersonalHistories: async () => [],
  addPersonalHistory: async () => {},
  updatePersonalHistory: async () => {},
  removePersonalHistory: async () => {},
  findHabits: async () => [],
  addHabit: async () => {},
  updateHabit: async () => {},
  removeHabit: async () => {},
  findPhysicalActivities: async () => [],
  addPhysicalActivity: async () => {},
  updatePhysicalActivity: async () => {},
  removePhysicalActivity: async () => {},
  findDietHistory: async () => null,
  saveDietHistory: async () => {},
  findIntolerances: async () => [],
  addIntolerance: async () => {},
  updateIntolerance: async () => {},
  removeIntolerance: async () => {},
  findSurgeries: async () => [],
  addSurgery: async () => {},
  updateSurgery: async () => {},
  removeSurgery: async () => {},
  findHospitalizations: async () => [],
  addHospitalization: async () => {},
  updateHospitalization: async () => {},
  removeHospitalization: async () => {},
  findSupplements: async () => [],
  addSupplement: async () => {},
  updateSupplement: async () => {},
  removeSupplement: async () => {},
  findFoodFrequencies: async () => [],
  addFoodFrequency: async () => {},
  updateFoodFrequency: async () => {},
  removeFoodFrequency: async () => {},
  findGiSymptoms: async () => [],
  addGiSymptom: async () => {},
  updateGiSymptom: async () => {},
  removeGiSymptom: async () => {},
  ...overrides,
});

const makeFakeFoodRepo = (overrides: Partial<FoodRepository> = {}): FoodRepository => ({
  save: async () => {},
  findById: async () => null,
  findAllCustom: async () => [],
  delete: async () => {},
  ...overrides,
});

const makeFakePatientRepo = (overrides: Partial<PatientRepository> = {}): PatientRepository => ({
  save: async () => {},
  findById: async () => null,
  findAll: async () => [],
  count: async () => 0,
  delete: async () => {},
  ...overrides,
});

describe("ClinicalRuleEngine", () => {
  describe("generateClinicalTags", () => {
    it("retorna tags vacíos para paciente sin historial", async () => {
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo());
      const tags = await engine.generateClinicalTags("pat-1");
      expect(tags).toEqual([]);
    });

    it("genera tag diabetico para paciente con diabetes tipo 2", async () => {
      const ph: PersonalHistoryProps = {
        id: "ph-1", patientId: "pat-1", condition: "diabetes_tipo_2",
        diagnosisDate: null, status: "activo",
        treatingPhysician: null, treatment: null, notes: null,
        createdAt: "", updatedAt: "",
      };
      const repo = makeFakeClinicalRepo({
        findPersonalHistories: async () => [ph],
      });
      const engine = new ClinicalRuleEngine(repo, makeFakeFoodRepo());
      const tags = await engine.generateClinicalTags("pat-1");
      expect(tags).toContain("diabetico");
    });

    it("genera tag de antecedente familiar para diabetes", async () => {
      const fh: FamilyHistoryProps = {
        id: "fh-1", patientId: "pat-1", relationship: "padre",
        condition: "diabetes", diagnosisAge: null, notes: null,
        createdAt: "", updatedAt: "",
      };
      const repo = makeFakeClinicalRepo({
        findFamilyHistories: async () => [fh],
      });
      const engine = new ClinicalRuleEngine(repo, makeFakeFoodRepo());
      const tags = await engine.generateClinicalTags("pat-1");
      expect(tags).toContain("antecedente-familiar-diabetes");
    });

    it("combina tags de personal y family history sin duplicados", async () => {
      const ph: PersonalHistoryProps = {
        id: "ph-1", patientId: "pat-1", condition: "diabetes_tipo_2",
        diagnosisDate: null, status: "activo",
        treatingPhysician: null, treatment: null, notes: null,
        createdAt: "", updatedAt: "",
      };
      const fh: FamilyHistoryProps = {
        id: "fh-1", patientId: "pat-1", relationship: "padre",
        condition: "diabetes", diagnosisAge: null, notes: null,
        createdAt: "", updatedAt: "",
      };
      const repo = makeFakeClinicalRepo({
        findPersonalHistories: async () => [ph],
        findFamilyHistories: async () => [fh],
      });
      const engine = new ClinicalRuleEngine(repo, makeFakeFoodRepo());
      const tags = await engine.generateClinicalTags("pat-1");
      expect(tags).toContain("diabetico");
      expect(tags).toContain("antecedente-familiar-diabetes");
      expect(new Set(tags).size).toBe(tags.length);
    });
  });

  describe("getBlockedFoodIds", () => {
    it("retorna lista vacía si no hay alergias", async () => {
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo());
      const blocked = await engine.getBlockedFoodIds("pat-1");
      expect(blocked).toEqual([]);
    });

    it("bloquea alimentos que contienen el alérgeno por nombre", async () => {
      const allergy: AllergyProps = {
        id: "a-1", patientId: "pat-1",
        allergen: "huevo", reaction: "urticaria",
        severity: "moderada", diagnosis: "clinico",
        notes: null, createdAt: "", updatedAt: "",
      };
      const repo = makeFakeClinicalRepo({
        findAllergies: async () => [allergy],
      });
      const engine = new ClinicalRuleEngine(repo, makeFakeFoodRepo());
      const blocked = await engine.getBlockedFoodIds("pat-1");
      expect(blocked).toContain("aoa-huevo");
    });

    it("bloquea múltiples alimentos para gluten", async () => {
      const allergy: AllergyProps = {
        id: "a-1", patientId: "pat-1",
        allergen: "gluten", reaction: "distensión",
        severity: "severa", diagnosis: "clinico",
        notes: null, createdAt: "", updatedAt: "",
      };
      const repo = makeFakeClinicalRepo({
        findAllergies: async () => [allergy],
      });
      const engine = new ClinicalRuleEngine(repo, makeFakeFoodRepo());
      const blocked = await engine.getBlockedFoodIds("pat-1");
      expect(blocked.length).toBeGreaterThanOrEqual(4);
      expect(blocked).toContain("cereal-pan-blanco");
      expect(blocked).toContain("cereal-bolillo");
      expect(blocked).toContain("cereal-pan-tostado");
      expect(blocked).toContain("cereal-avena");
    });
  });

  describe("validateConsent (RN-EXP-01)", () => {
    it("retorna valid=true si paciente tiene consentimiento firmado", async () => {
      const patient = Patient.reconstitute({
        id: PatientId.fromUnsafe("pat-1"),
        firstName: "Test", lastName: "Patient", secondLastName: null,
        birthDate: new Date("1990-01-01"), sex: "female", gender: null,
        maritalStatus: null, occupation: null, education: null,
        email: null, phone: null, secondaryPhone: null,
        emergencyContactName: null, emergencyContactRelationship: null,
        emergencyContactPhone: null,
        recordStatus: "active", recordOpenedAt: new Date(),
        generalNotes: null,
        consentimientoInformadoId: ConsentId.fromUnsafe("consent-123"),
        fechaFirmaConsentimiento: new Date("2026-01-15"),
        versionPoliticaPrivacidad: null,
        clinicalTags: [], status: "active",
        createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      });
      const patientRepo = makeFakePatientRepo({
        findById: async () => patient,
      });
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo(), patientRepo);
      const result = await engine.validateConsent("pat-1");
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    });

    it("retorna valid=false si paciente no tiene consentimientoInformadoId", async () => {
      const patient = Patient.reconstitute({
        id: PatientId.fromUnsafe("pat-1"),
        firstName: "Test", lastName: "Patient", secondLastName: null,
        birthDate: new Date("1990-01-01"), sex: "female", gender: null,
        maritalStatus: null, occupation: null, education: null,
        email: null, phone: null, secondaryPhone: null,
        emergencyContactName: null, emergencyContactRelationship: null,
        emergencyContactPhone: null,
        recordStatus: "active", recordOpenedAt: new Date(),
        generalNotes: null,
        consentimientoInformadoId: null,
        fechaFirmaConsentimiento: null,
        versionPoliticaPrivacidad: null,
        clinicalTags: [], status: "active",
        createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      });
      const patientRepo = makeFakePatientRepo({
        findById: async () => patient,
      });
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo(), patientRepo);
      const result = await engine.validateConsent("pat-1");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("RN-EXP-01");
    });

    it("retorna valid=false si el paciente no existe", async () => {
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo(), makeFakePatientRepo());
      const result = await engine.validateConsent("pat-not-found");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("no encontrado");
    });

    it("retorna valid=true si no hay patientRepo (graceful degradation)", async () => {
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo());
      const result = await engine.validateConsent("pat-1");
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
    });
  });

  describe("getFoodWarnings", () => {
    it("retorna lista vacía si no hay intolerancias", async () => {
      const engine = new ClinicalRuleEngine(makeFakeClinicalRepo(), makeFakeFoodRepo());
      const warnings = await engine.getFoodWarnings("pat-1");
      expect(warnings).toEqual([]);
    });

    it("advertida alimentos que coinciden con la intolerancia", async () => {
      const intolerance: IntoleranceProps = {
        id: "i-1", patientId: "pat-1",
        food: "leche", symptom: "distensión",
        severity: "moderada", thresholdDose: null,
        mechanism: "lactosa", notes: null,
        createdAt: "", updatedAt: "",
      };
      const repo = makeFakeClinicalRepo({
        findIntolerances: async () => [intolerance],
      });
      const engine = new ClinicalRuleEngine(repo, makeFakeFoodRepo());
      const warnings = await engine.getFoodWarnings("pat-1");
      expect(warnings.length).toBeGreaterThanOrEqual(3);
      expect(warnings[0].severity).toBe("moderada");
      expect(warnings[0].intoleranceFood).toBe("leche");
    });
  });
});
