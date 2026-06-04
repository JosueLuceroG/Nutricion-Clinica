import Dexie, { type Table } from "dexie";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";
import type { AnthropometryRow } from "@modules/anthropometry/infrastructure/anthropometryMapper";
import type { LabPanelRow } from "@modules/laboratory/infrastructure/labPanelMapper";
import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { MealPlanRow } from "@modules/mealplan/infrastructure/mealPlanMapper";
import type { SmaeCustomFoodRow } from "@modules/smae/infrastructure/smaeMapper";
import type { AllergyRow, MedicationRow, ClinicalEventRow, FamilyHistoryRow, PersonalHistoryRow, HabitRow, PhysicalActivityRow, DietHistoryRow, IntoleranceRow, SurgeryRow, HospitalizationRow, SupplementRow, FoodFrequencyRow, GiSymptomRow, SnapshotExpedienteRow } from "@modules/clinical-record/infrastructure/clinicalRecordMapper";
import type { AuditEventRow } from "@services/audit/infrastructure/auditEventMapper";
import type { SyncQueueItem } from "@modules/sync/domain/SyncQueueItem";

const PATIENT_STORES = [
  "id",
  "first_name",
  "last_name",
  "second_last_name",
  "[last_name+first_name]",
  "email",
  "status",
  "sex",
  "gender",
  "marital_status",
  "education",
  "record_status",
  "birth_date",
  "consentimiento_informado_id",
  "fecha_firma_consentimiento",
  "clinical_tags",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const ANTHROPOMETRY_STORES = [
  "id",
  "patient_id",
  "measured_at",
  "[patient_id+measured_at]",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const LAB_PANELS_STORES = [
  "id",
  "patient_id",
  "taken_at",
  "[patient_id+taken_at]",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const CONSULTATIONS_STORES = [
  "id",
  "patient_id",
  "consultation_date",
  "[patient_id+consultation_date]",
  "status",
  "anthropometry_id",
  "lab_panel_id",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const MEAL_PLANS_STORES = [
  "id",
  "patient_id",
  "start_date",
  "[patient_id+start_date]",
  "status",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const SMAE_CUSTOM_FOODS_STORES = "id, group, name, created_at";

const ALLERGIES_STORES = "id, patient_id, severity, created_at";
const MEDICATIONS_STORES = "id, patient_id, frequency, start_date, end_date, created_at";
const CLINICAL_EVENTS_STORES = "id, patient_id, type, date, created_at";
const FAMILY_HISTORIES_STORES = "id, patient_id, relationship, condition, created_at";
const PERSONAL_HISTORIES_STORES = "id, patient_id, condition, status, created_at";
const HABITS_STORES = "id, patient_id, category, status, created_at";
const PHYSICAL_ACTIVITIES_STORES = "id, patient_id, type, intensity, created_at";
const DIET_HISTORIES_STORES = "id, patient_id, diet_type, meals_per_day, created_at";
const INTOLERANCES_STORES = "id, patient_id, severity, mechanism, created_at";
const SURGERIES_STORES = "id, patient_id, type, date, created_at";
const HOSPITALIZATIONS_STORES = "id, patient_id, admission_date, created_at";
const SUPPLEMENTS_STORES = "id, patient_id, category, created_at";
const FOOD_FREQUENCIES_STORES = "id, patient_id, frequency, created_at";
const GI_SYMPTOMS_STORES = "id, patient_id, symptom_type, severity, created_at";
const SNAPSHOT_EXPEDIENTES_STORES = "id, consulta_id, patient_id, fecha_snapshot, created_at";
const AUDIT_EVENTS_STORES = "id, patient_id, user_id, module, action, resource_type, resource_id, created_at";
const SYNC_QUEUE_STORES = "id, entity, status, enqueued_at";

export class NutriClinicaDB extends Dexie {
  patients!: Table<PatientRow, string>;
  anthropometry!: Table<AnthropometryRow, string>;
  lab_panels!: Table<LabPanelRow, string>;
  consultations!: Table<ConsultationRow, string>;
  meal_plans!: Table<MealPlanRow, string>;
  smae_custom_foods!: Table<SmaeCustomFoodRow, string>;
  allergies!: Table<AllergyRow, string>;
  medications!: Table<MedicationRow, string>;
  clinical_events!: Table<ClinicalEventRow, string>;
  family_histories!: Table<FamilyHistoryRow, string>;
  personal_histories!: Table<PersonalHistoryRow, string>;
  habits!: Table<HabitRow, string>;
  physical_activities!: Table<PhysicalActivityRow, string>;
  diet_histories!: Table<DietHistoryRow, string>;
  intolerances!: Table<IntoleranceRow, string>;
  snapshot_expedientes!: Table<SnapshotExpedienteRow, string>;
  audit_events!: Table<AuditEventRow, string>;
  surgeries!: Table<SurgeryRow, string>;
  hospitalizations!: Table<HospitalizationRow, string>;
  supplements!: Table<SupplementRow, string>;
  food_frequencies!: Table<FoodFrequencyRow, string>;
  gi_symptoms!: Table<GiSymptomRow, string>;
  sync_queue!: Table<SyncQueueItem, string>;

  constructor(name = "nutriclinica") {
    super(name);

    this.version(1).stores({
      patients: [
        "id",
        "first_name",
        "last_name",
        "[last_name+first_name]",
        "email",
        "status",
        "sex",
        "birth_date",
        "created_at",
        "updated_at",
        "deleted_at",
      ].join(", "),
      anthropometry: ANTHROPOMETRY_STORES,
      lab_panels: LAB_PANELS_STORES,
      consultations: CONSULTATIONS_STORES,
      meal_plans: MEAL_PLANS_STORES,
    });

    this.version(2).stores({});

    this.version(3).stores({
      smae_custom_foods: SMAE_CUSTOM_FOODS_STORES,
    });

    this.version(4).stores({
      allergies: ALLERGIES_STORES,
      medications: MEDICATIONS_STORES,
      clinical_events: CLINICAL_EVENTS_STORES,
    });

    this.version(5).stores({
      patients: PATIENT_STORES,
    });

    this.version(6).stores({
      family_histories: FAMILY_HISTORIES_STORES,
      personal_histories: PERSONAL_HISTORIES_STORES,
      habits: HABITS_STORES,
      physical_activities: PHYSICAL_ACTIVITIES_STORES,
    });

    this.version(7).stores({
      diet_histories: DIET_HISTORIES_STORES,
    });

    this.version(8).stores({
      intolerances: INTOLERANCES_STORES,
      surgeries: SURGERIES_STORES,
      hospitalizations: HOSPITALIZATIONS_STORES,
      supplements: SUPPLEMENTS_STORES,
      food_frequencies: FOOD_FREQUENCIES_STORES,
      gi_symptoms: GI_SYMPTOMS_STORES,
    });

    this.version(9).stores({
      snapshot_expedientes: SNAPSHOT_EXPEDIENTES_STORES,
    });

    this.version(10).stores({
      audit_events: AUDIT_EVENTS_STORES,
    });

    this.version(11).stores({
      patients: PATIENT_STORES,
    });

    this.version(12).stores({
      sync_queue: SYNC_QUEUE_STORES,
    });
  }
}

export const db = new NutriClinicaDB();
