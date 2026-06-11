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
import type { AppointmentRow, ScheduleRow, BlockRow } from "@modules/agenda/infrastructure/agendaMapper";
import type { RecipeRow } from "@modules/recipes/infrastructure/recipeMapper";
import type { MedicationCatalogRow, NutrientInteractionRow } from "@modules/medication/infrastructure/medicationMapper";
import type { GoalRow } from "@modules/goals/infrastructure/goalMapper";
import type { AdherenceRecordRow, AdherenceIndexRow, BarrierEventRow } from "@modules/adherence/infrastructure/adherenceMapper";
import type { DocumentRow } from "@modules/documents/infrastructure/documentMapper";
import type { WeeklyPlanRow, ShoppingListRow } from "@modules/meal-planner/infrastructure/mealPlannerMapper";
import type { BiaDeviceProps } from "@modules/anthropometry/domain/BiaReading";
import type { IndicatorRow, IndicatorValueRow, GeneratedReportRow, DashboardConfigRow } from "@modules/reports/infrastructure/reportMapper";
import type { PatientConsent } from "@modules/auth/PatientConsentService";
import type { EvolutionRecordRow, EvolutionIndicatorRow, TemporalComparisonRow, StagnationAlertRow } from "@modules/evolution/infrastructure/evolutionMapper";
import type { PaymentRow } from "@modules/payment/infrastructure/paymentMapper";
import type { ExpenseRow } from "@modules/expense/infrastructure/expenseMapper";

export interface AICacheRow {
  key: string;
  capability: string;
  response: string;
  confidence: number;
  created_at: string;
  expires_at: string;
}

export interface AIUsageLogRow {
  id: string;
  capability: string;
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
  success: boolean;
  created_at: string;
}

export interface TelemedicinaRecordingRow {
  id: string;
  sala_id: string;
  created_by: string | null;
  created_at: string;
  duration_ms: number;
  mime_type: string;
  original_size_bytes: number;
  encrypted_size_bytes: number;
  iv: string;
  encrypted_blob: Blob;
  consent_accepted_at: string;
  consent_text_version: string;
  remote_id?: string | null;
  remote_uploaded_at?: string | null;
}

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
  "clave_interna",
  "birth_place",
  "address",
  "nationality",
  "id_type",
  "id_number",
  "discharge_reason",
  "responsible_professional_id",
  "external_record_number",
  "photo_url",
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
  "paid",
  "anthropometry_id",
  "lab_panel_id",
  "created_at",
  "updated_at",
  "deleted_at",
].join(", ");

