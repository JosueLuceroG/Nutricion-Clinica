import { describe, it, expect, beforeEach } from "vitest";
import type { ClinicalRecordRepository } from "../domain/ClinicalRecordRepository";
import type { AllergyProps } from "../domain/Allergy";
import type { MedicationProps } from "../domain/Medication";
import type { ClinicalEventProps } from "../domain/ClinicalEvent";
import { PatientId } from "@modules/patient/domain/PatientId";
import {
  CreateAllergyUseCase,
  RemoveAllergyUseCase,
  ListAllergiesUseCase,
  CreateMedicationUseCase,
  ListMedicationsUseCase,
} from "./clinicalRecordUseCases";

class InMemoryClinicalRecordRepo implements ClinicalRecordRepository {
  allergies = new Map<string, AllergyProps>();
  medications = new Map<string, MedicationProps>();
  events = new Map<string, ClinicalEventProps>();

  async findAllergies(patientId: string): Promise<AllergyProps[]> {
    return Array.from(this.allergies.values()).filter((a) => a.patientId === patientId);
  }
  async addAllergy(allergy: AllergyProps): Promise<void> { this.allergies.set(allergy.id, allergy); }
  async updateAllergy(allergy: AllergyProps): Promise<void> { this.allergies.set(allergy.id, allergy); }
  async removeAllergy(id: string): Promise<void> { this.allergies.delete(id); }

  async findMedications(patientId: string): Promise<MedicationProps[]> {
    return Array.from(this.medications.values()).filter((m) => m.patientId === patientId);
  }
  async addMedication(medication: MedicationProps): Promise<void> { this.medications.set(medication.id, medication); }
  async updateMedication(medication: MedicationProps): Promise<void> { this.medications.set(medication.id, medication); }
  async removeMedication(id: string): Promise<void> { this.medications.delete(id); }

  async findClinicalEvents(patientId: string): Promise<ClinicalEventProps[]> {
    return Array.from(this.events.values()).filter((e) => e.patientId === patientId);
  }
  async addClinicalEvent(event: ClinicalEventProps): Promise<void> { this.events.set(event.id, event); }
  async updateClinicalEvent(event: ClinicalEventProps): Promise<void> { this.events.set(event.id, event); }
  async removeClinicalEvent(id: string): Promise<void> { this.events.delete(id); }

  async findFamilyHistories(): Promise<any[]> { return []; }
  async addFamilyHistory(): Promise<void> {}
  async updateFamilyHistory(): Promise<void> {}
  async removeFamilyHistory(): Promise<void> {}
  async findPersonalHistories(): Promise<any[]> { return []; }
  async addPersonalHistory(): Promise<void> {}
  async updatePersonalHistory(): Promise<void> {}
  async removePersonalHistory(): Promise<void> {}
  async findHabits(): Promise<any[]> { return []; }
  async addHabit(): Promise<void> {}
  async updateHabit(): Promise<void> {}
  async removeHabit(): Promise<void> {}
  async findPhysicalActivities(): Promise<any[]> { return []; }
  async addPhysicalActivity(): Promise<void> {}
  async updatePhysicalActivity(): Promise<void> {}
  async removePhysicalActivity(): Promise<void> {}
  async findDietHistory(): Promise<null> { return null; }
  async saveDietHistory(): Promise<void> {}
  async findIntolerances(): Promise<any[]> { return []; }
  async addIntolerance(): Promise<void> {}
  async updateIntolerance(): Promise<void> {}
  async removeIntolerance(): Promise<void> {}
  async findSurgeries(): Promise<any[]> { return []; }
  async addSurgery(): Promise<void> {}
  async updateSurgery(): Promise<void> {}
  async removeSurgery(): Promise<void> {}
  async findHospitalizations(): Promise<any[]> { return []; }
  async addHospitalization(): Promise<void> {}
  async updateHospitalization(): Promise<void> {}
  async removeHospitalization(): Promise<void> {}
  async findSupplements(): Promise<any[]> { return []; }
  async addSupplement(): Promise<void> {}
  async updateSupplement(): Promise<void> {}
  async removeSupplement(): Promise<void> {}
  async findFoodFrequencies(): Promise<any[]> { return []; }
  async addFoodFrequency(): Promise<void> {}
  async updateFoodFrequency(): Promise<void> {}
  async removeFoodFrequency(): Promise<void> {}
  async findGiSymptoms(): Promise<any[]> { return []; }
  async addGiSymptom(): Promise<void> {}
  async updateGiSymptom(): Promise<void> {}
  async removeGiSymptom(): Promise<void> {}
}

describe("CreateAllergyUseCase", () => {
  let repo: InMemoryClinicalRecordRepo;
  let useCase: CreateAllergyUseCase;

  beforeEach(() => {
    repo = new InMemoryClinicalRecordRepo();
    useCase = new CreateAllergyUseCase(repo);
  });

  it("creates and persists an allergy", async () => {
    const allergy = await useCase.execute({
      patientId: PatientId.generate(),
      allergen: "Polen",
      reaction: "Estornudos",
      severity: "moderada",
      diagnosis: "prick",
    });
    expect(allergy.allergen).toBe("Polen");
    expect(repo.allergies.has(allergy.id.toString())).toBe(true);
  });
});

describe("ListAllergiesUseCase", () => {
  it("returns allergies for a patient", async () => {
    const repo = new InMemoryClinicalRecordRepo();
    const patientId = PatientId.generate();
    const create = new CreateAllergyUseCase(repo);
    await create.execute({ patientId, allergen: "Polen", reaction: "Estornudos", severity: "moderada", diagnosis: "prick" });
    await create.execute({ patientId, allergen: "Nueces", reaction: "Hinchazón", severity: "severa", diagnosis: "rast" });
    const results = await new ListAllergiesUseCase(repo).execute(patientId.toString());
    expect(results).toHaveLength(2);
  });
});

describe("RemoveAllergyUseCase", () => {
  it("removes an allergy", async () => {
    const repo = new InMemoryClinicalRecordRepo();
    const created = await new CreateAllergyUseCase(repo).execute({
      patientId: PatientId.generate(), allergen: "Polen", reaction: "Estornudos", severity: "moderada", diagnosis: "prick",
    });
    expect(repo.allergies.size).toBe(1);
    await new RemoveAllergyUseCase(repo).execute(created.id.toString());
    expect(repo.allergies.size).toBe(0);
  });
});

describe("CreateMedicationUseCase", () => {
  it("creates and persists a medication", async () => {
    const repo = new InMemoryClinicalRecordRepo();
    const medication = await new CreateMedicationUseCase(repo).execute({
      patientId: PatientId.generate(),
      name: "Metformina",
      activeIngredient: "Metformina clorhidrato",
      dose: "850 mg",
      frequency: "cada-12h",
      startDate: "2026-01-01",
    });
    expect(medication.name).toBe("Metformina");
    expect(repo.medications.has(medication.id.toString())).toBe(true);
  });
});

describe("ListMedicationsUseCase", () => {
  it("returns medications for a patient", async () => {
    const repo = new InMemoryClinicalRecordRepo();
    const patientId = PatientId.generate();
    const create = new CreateMedicationUseCase(repo);
    await create.execute({ patientId, name: "Metformina", activeIngredient: "Met", dose: "500mg", frequency: "cada-24h", startDate: "2026-01-01" });
    await create.execute({ patientId, name: "Losartán", activeIngredient: "Losartán", dose: "50mg", frequency: "cada-24h", startDate: "2026-01-01" });
    const results = await new ListMedicationsUseCase(repo).execute(patientId.toString());
    expect(results).toHaveLength(2);
  });
});
