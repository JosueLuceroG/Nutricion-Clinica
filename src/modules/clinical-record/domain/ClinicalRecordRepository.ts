import type { AllergyProps } from "./Allergy";
import type { MedicationProps } from "./Medication";
import type { ClinicalEventProps } from "./ClinicalEvent";
import type { FamilyHistoryProps } from "./FamilyHistory";
import type { PersonalHistoryProps } from "./PersonalHistory";
import type { HabitProps } from "./Habit";
import type { PhysicalActivityProps } from "./PhysicalActivity";
import type { DietHistoryProps } from "./DietHistory";
import type { IntoleranceProps } from "./Intolerance";
import type { SurgeryProps } from "./Surgery";
import type { HospitalizationProps } from "./Hospitalization";
import type { SupplementProps } from "./Supplement";
import type { FoodFrequencyProps } from "./FoodFrequency";
import type { GiSymptomProps } from "./GiSymptom";

export interface ClinicalRecordRepository {
  // Allergies
  findAllergies(patientId: string): Promise<AllergyProps[]>;
  addAllergy(allergy: AllergyProps): Promise<void>;
  updateAllergy(allergy: AllergyProps): Promise<void>;
  removeAllergy(id: string): Promise<void>;

  // Medications
  findMedications(patientId: string): Promise<MedicationProps[]>;
  addMedication(medication: MedicationProps): Promise<void>;
  updateMedication(medication: MedicationProps): Promise<void>;
  removeMedication(id: string): Promise<void>;

  // Clinical Events
  findClinicalEvents(patientId: string): Promise<ClinicalEventProps[]>;
  addClinicalEvent(event: ClinicalEventProps): Promise<void>;
  updateClinicalEvent(event: ClinicalEventProps): Promise<void>;
  removeClinicalEvent(id: string): Promise<void>;

  // Family History
  findFamilyHistories(patientId: string): Promise<FamilyHistoryProps[]>;
  addFamilyHistory(fh: FamilyHistoryProps): Promise<void>;
  updateFamilyHistory(fh: FamilyHistoryProps): Promise<void>;
  removeFamilyHistory(id: string): Promise<void>;

  // Personal History
  findPersonalHistories(patientId: string): Promise<PersonalHistoryProps[]>;
  addPersonalHistory(ph: PersonalHistoryProps): Promise<void>;
  updatePersonalHistory(ph: PersonalHistoryProps): Promise<void>;
  removePersonalHistory(id: string): Promise<void>;

  // Habits
  findHabits(patientId: string): Promise<HabitProps[]>;
  addHabit(habit: HabitProps): Promise<void>;
  updateHabit(habit: HabitProps): Promise<void>;
  removeHabit(id: string): Promise<void>;

  // Physical Activity
  findPhysicalActivities(patientId: string): Promise<PhysicalActivityProps[]>;
  addPhysicalActivity(pa: PhysicalActivityProps): Promise<void>;
  updatePhysicalActivity(pa: PhysicalActivityProps): Promise<void>;
  removePhysicalActivity(id: string): Promise<void>;

  // Diet History
  findDietHistory(patientId: string): Promise<DietHistoryProps | null>;
  saveDietHistory(dh: DietHistoryProps): Promise<void>;

  // Intolerances
  findIntolerances(patientId: string): Promise<IntoleranceProps[]>;
  addIntolerance(intolerance: IntoleranceProps): Promise<void>;
  updateIntolerance(intolerance: IntoleranceProps): Promise<void>;
  removeIntolerance(id: string): Promise<void>;

  // Surgeries
  findSurgeries(patientId: string): Promise<SurgeryProps[]>;
  addSurgery(surgery: SurgeryProps): Promise<void>;
  updateSurgery(surgery: SurgeryProps): Promise<void>;
  removeSurgery(id: string): Promise<void>;

  // Hospitalizations
  findHospitalizations(patientId: string): Promise<HospitalizationProps[]>;
  addHospitalization(h: HospitalizationProps): Promise<void>;
  updateHospitalization(h: HospitalizationProps): Promise<void>;
  removeHospitalization(id: string): Promise<void>;

  // Supplements
  findSupplements(patientId: string): Promise<SupplementProps[]>;
  addSupplement(supplement: SupplementProps): Promise<void>;
  updateSupplement(supplement: SupplementProps): Promise<void>;
  removeSupplement(id: string): Promise<void>;

  // Food Frequencies
  findFoodFrequencies(patientId: string): Promise<FoodFrequencyProps[]>;
  addFoodFrequency(ff: FoodFrequencyProps): Promise<void>;
  updateFoodFrequency(ff: FoodFrequencyProps): Promise<void>;
  removeFoodFrequency(id: string): Promise<void>;

  // GI Symptoms
  findGiSymptoms(patientId: string): Promise<GiSymptomProps[]>;
  addGiSymptom(symptom: GiSymptomProps): Promise<void>;
  updateGiSymptom(symptom: GiSymptomProps): Promise<void>;
  removeGiSymptom(id: string): Promise<void>;
}