const CONSULTATIONS_BILLING_STORES = [
  "id",
  "patient_id",
  "consultation_date",
  "[patient_id+consultation_date]",
  "status",
  "paid",
  "payment_status",
  "[patient_id+paid+consultation_date]",
  "[patient_id+payment_status+consultation_date]",
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
const APPOINTMENTS_STORES = [
  "id",
  "patient_id",
  "professional_id",
  "date",
  "status",
  "type",
  "[date+professional_id]",
  "start_time",
  "created_at",
  "updated_at",
].join(", ");
const SCHEDULES_STORES = "id, professional_id, day_of_week";
const BLOCKS_STORES = "id, professional_id, start_date, end_date";
const RECIPES_STORES = "id, name, category, difficulty, status, created_at";
const GOALS_STORES = "id, patient_id, type, variable, status, priority, start_date, target_date";
const ADHERENCE_RECORDS_STORES = "id, patient_id, date, source, [patient_id+date]";
const ADHERENCE_INDEXES_STORES = "id, patient_id, period_start, period_end";
const ADHERENCE_BARRIERS_STORES = "id, patient_id, type, date";
const DOCUMENTS_STORES = "id, patient_id, type, status, generated_by, generated_at";
const WEEKLY_PLANS_STORES = "id, patient_id, type, status, start_date, end_date";
const SHOPPING_LISTS_STORES = "id, patient_id, weekly_plan_id, generated_at";
const MEDICATION_CATALOG_STORES = "id, nombre_comercial, principio_activo, via_administracion, categoria_farmacologica, created_at";
const NUTRIENT_INTERACTIONS_STORES = "id, medicamento_id, nutriente, tipo, severidad, created_at";
const BIA_DEVICES_STORES = "id, name, type";
const INDICATORS_STORES = "id, name, category, calculation_type, refresh_frequency, is_active, created_at";
const INDICATOR_VALUES_STORES = "id, indicator_id, dimension, dimension_type, [indicator_id+dimension], created_at";
const GENERATED_REPORTS_STORES = "id, type, status, generated_by, generated_at";
const DASHBOARD_CONFIGS_STORES = "id, user_id, widget_type, is_visible, position, created_at";
const PATIENT_CONSENTS_STORES = "id, patient_id, type, signed_at, revoked_at";
const AI_CACHE_STORES = ["key", "capability", "created_at", "expires_at"].join(", ");
const AI_USAGE_LOGS_STORES = ["id", "capability", "created_at"].join(", ");
const TELEMEDICINA_RECORDINGS_STORES = "id, sala_id, created_by, created_at";
const SYNC_META_STORES = "key";

const EVOLUTION_RECORDS_STORES = "id, patient_id, consultation_id, professional_id, created_at";
const EVOLUTION_INDICATORS_STORES = "id, patient_id, variable, status, calculated_at";
const TEMPORAL_COMPARISONS_STORES = "id, patient_id, current_consultation_id, compared_consultation_id";
const STAGNATION_ALERTS_STORES = "id, patient_id, variable, severity, generated_at";

export interface SyncMetaRow {
  key: string;
  value: string;
}

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
  appointments!: Table<AppointmentRow, string>;
  schedules!: Table<ScheduleRow, string>;
  blocks!: Table<BlockRow, string>;
  recipes!: Table<RecipeRow, string>;
  goals!: Table<GoalRow, string>;
  adherence_records!: Table<AdherenceRecordRow, string>;
  adherence_indexes!: Table<AdherenceIndexRow, string>;
  adherence_barriers!: Table<BarrierEventRow, string>;
  documents!: Table<DocumentRow, string>;
  weekly_plans!: Table<WeeklyPlanRow, string>;
  shopping_lists!: Table<ShoppingListRow, string>;
  medication_catalog!: Table<MedicationCatalogRow, string>;
  nutrient_interactions!: Table<NutrientInteractionRow, string>;
  bia_devices!: Table<BiaDeviceProps, string>;
  indicators!: Table<IndicatorRow, string>;
  indicator_values!: Table<IndicatorValueRow, string>;
  generated_reports!: Table<GeneratedReportRow, string>;
  dashboard_configs!: Table<DashboardConfigRow, string>;
  patient_consents!: Table<PatientConsent, string>;
  ai_cache!: Table<AICacheRow>;
  ai_usage_logs!: Table<AIUsageLogRow>;
  telemedicina_recordings!: Table<TelemedicinaRecordingRow, string>;
  sync_meta!: Table<SyncMetaRow, string>;
  evolution_records!: Table<EvolutionRecordRow, string>;
  evolution_indicators!: Table<EvolutionIndicatorRow, string>;
  temporal_comparisons!: Table<TemporalComparisonRow, string>;
  stagnation_alerts!: Table<StagnationAlertRow, string>;
  payments!: Table<PaymentRow, string>;
  expenses!: Table<ExpenseRow, string>;

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

    this.version(13).stores({
      consultations: CONSULTATIONS_BILLING_STORES,
    });

    this.version(14).stores({
      appointments: APPOINTMENTS_STORES,
      schedules: SCHEDULES_STORES,
      blocks: BLOCKS_STORES,
    });

    this.version(15).stores({
      recipes: RECIPES_STORES,
    });

    this.version(16).stores({
      goals: GOALS_STORES,
    });

    this.version(17).stores({
      adherence_records: ADHERENCE_RECORDS_STORES,
      adherence_indexes: ADHERENCE_INDEXES_STORES,
      adherence_barriers: ADHERENCE_BARRIERS_STORES,
    });

    this.version(18).stores({
      documents: DOCUMENTS_STORES,
    });

    this.version(19).stores({
      weekly_plans: WEEKLY_PLANS_STORES,
      shopping_lists: SHOPPING_LISTS_STORES,
    });

    this.version(20).stores({
      bia_devices: BIA_DEVICES_STORES,
    });

    this.version(21).stores({
      medication_catalog: MEDICATION_CATALOG_STORES,
      nutrient_interactions: NUTRIENT_INTERACTIONS_STORES,
    });

    this.version(22).stores({
      indicators: INDICATORS_STORES,
      indicator_values: INDICATOR_VALUES_STORES,
      generated_reports: GENERATED_REPORTS_STORES,
      dashboard_configs: DASHBOARD_CONFIGS_STORES,
    });

    this.version(23).stores({
      patient_consents: PATIENT_CONSENTS_STORES,
    });

    this.version(24).stores({
      ai_cache: AI_CACHE_STORES,
      ai_usage_logs: AI_USAGE_LOGS_STORES,
    });

    this.version(25).stores({
      telemedicina_recordings: TELEMEDICINA_RECORDINGS_STORES,
    });

    this.version(26).stores({
      sync_meta: SYNC_META_STORES,
    });

    this.version(27).stores({
      evolution_records: EVOLUTION_RECORDS_STORES,
      evolution_indicators: EVOLUTION_INDICATORS_STORES,
      temporal_comparisons: TEMPORAL_COMPARISONS_STORES,
      stagnation_alerts: STAGNATION_ALERTS_STORES,
    });

    this.version(28).stores({
      patients: PATIENT_STORES,
    });

    this.version(29).stores({
      consultations: CONSULTATIONS_BILLING_STORES,
      payments: "id, patient_id, consultation_id, status, concept, payment_date, [patient_id+status+payment_date], created_at",
      expenses: "id, patient_id, category, expense_date, [patient_id+expense_date], created_at",
    });
  }
}

export const db = new NutriClinicaDB();
