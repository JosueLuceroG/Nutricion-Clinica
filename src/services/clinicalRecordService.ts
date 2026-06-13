import { DexieClinicalRecordRepository } from "@modules/clinical-record/infrastructure/DexieClinicalRecordRepository";
import { DexieSnapshotExpedienteRepository } from "@modules/clinical-record/infrastructure/DexieSnapshotExpedienteRepository";
import { db } from "@services/db/dexieSchema";
import {
  CreateAllergyUseCase,
  UpdateAllergyUseCase,
  RemoveAllergyUseCase,
  ListAllergiesUseCase,
  CreateMedicationUseCase,
  UpdateMedicationUseCase,
  RemoveMedicationUseCase,
  ListMedicationsUseCase,
  CreateClinicalEventUseCase,
  UpdateClinicalEventUseCase,
  RemoveClinicalEventUseCase,
  ListClinicalEventsUseCase,
  CreateFamilyHistoryUseCase,
  UpdateFamilyHistoryUseCase,
  RemoveFamilyHistoryUseCase,
  ListFamilyHistoriesUseCase,
  CreatePersonalHistoryUseCase,
  UpdatePersonalHistoryUseCase,
  RemovePersonalHistoryUseCase,
  ListPersonalHistoriesUseCase,
  CreateHabitUseCase,
  UpdateHabitUseCase,
  RemoveHabitUseCase,
  ListHabitsUseCase,
  CreatePhysicalActivityUseCase,
  UpdatePhysicalActivityUseCase,
  RemovePhysicalActivityUseCase,
  ListPhysicalActivitiesUseCase,
  GetDietHistoryUseCase,
  SaveDietHistoryUseCase,
  UpdateDietHistoryUseCase,
  CreateIntoleranceUseCase,
  UpdateIntoleranceUseCase,
  RemoveIntoleranceUseCase,
  ListIntolerancesUseCase,
  CreateSurgeryUseCase,
  UpdateSurgeryUseCase,
  RemoveSurgeryUseCase,
  ListSurgeriesUseCase,
  CreateHospitalizationUseCase,
  UpdateHospitalizationUseCase,
  RemoveHospitalizationUseCase,
  ListHospitalizationsUseCase,
  CreateSupplementUseCase,
  UpdateSupplementUseCase,
  RemoveSupplementUseCase,
  ListSupplementsUseCase,
  CreateFoodFrequencyUseCase,
  UpdateFoodFrequencyUseCase,
  RemoveFoodFrequencyUseCase,
  ListFoodFrequenciesUseCase,
  CreateGiSymptomUseCase,
  UpdateGiSymptomUseCase,
  RemoveGiSymptomUseCase,
  ListGiSymptomsUseCase,
  CreateSnapshotExpedienteUseCase,
  GetSnapshotByConsultaUseCase,
  ListSnapshotsByPatientUseCase,
} from "@modules/clinical-record/application/clinicalRecordUseCases";
import type { ClinicalRecordRepository } from "@modules/clinical-record/domain/ClinicalRecordRepository";
import type { AllergyCreate, AllergyProps } from "@modules/clinical-record/domain/Allergy";
import type { FamilyHistoryCreate, FamilyHistoryProps } from "@modules/clinical-record/domain/FamilyHistory";
import type { PersonalHistoryCreate, PersonalHistoryProps } from "@modules/clinical-record/domain/PersonalHistory";
import type { IntoleranceCreate, IntoleranceProps } from "@modules/clinical-record/domain/Intolerance";
import { PatientId } from "@modules/patient/domain/PatientId";
import { clinicalRuleService } from "./clinicalRuleService";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";
import type { AuditAction, AuditResourceType } from "@services/audit/domain/AuditEvent";

const repository: ClinicalRecordRepository = new DexieClinicalRecordRepository(db);
const snapshotRepository = new DexieSnapshotExpedienteRepository(db);

