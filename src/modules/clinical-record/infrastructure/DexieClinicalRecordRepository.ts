import type { ClinicalRecordRepository } from "../domain/ClinicalRecordRepository";
import type { AllergyProps } from "../domain/Allergy";
import type { MedicationProps } from "../domain/Medication";
import type { ClinicalEventProps } from "../domain/ClinicalEvent";
import type { FamilyHistoryProps } from "../domain/FamilyHistory";
import type { PersonalHistoryProps } from "../domain/PersonalHistory";
import type { HabitProps } from "../domain/Habit";
import type { PhysicalActivityProps } from "../domain/PhysicalActivity";
import type { DietHistoryProps } from "../domain/DietHistory";
import type { IntoleranceProps } from "../domain/Intolerance";
import type { SurgeryProps } from "../domain/Surgery";
import type { HospitalizationProps } from "../domain/Hospitalization";
import type { SupplementProps } from "../domain/Supplement";
import type { FoodFrequencyProps } from "../domain/FoodFrequency";
import type { GiSymptomProps } from "../domain/GiSymptom";
import { allergyRowToProps, allergyPropsToRow, type AllergyRow } from "./clinicalRecordMapper";
import { medicationRowToProps, medicationPropsToRow, type MedicationRow } from "./clinicalRecordMapper";
import { clinicalEventRowToProps, clinicalEventPropsToRow, type ClinicalEventRow } from "./clinicalRecordMapper";
import { familyHistoryRowToProps, familyHistoryPropsToRow, type FamilyHistoryRow } from "./clinicalRecordMapper";
import { personalHistoryRowToProps, personalHistoryPropsToRow, type PersonalHistoryRow } from "./clinicalRecordMapper";
import { habitRowToProps, habitPropsToRow, type HabitRow } from "./clinicalRecordMapper";
import { physicalActivityRowToProps, physicalActivityPropsToRow, type PhysicalActivityRow } from "./clinicalRecordMapper";
import { dietHistoryRowToProps, dietHistoryPropsToRow, type DietHistoryRow } from "./clinicalRecordMapper";
import { intoleranceRowToProps, intolerancePropsToRow, type IntoleranceRow } from "./clinicalRecordMapper";
import { surgeryRowToProps, surgeryPropsToRow, type SurgeryRow } from "./clinicalRecordMapper";
import { hospitalizationRowToProps, hospitalizationPropsToRow, type HospitalizationRow } from "./clinicalRecordMapper";
import { supplementRowToProps, supplementPropsToRow, type SupplementRow } from "./clinicalRecordMapper";
import { foodFrequencyRowToProps, foodFrequencyPropsToRow, type FoodFrequencyRow } from "./clinicalRecordMapper";
import { giSymptomRowToProps, giSymptomPropsToRow, type GiSymptomRow } from "./clinicalRecordMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieClinicalRecordRepository implements ClinicalRecordRepository {
  private get allergies() { return this.db.allergies; }
  private get medications() { return this.db.medications; }
  private get clinicalEvents() { return this.db.clinical_events; }
  private get familyHistories() { return this.db.family_histories; }
  private get personalHistories() { return this.db.personal_histories; }
  private get habits() { return this.db.habits; }
  private get physicalActivities() { return this.db.physical_activities; }
  private get dietHistories() { return this.db.diet_histories; }
  private get intolerances() { return this.db.intolerances; }
  private get surgeries() { return this.db.surgeries; }
  private get hospitalizations() { return this.db.hospitalizations; }
  private get supplements() { return this.db.supplements; }
  private get foodFrequencies() { return this.db.food_frequencies; }
  private get giSymptoms() { return this.db.gi_symptoms; }

  constructor(private readonly db: NutriClinicaDB) {}

  async findAllergies(patientId: string): Promise<AllergyProps[]> {
    const rows = await this.allergies.where("patient_id").equals(patientId).toArray();
    return rows.map(allergyRowToProps);
  }
  async addAllergy(allergy: AllergyProps): Promise<void> {
    await this.allergies.add(allergyPropsToRow(allergy) as AllergyRow);
  }
  async updateAllergy(allergy: AllergyProps): Promise<void> {
    await this.allergies.put(allergyPropsToRow(allergy) as AllergyRow);
  }
  async removeAllergy(id: string): Promise<void> {
    await this.allergies.delete(id);
  }

  async findMedications(patientId: string): Promise<MedicationProps[]> {
    const rows = await this.medications.where("patient_id").equals(patientId).toArray();
    return rows.map(medicationRowToProps);
  }
  async addMedication(medication: MedicationProps): Promise<void> {
    await this.medications.add(medicationPropsToRow(medication) as MedicationRow);
  }
  async updateMedication(medication: MedicationProps): Promise<void> {
    await this.medications.put(medicationPropsToRow(medication) as MedicationRow);
  }
  async removeMedication(id: string): Promise<void> {
    await this.medications.delete(id);
  }

  async findClinicalEvents(patientId: string): Promise<ClinicalEventProps[]> {
    const rows = await this.clinicalEvents.where("patient_id").equals(patientId).toArray();
    return rows.map(clinicalEventRowToProps);
  }
  async addClinicalEvent(event: ClinicalEventProps): Promise<void> {
    await this.clinicalEvents.add(clinicalEventPropsToRow(event) as ClinicalEventRow);
  }
  async updateClinicalEvent(event: ClinicalEventProps): Promise<void> {
    await this.clinicalEvents.put(clinicalEventPropsToRow(event) as ClinicalEventRow);
  }
  async removeClinicalEvent(id: string): Promise<void> {
    await this.clinicalEvents.delete(id);
  }

  async findFamilyHistories(patientId: string): Promise<FamilyHistoryProps[]> {
    const rows = await this.familyHistories.where("patient_id").equals(patientId).toArray();
    return rows.map(familyHistoryRowToProps);
  }
  async addFamilyHistory(fh: FamilyHistoryProps): Promise<void> {
    await this.familyHistories.add(familyHistoryPropsToRow(fh) as FamilyHistoryRow);
  }
  async updateFamilyHistory(fh: FamilyHistoryProps): Promise<void> {
    await this.familyHistories.put(familyHistoryPropsToRow(fh) as FamilyHistoryRow);
  }
  async removeFamilyHistory(id: string): Promise<void> {
    await this.familyHistories.delete(id);
  }

  async findPersonalHistories(patientId: string): Promise<PersonalHistoryProps[]> {
    const rows = await this.personalHistories.where("patient_id").equals(patientId).toArray();
    return rows.map(personalHistoryRowToProps);
  }
  async addPersonalHistory(ph: PersonalHistoryProps): Promise<void> {
    await this.personalHistories.add(personalHistoryPropsToRow(ph) as PersonalHistoryRow);
  }
  async updatePersonalHistory(ph: PersonalHistoryProps): Promise<void> {
    await this.personalHistories.put(personalHistoryPropsToRow(ph) as PersonalHistoryRow);
  }
  async removePersonalHistory(id: string): Promise<void> {
    await this.personalHistories.delete(id);
  }

  async findHabits(patientId: string): Promise<HabitProps[]> {
    const rows = await this.habits.where("patient_id").equals(patientId).toArray();
    return rows.map(habitRowToProps);
  }
  async addHabit(habit: HabitProps): Promise<void> {
    await this.habits.add(habitPropsToRow(habit) as HabitRow);
  }
  async updateHabit(habit: HabitProps): Promise<void> {
    await this.habits.put(habitPropsToRow(habit) as HabitRow);
  }
  async removeHabit(id: string): Promise<void> {
    await this.habits.delete(id);
  }

  async findPhysicalActivities(patientId: string): Promise<PhysicalActivityProps[]> {
    const rows = await this.physicalActivities.where("patient_id").equals(patientId).toArray();
    return rows.map(physicalActivityRowToProps);
  }
  async addPhysicalActivity(pa: PhysicalActivityProps): Promise<void> {
    await this.physicalActivities.add(physicalActivityPropsToRow(pa) as PhysicalActivityRow);
  }
  async updatePhysicalActivity(pa: PhysicalActivityProps): Promise<void> {
    await this.physicalActivities.put(physicalActivityPropsToRow(pa) as PhysicalActivityRow);
  }
  async removePhysicalActivity(id: string): Promise<void> {
    await this.physicalActivities.delete(id);
  }

  async findDietHistory(patientId: string): Promise<DietHistoryProps | null> {
    const row = await this.dietHistories.where("patient_id").equals(patientId).first();
    return row ? dietHistoryRowToProps(row) : null;
  }

  async saveDietHistory(dh: DietHistoryProps): Promise<void> {
    const row = dietHistoryPropsToRow(dh) as DietHistoryRow;
    await this.dietHistories.put(row);
  }

  async findIntolerances(patientId: string): Promise<IntoleranceProps[]> {
    const rows = await this.intolerances.where("patient_id").equals(patientId).toArray();
    return rows.map(intoleranceRowToProps);
  }

  async addIntolerance(intolerance: IntoleranceProps): Promise<void> {
    await this.intolerances.add(intolerancePropsToRow(intolerance) as IntoleranceRow);
  }

  async updateIntolerance(intolerance: IntoleranceProps): Promise<void> {
    await this.intolerances.put(intolerancePropsToRow(intolerance) as IntoleranceRow);
  }

  async removeIntolerance(id: string): Promise<void> {
    await this.intolerances.delete(id);
  }

  async findSurgeries(patientId: string): Promise<SurgeryProps[]> {
    const rows = await this.surgeries.where("patient_id").equals(patientId).toArray();
    return rows.map(surgeryRowToProps);
  }
  async addSurgery(surgery: SurgeryProps): Promise<void> {
    await this.surgeries.add(surgeryPropsToRow(surgery) as SurgeryRow);
  }
  async updateSurgery(surgery: SurgeryProps): Promise<void> {
    await this.surgeries.put(surgeryPropsToRow(surgery) as SurgeryRow);
  }
  async removeSurgery(id: string): Promise<void> {
    await this.surgeries.delete(id);
  }

  async findHospitalizations(patientId: string): Promise<HospitalizationProps[]> {
    const rows = await this.hospitalizations.where("patient_id").equals(patientId).toArray();
    return rows.map(hospitalizationRowToProps);
  }
  async addHospitalization(h: HospitalizationProps): Promise<void> {
    await this.hospitalizations.add(hospitalizationPropsToRow(h) as HospitalizationRow);
  }
  async updateHospitalization(h: HospitalizationProps): Promise<void> {
    await this.hospitalizations.put(hospitalizationPropsToRow(h) as HospitalizationRow);
  }
  async removeHospitalization(id: string): Promise<void> {
    await this.hospitalizations.delete(id);
  }

  async findSupplements(patientId: string): Promise<SupplementProps[]> {
    const rows = await this.supplements.where("patient_id").equals(patientId).toArray();
    return rows.map(supplementRowToProps);
  }
  async addSupplement(supplement: SupplementProps): Promise<void> {
    await this.supplements.add(supplementPropsToRow(supplement) as SupplementRow);
  }
  async updateSupplement(supplement: SupplementProps): Promise<void> {
    await this.supplements.put(supplementPropsToRow(supplement) as SupplementRow);
  }
  async removeSupplement(id: string): Promise<void> {
    await this.supplements.delete(id);
  }

  async findFoodFrequencies(patientId: string): Promise<FoodFrequencyProps[]> {
    const rows = await this.foodFrequencies.where("patient_id").equals(patientId).toArray();
    return rows.map(foodFrequencyRowToProps);
  }
  async addFoodFrequency(ff: FoodFrequencyProps): Promise<void> {
    await this.foodFrequencies.add(foodFrequencyPropsToRow(ff) as FoodFrequencyRow);
  }
  async updateFoodFrequency(ff: FoodFrequencyProps): Promise<void> {
    await this.foodFrequencies.put(foodFrequencyPropsToRow(ff) as FoodFrequencyRow);
  }
  async removeFoodFrequency(id: string): Promise<void> {
    await this.foodFrequencies.delete(id);
  }

  async findGiSymptoms(patientId: string): Promise<GiSymptomProps[]> {
    const rows = await this.giSymptoms.where("patient_id").equals(patientId).toArray();
    return rows.map(giSymptomRowToProps);
  }
  async addGiSymptom(symptom: GiSymptomProps): Promise<void> {
    await this.giSymptoms.add(giSymptomPropsToRow(symptom) as GiSymptomRow);
  }
  async updateGiSymptom(symptom: GiSymptomProps): Promise<void> {
    await this.giSymptoms.put(giSymptomPropsToRow(symptom) as GiSymptomRow);
  }
  async removeGiSymptom(id: string): Promise<void> {
    await this.giSymptoms.delete(id);
  }
}
