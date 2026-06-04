import type { AllergyProps } from "../domain/Allergy";
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
import type { SnapshotExpedienteProps } from "../domain/SnapshotExpediente";

export interface AllergyRow {
  id: string;
  patient_id: string;
  allergen: string;
  reaction: string;
  severity: string;
  diagnosis: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationRow {
  id: string;
  patient_id: string;
  name: string;
  active_ingredient: string;
  dose: string;
  frequency: string;
  route: string;
  start_date: string;
  end_date: string | null;
  prescribed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalEventRow {
  id: string;
  patient_id: string;
  type: string;
  name: string;
  description: string | null;
  date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const allergyRowToProps = (row: AllergyRow): AllergyProps => ({
  id: row.id,
  patientId: row.patient_id,
  allergen: row.allergen,
  reaction: row.reaction,
  severity: row.severity as AllergyProps["severity"],
  diagnosis: row.diagnosis as AllergyProps["diagnosis"],
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const allergyPropsToRow = (p: AllergyProps): AllergyRow => ({
  id: p.id,
  patient_id: p.patientId,
  allergen: p.allergen,
  reaction: p.reaction,
  severity: p.severity,
  diagnosis: p.diagnosis,
  notes: p.notes,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export const medicationRowToProps = (row: MedicationRow): MedicationProps => ({
  id: row.id,
  patientId: row.patient_id,
  name: row.name,
  activeIngredient: row.active_ingredient,
  dose: row.dose,
  frequency: row.frequency as MedicationFreq,
  route: row.route,
  startDate: row.start_date,
  endDate: row.end_date,
  prescribedBy: row.prescribed_by,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const medicationPropsToRow = (p: MedicationProps): MedicationRow => ({
  id: p.id,
  patient_id: p.patientId,
  name: p.name,
  active_ingredient: p.activeIngredient,
  dose: p.dose,
  frequency: p.frequency,
  route: p.route,
  start_date: p.startDate,
  end_date: p.endDate,
  prescribed_by: p.prescribedBy,
  notes: p.notes,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export const clinicalEventRowToProps = (row: ClinicalEventRow): ClinicalEventProps => ({
  id: row.id,
  patientId: row.patient_id,
  type: row.type as EventType,
  name: row.name,
  description: row.description,
  date: row.date,
  endDate: row.end_date,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const clinicalEventPropsToRow = (p: ClinicalEventProps): ClinicalEventRow => ({
  id: p.id,
  patient_id: p.patientId,
  type: p.type,
  name: p.name,
  description: p.description,
  date: p.date,
  end_date: p.endDate,
  notes: p.notes,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export interface FamilyHistoryRow {
  id: string; patient_id: string; relationship: string; condition: string;
  diagnosis_age: number | null; notes: string | null;
  created_at: string; updated_at: string;
}

export interface PersonalHistoryRow {
  id: string; patient_id: string; condition: string;
  diagnosis_date: string | null; status: string;
  treating_physician: string | null; treatment: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

export interface HabitRow {
  id: string; patient_id: string; category: string;
  status: string; frequency: string | null; quantity: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

export interface PhysicalActivityRow {
  id: string; patient_id: string; type: string;
  frequency_per_week: number; duration_minutes: number; intensity: string;
  start_date: string | null; end_date: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

export const familyHistoryRowToProps = (row: FamilyHistoryRow): FamilyHistoryProps => ({
  id: row.id, patientId: row.patient_id,
  relationship: row.relationship as FamilyRelationship,
  condition: row.condition as Condition,
  diagnosisAge: row.diagnosis_age, notes: row.notes,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
export const familyHistoryPropsToRow = (p: FamilyHistoryProps): FamilyHistoryRow => ({
  id: p.id, patient_id: p.patientId, relationship: p.relationship,
  condition: p.condition, diagnosis_age: p.diagnosisAge, notes: p.notes,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export interface IntoleranceRow {
  id: string; patient_id: string; food: string; symptom: string;
  severity: string; threshold_dose: string | null; mechanism: string;
  notes: string | null; created_at: string; updated_at: string;
}

export const intoleranceRowToProps = (row: IntoleranceRow): IntoleranceProps => ({
  id: row.id, patientId: row.patient_id, food: row.food, symptom: row.symptom,
  severity: row.severity as IntoleranceSeverity,
  thresholdDose: row.threshold_dose, mechanism: row.mechanism as Mechanism,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});

export const intolerancePropsToRow = (p: IntoleranceProps): IntoleranceRow => ({
  id: p.id, patient_id: p.patientId, food: p.food, symptom: p.symptom,
  severity: p.severity, threshold_dose: p.thresholdDose, mechanism: p.mechanism,
  notes: p.notes, created_at: p.createdAt, updated_at: p.updatedAt,
});
export const personalHistoryRowToProps = (row: PersonalHistoryRow): PersonalHistoryProps => ({
  id: row.id, patientId: row.patient_id,
  condition: row.condition as PersonalCondition,
  diagnosisDate: row.diagnosis_date, status: row.status,
  treatingPhysician: row.treating_physician, treatment: row.treatment,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});
export const personalHistoryPropsToRow = (p: PersonalHistoryProps): PersonalHistoryRow => ({
  id: p.id, patient_id: p.patientId, condition: p.condition,
  diagnosis_date: p.diagnosisDate, status: p.status,
  treating_physician: p.treatingPhysician, treatment: p.treatment,
  notes: p.notes, created_at: p.createdAt, updated_at: p.updatedAt,
});

export const habitRowToProps = (row: HabitRow): HabitProps => ({
  id: row.id, patientId: row.patient_id,
  category: row.category as HabitCategory,
  status: row.status, frequency: row.frequency, quantity: row.quantity,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});
export const habitPropsToRow = (p: HabitProps): HabitRow => ({
  id: p.id, patient_id: p.patientId, category: p.category,
  status: p.status, frequency: p.frequency, quantity: p.quantity,
  notes: p.notes, created_at: p.createdAt, updated_at: p.updatedAt,
});

export const physicalActivityRowToProps = (row: PhysicalActivityRow): PhysicalActivityProps => ({
  id: row.id, patientId: row.patient_id,
  type: row.type as ActivityType,
  frequencyPerWeek: row.frequency_per_week,
  durationMinutes: row.duration_minutes,
  intensity: row.intensity as BorgIntensity,
  startDate: row.start_date, endDate: row.end_date,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});
export const physicalActivityPropsToRow = (p: PhysicalActivityProps): PhysicalActivityRow => ({
  id: p.id, patient_id: p.patientId, type: p.type,
  frequency_per_week: p.frequencyPerWeek, duration_minutes: p.durationMinutes,
  intensity: p.intensity, start_date: p.startDate, end_date: p.endDate,
  notes: p.notes, created_at: p.createdAt, updated_at: p.updatedAt,
});

export interface DietHistoryRow {
  id: string; patient_id: string; diet_type: string;
  meals_per_day: number; meal_schedule: string; meal_place: string;
  meal_preparer: string; time_available: string; budget: string;
  kitchen_equipment: string; previous_diets: string; label_reading: number;
  nutritional_knowledge: string; preferences: string; aversions: string;
  chewing: string; work_schedule: string; household_people: number;
  notes: string | null; created_at: string; updated_at: string;
}

export const dietHistoryRowToProps = (row: DietHistoryRow): DietHistoryProps => ({
  id: row.id, patientId: row.patient_id,
  dietType: row.diet_type as DietType,
  mealsPerDay: row.meals_per_day,
  mealSchedule: row.meal_schedule,
  mealPlace: row.meal_place as MealPlace,
  mealPreparer: row.meal_preparer,
  timeAvailable: row.time_available,
  budget: row.budget,
  kitchenEquipment: row.kitchen_equipment,
  previousDiets: row.previous_diets,
  labelReading: row.label_reading === 1,
  nutritionalKnowledge: row.nutritional_knowledge,
  preferences: row.preferences,
  aversions: row.aversions,
  chewing: row.chewing,
  workSchedule: row.work_schedule,
  householdPeople: row.household_people,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const dietHistoryPropsToRow = (p: DietHistoryProps): DietHistoryRow => ({
  id: p.id, patient_id: p.patientId,
  diet_type: p.dietType,
  meals_per_day: p.mealsPerDay,
  meal_schedule: p.mealSchedule,
  meal_place: p.mealPlace,
  meal_preparer: p.mealPreparer,
  time_available: p.timeAvailable,
  budget: p.budget,
  kitchen_equipment: p.kitchenEquipment,
  previous_diets: p.previousDiets,
  label_reading: p.labelReading ? 1 : 0,
  nutritional_knowledge: p.nutritionalKnowledge,
  preferences: p.preferences,
  aversions: p.aversions,
  chewing: p.chewing,
  work_schedule: p.workSchedule,
  household_people: p.householdPeople,
  notes: p.notes,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export interface SurgeryRow {
  id: string; patient_id: string; type: string; date: string;
  hospital: string; complications: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export const surgeryRowToProps = (row: SurgeryRow): SurgeryProps => ({
  id: row.id, patientId: row.patient_id, type: row.type as SurgeryType,
  date: row.date, hospital: row.hospital, complications: row.complications,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});
export const surgeryPropsToRow = (p: SurgeryProps): SurgeryRow => ({
  id: p.id, patient_id: p.patientId, type: p.type, date: p.date,
  hospital: p.hospital, complications: p.complications, notes: p.notes,
  created_at: p.createdAt, updated_at: p.updatedAt,
});

export interface HospitalizationRow {
  id: string; patient_id: string; reason: string;
  admission_date: string; discharge_date: string | null;
  stay_days: number; hospital: string; notes: string | null;
  created_at: string; updated_at: string;
}
export const hospitalizationRowToProps = (row: HospitalizationRow): HospitalizationProps => ({
  id: row.id, patientId: row.patient_id, reason: row.reason,
  admissionDate: row.admission_date, dischargeDate: row.discharge_date,
  stayDays: row.stay_days, hospital: row.hospital, notes: row.notes,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
export const hospitalizationPropsToRow = (p: HospitalizationProps): HospitalizationRow => ({
  id: p.id, patient_id: p.patientId, reason: p.reason,
  admission_date: p.admissionDate, discharge_date: p.dischargeDate,
  stay_days: p.stayDays, hospital: p.hospital, notes: p.notes,
  created_at: p.createdAt, updated_at: p.updatedAt,
});

export interface SupplementRow {
  id: string; patient_id: string; name: string; brand: string;
  category: string; composition: string; dose: string; frequency: string;
  prescribed_by: string | null; start_date: string | null; end_date: string | null;
  notes: string | null; created_at: string; updated_at: string;
}
export const supplementRowToProps = (row: SupplementRow): SupplementProps => ({
  id: row.id, patientId: row.patient_id, name: row.name, brand: row.brand,
  category: row.category as SupplementCategory, composition: row.composition,
  dose: row.dose, frequency: row.frequency,
  prescribedBy: row.prescribed_by, startDate: row.start_date, endDate: row.end_date,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});
export const supplementPropsToRow = (p: SupplementProps): SupplementRow => ({
  id: p.id, patient_id: p.patientId, name: p.name, brand: p.brand,
  category: p.category, composition: p.composition, dose: p.dose,
  frequency: p.frequency, prescribed_by: p.prescribedBy,
  start_date: p.startDate, end_date: p.endDate, notes: p.notes,
  created_at: p.createdAt, updated_at: p.updatedAt,
});

export interface FoodFrequencyRow {
  id: string; patient_id: string; food_group_id: string;
  food_group_name: string; frequency: string; quantity: string;
  preparation: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export const foodFrequencyRowToProps = (row: FoodFrequencyRow): FoodFrequencyProps => ({
  id: row.id, patientId: row.patient_id, foodGroupId: row.food_group_id,
  foodGroupName: row.food_group_name, frequency: row.frequency as FrequencyValue,
  quantity: row.quantity, preparation: row.preparation, notes: row.notes,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
export const foodFrequencyPropsToRow = (p: FoodFrequencyProps): FoodFrequencyRow => ({
  id: p.id, patient_id: p.patientId, food_group_id: p.foodGroupId,
  food_group_name: p.foodGroupName, frequency: p.frequency,
  quantity: p.quantity, preparation: p.preparation, notes: p.notes,
  created_at: p.createdAt, updated_at: p.updatedAt,
});

export interface GiSymptomRow {
  id: string; patient_id: string; symptom_type: string;
  description: string; frequency: string; severity: number;
  food_relation: string | null; onset_date: string | null;
  triggers: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export const giSymptomRowToProps = (row: GiSymptomRow): GiSymptomProps => ({
  id: row.id, patientId: row.patient_id,
  symptomType: row.symptom_type as GiSymptomType,
  description: row.description, frequency: row.frequency,
  severity: row.severity, foodRelation: row.food_relation,
  onsetDate: row.onset_date, triggers: row.triggers, notes: row.notes,
  createdAt: row.created_at, updatedAt: row.updated_at,
});
export const giSymptomPropsToRow = (p: GiSymptomProps): GiSymptomRow => ({
  id: p.id, patient_id: p.patientId, symptom_type: p.symptomType,
  description: p.description, frequency: p.frequency, severity: p.severity,
  food_relation: p.foodRelation, onset_date: p.onsetDate,
  triggers: p.triggers, notes: p.notes,
  created_at: p.createdAt, updated_at: p.updatedAt,
});

export interface SnapshotExpedienteRow {
  id: string; consulta_id: string; patient_id: string;
  fecha_snapshot: string; contenido_json_expediente: string;
  contenido_json_antropometria: string | null;
  contenido_json_bioquimica: string | null;
  contenido_json_plan: string | null;
  hash_integridad: string; version_smae: string;
  profesional_id: string; created_at: string;
}
export const snapshotExpedienteRowToProps = (row: SnapshotExpedienteRow): SnapshotExpedienteProps => ({
  id: row.id, consultaId: row.consulta_id, patientId: row.patient_id,
  fechaSnapshot: row.fecha_snapshot,
  contenidoJsonExpediente: row.contenido_json_expediente,
  contenidoJsonAntropometria: row.contenido_json_antropometria,
  contenidoJsonBioquimica: row.contenido_json_bioquimica,
  contenidoJsonPlan: row.contenido_json_plan,
  hashIntegridad: row.hash_integridad, versionSmae: row.version_smae,
  profesionalId: row.profesional_id, createdAt: row.created_at,
});
export const snapshotExpedientePropsToRow = (p: SnapshotExpedienteProps): SnapshotExpedienteRow => ({
  id: p.id, consulta_id: p.consultaId, patient_id: p.patientId,
  fecha_snapshot: p.fechaSnapshot,
  contenido_json_expediente: p.contenidoJsonExpediente,
  contenido_json_antropometria: p.contenidoJsonAntropometria,
  contenido_json_bioquimica: p.contenidoJsonBioquimica,
  contenido_json_plan: p.contenidoJsonPlan,
  hash_integridad: p.hashIntegridad, version_smae: p.versionSmae,
  profesional_id: p.profesionalId, created_at: p.createdAt,
});