const rawCreateFamilyHistory = new CreateFamilyHistoryUseCase(repository);
const rawUpdateFamilyHistory = new UpdateFamilyHistoryUseCase(repository);
const rawRemoveFamilyHistory = new RemoveFamilyHistoryUseCase(repository);
const rawCreatePersonalHistory = new CreatePersonalHistoryUseCase(repository);
const rawUpdatePersonalHistory = new UpdatePersonalHistoryUseCase(repository);
const rawRemovePersonalHistory = new RemovePersonalHistoryUseCase(repository);
const rawCreateAllergy = new CreateAllergyUseCase(repository);
const rawUpdateAllergy = new UpdateAllergyUseCase(repository);
const rawRemoveAllergy = new RemoveAllergyUseCase(repository);
const rawCreateMedication = new CreateMedicationUseCase(repository);
const rawUpdateMedication = new UpdateMedicationUseCase(repository);
const rawRemoveMedication = new RemoveMedicationUseCase(repository);
const rawCreateClinicalEvent = new CreateClinicalEventUseCase(repository);
const rawUpdateClinicalEvent = new UpdateClinicalEventUseCase(repository);
const rawRemoveClinicalEvent = new RemoveClinicalEventUseCase(repository);
const rawCreateHabit = new CreateHabitUseCase(repository);
const rawUpdateHabit = new UpdateHabitUseCase(repository);
const rawRemoveHabit = new RemoveHabitUseCase(repository);
const rawCreatePhysicalActivity = new CreatePhysicalActivityUseCase(repository);
const rawUpdatePhysicalActivity = new UpdatePhysicalActivityUseCase(repository);
const rawRemovePhysicalActivity = new RemovePhysicalActivityUseCase(repository);
const rawSaveDietHistory = new SaveDietHistoryUseCase(repository);
const rawUpdateDietHistory = new UpdateDietHistoryUseCase(repository);
const rawCreateIntolerance = new CreateIntoleranceUseCase(repository);
const rawUpdateIntolerance = new UpdateIntoleranceUseCase(repository);
const rawRemoveIntolerance = new RemoveIntoleranceUseCase(repository);
const rawCreateSurgery = new CreateSurgeryUseCase(repository);
const rawUpdateSurgery = new UpdateSurgeryUseCase(repository);
const rawRemoveSurgery = new RemoveSurgeryUseCase(repository);
const rawCreateHospitalization = new CreateHospitalizationUseCase(repository);
const rawUpdateHospitalization = new UpdateHospitalizationUseCase(repository);
const rawRemoveHospitalization = new RemoveHospitalizationUseCase(repository);
const rawCreateSupplement = new CreateSupplementUseCase(repository);
const rawUpdateSupplement = new UpdateSupplementUseCase(repository);
const rawRemoveSupplement = new RemoveSupplementUseCase(repository);
const rawCreateFoodFrequency = new CreateFoodFrequencyUseCase(repository);
const rawUpdateFoodFrequency = new UpdateFoodFrequencyUseCase(repository);
const rawRemoveFoodFrequency = new RemoveFoodFrequencyUseCase(repository);
const rawCreateGiSymptom = new CreateGiSymptomUseCase(repository);
const rawUpdateGiSymptom = new UpdateGiSymptomUseCase(repository);
const rawRemoveGiSymptom = new RemoveGiSymptomUseCase(repository);
const rawCreateSnapshot = new CreateSnapshotExpedienteUseCase(snapshotRepository);

type PatientScopedEntity = { id: { toString(): string }; patientId: string };
type PatientScopedRow = { patient_id?: string | null };
type PatientScopedTable = { get(id: string): Promise<PatientScopedRow | undefined> };
type RemoveClinicalRecordUseCase = { execute(id: string): Promise<void> };

const CLINICAL_RECORD_MODULE = "clinical_record";

async function auditClinicalRecordEntity(
  entity: PatientScopedEntity,
  action: AuditAction,
  resourceType: AuditResourceType,
  justification?: string,
): Promise<void> {
  await recordClinicalAudit({
    module: CLINICAL_RECORD_MODULE,
    action,
    resourceType,
    resourceId: entity.id.toString(),
    patientId: entity.patientId,
    justification,
  });
}

async function removeClinicalRecordResource(
  id: string,
  table: PatientScopedTable,
  removeUseCase: RemoveClinicalRecordUseCase,
  resourceType: AuditResourceType,
): Promise<void> {
  const existing = await table.get(id);
  await removeUseCase.execute(id);
  await recordClinicalAudit({
    module: CLINICAL_RECORD_MODULE,
    action: "remove",
    resourceType,
    resourceId: id,
    patientId: existing?.patient_id ?? null,
  });
}

export const clinicalRecordService = {
  allergies: {
    create: async (input: AllergyCreate) => {
      const result = await rawCreateAllergy.execute(input);
      await auditClinicalRecordEntity(result, "create", "allergy");
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: AllergyProps) => {
      const result = await rawUpdateAllergy.execute(props);
      await auditClinicalRecordEntity(result, "update", "allergy");
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.allergies, rawRemoveAllergy, "allergy") },
    list: new ListAllergiesUseCase(repository),
  },
  medications: {
    create: {
      async execute(input: Parameters<typeof rawCreateMedication.execute>[0]): ReturnType<typeof rawCreateMedication.execute> {
        const result = await rawCreateMedication.execute(input);
        await auditClinicalRecordEntity(result, "create", "medication");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateMedication.execute>[0]): ReturnType<typeof rawUpdateMedication.execute> {
        const result = await rawUpdateMedication.execute(props);
        await auditClinicalRecordEntity(result, "update", "medication");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.medications, rawRemoveMedication, "medication") },
    list: new ListMedicationsUseCase(repository),
  },
  clinicalEvents: {
    create: {
      async execute(input: Parameters<typeof rawCreateClinicalEvent.execute>[0]): ReturnType<typeof rawCreateClinicalEvent.execute> {
        const result = await rawCreateClinicalEvent.execute(input);
        await auditClinicalRecordEntity(result, "create", "clinical_event");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateClinicalEvent.execute>[0]): ReturnType<typeof rawUpdateClinicalEvent.execute> {
        const result = await rawUpdateClinicalEvent.execute(props);
        await auditClinicalRecordEntity(result, "update", "clinical_event");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.clinical_events, rawRemoveClinicalEvent, "clinical_event") },
    list: new ListClinicalEventsUseCase(repository),
  },
  familyHistories: {
    create: async (input: FamilyHistoryCreate) => {
      const result = await rawCreateFamilyHistory.execute(input);
      await auditClinicalRecordEntity(result, "create", "family_history");
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: FamilyHistoryProps) => {
      const result = await rawUpdateFamilyHistory.execute(props);
      await auditClinicalRecordEntity(result, "update", "family_history");
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.family_histories, rawRemoveFamilyHistory, "family_history") },
    list: new ListFamilyHistoriesUseCase(repository),
  },
  personalHistories: {
    create: async (input: PersonalHistoryCreate) => {
      const result = await rawCreatePersonalHistory.execute(input);
      await auditClinicalRecordEntity(result, "create", "personal_history");
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: PersonalHistoryProps) => {
      const result = await rawUpdatePersonalHistory.execute(props);
      await auditClinicalRecordEntity(result, "update", "personal_history");
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.personal_histories, rawRemovePersonalHistory, "personal_history") },
    list: new ListPersonalHistoriesUseCase(repository),
  },
  habits: {
    create: {
      async execute(input: Parameters<typeof rawCreateHabit.execute>[0]): ReturnType<typeof rawCreateHabit.execute> {
        const result = await rawCreateHabit.execute(input);
        await auditClinicalRecordEntity(result, "create", "habit");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateHabit.execute>[0]): ReturnType<typeof rawUpdateHabit.execute> {
        const result = await rawUpdateHabit.execute(props);
        await auditClinicalRecordEntity(result, "update", "habit");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.habits, rawRemoveHabit, "habit") },
    list: new ListHabitsUseCase(repository),
  },
  physicalActivities: {
    create: {
      async execute(input: Parameters<typeof rawCreatePhysicalActivity.execute>[0]): ReturnType<typeof rawCreatePhysicalActivity.execute> {
        const result = await rawCreatePhysicalActivity.execute(input);
        await auditClinicalRecordEntity(result, "create", "physical_activity");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdatePhysicalActivity.execute>[0]): ReturnType<typeof rawUpdatePhysicalActivity.execute> {
        const result = await rawUpdatePhysicalActivity.execute(props);
        await auditClinicalRecordEntity(result, "update", "physical_activity");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.physical_activities, rawRemovePhysicalActivity, "physical_activity") },
    list: new ListPhysicalActivitiesUseCase(repository),
  },
  dietHistory: {
    get: new GetDietHistoryUseCase(repository),
    save: {
      async execute(input: Parameters<typeof rawSaveDietHistory.execute>[0]): ReturnType<typeof rawSaveDietHistory.execute> {
        const result = await rawSaveDietHistory.execute(input);
        await auditClinicalRecordEntity(result, "create", "diet_history");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateDietHistory.execute>[0]): ReturnType<typeof rawUpdateDietHistory.execute> {
        const result = await rawUpdateDietHistory.execute(props);
        await auditClinicalRecordEntity(result, "update", "diet_history");
        return result;
      },
    },
  },
  intolerances: {
    create: async (input: IntoleranceCreate) => {
      const result = await rawCreateIntolerance.execute(input);
      await auditClinicalRecordEntity(result, "create", "intolerance");
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: IntoleranceProps) => {
      const result = await rawUpdateIntolerance.execute(props);
      await auditClinicalRecordEntity(result, "update", "intolerance");
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.intolerances, rawRemoveIntolerance, "intolerance") },
    list: new ListIntolerancesUseCase(repository),
  },
  surgeries: {
    create: {
      async execute(input: Parameters<typeof rawCreateSurgery.execute>[0]): ReturnType<typeof rawCreateSurgery.execute> {
        const result = await rawCreateSurgery.execute(input);
        await auditClinicalRecordEntity(result, "create", "surgery");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateSurgery.execute>[0]): ReturnType<typeof rawUpdateSurgery.execute> {
        const result = await rawUpdateSurgery.execute(props);
        await auditClinicalRecordEntity(result, "update", "surgery");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.surgeries, rawRemoveSurgery, "surgery") },
    list: new ListSurgeriesUseCase(repository),
  },
  hospitalizations: {
    create: {
      async execute(input: Parameters<typeof rawCreateHospitalization.execute>[0]): ReturnType<typeof rawCreateHospitalization.execute> {
        const result = await rawCreateHospitalization.execute(input);
        await auditClinicalRecordEntity(result, "create", "hospitalization");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateHospitalization.execute>[0]): ReturnType<typeof rawUpdateHospitalization.execute> {
        const result = await rawUpdateHospitalization.execute(props);
        await auditClinicalRecordEntity(result, "update", "hospitalization");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.hospitalizations, rawRemoveHospitalization, "hospitalization") },
    list: new ListHospitalizationsUseCase(repository),
  },
  supplements: {
    create: {
      async execute(input: Parameters<typeof rawCreateSupplement.execute>[0]): ReturnType<typeof rawCreateSupplement.execute> {
        const result = await rawCreateSupplement.execute(input);
        await auditClinicalRecordEntity(result, "create", "supplement");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateSupplement.execute>[0]): ReturnType<typeof rawUpdateSupplement.execute> {
        const result = await rawUpdateSupplement.execute(props);
        await auditClinicalRecordEntity(result, "update", "supplement");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.supplements, rawRemoveSupplement, "supplement") },
    list: new ListSupplementsUseCase(repository),
  },
  foodFrequencies: {
    create: {
      async execute(input: Parameters<typeof rawCreateFoodFrequency.execute>[0]): ReturnType<typeof rawCreateFoodFrequency.execute> {
        const result = await rawCreateFoodFrequency.execute(input);
        await auditClinicalRecordEntity(result, "create", "food_frequency");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateFoodFrequency.execute>[0]): ReturnType<typeof rawUpdateFoodFrequency.execute> {
        const result = await rawUpdateFoodFrequency.execute(props);
        await auditClinicalRecordEntity(result, "update", "food_frequency");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.food_frequencies, rawRemoveFoodFrequency, "food_frequency") },
    list: new ListFoodFrequenciesUseCase(repository),
  },
  giSymptoms: {
    create: {
      async execute(input: Parameters<typeof rawCreateGiSymptom.execute>[0]): ReturnType<typeof rawCreateGiSymptom.execute> {
        const result = await rawCreateGiSymptom.execute(input);
        await auditClinicalRecordEntity(result, "create", "gi_symptom");
        return result;
      },
    },
    update: {
      async execute(props: Parameters<typeof rawUpdateGiSymptom.execute>[0]): ReturnType<typeof rawUpdateGiSymptom.execute> {
        const result = await rawUpdateGiSymptom.execute(props);
        await auditClinicalRecordEntity(result, "update", "gi_symptom");
        return result;
      },
    },
    remove: { execute: (id: string) => removeClinicalRecordResource(id, db.gi_symptoms, rawRemoveGiSymptom, "gi_symptom") },
    list: new ListGiSymptomsUseCase(repository),
  },
  snapshots: {
    create: {
      async execute(input: Parameters<typeof rawCreateSnapshot.execute>[0]): ReturnType<typeof rawCreateSnapshot.execute> {
        const result = await rawCreateSnapshot.execute(input);
        await auditClinicalRecordEntity(result, "create", "snapshot", `consultation:${result.consultaId}`);
        return result;
      },
    },
    getByConsulta: new GetSnapshotByConsultaUseCase(snapshotRepository),
    listByPatient: new ListSnapshotsByPatientUseCase(snapshotRepository),
  },
};

export type ClinicalRecordService = typeof clinicalRecordService;
