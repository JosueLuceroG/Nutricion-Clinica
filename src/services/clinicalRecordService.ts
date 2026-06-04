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
const rawCreateIntolerance = new CreateIntoleranceUseCase(repository);
const rawUpdateIntolerance = new UpdateIntoleranceUseCase(repository);
const rawRemoveIntolerance = new RemoveIntoleranceUseCase(repository);

export const clinicalRecordService = {
  allergies: {
    create: async (input: AllergyCreate) => {
      const result = await rawCreateAllergy.execute(input);
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: AllergyProps) => {
      const result = await rawUpdateAllergy.execute(props);
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: rawRemoveAllergy,
    list: new ListAllergiesUseCase(repository),
  },
  medications: {
    create: new CreateMedicationUseCase(repository),
    update: new UpdateMedicationUseCase(repository),
    remove: new RemoveMedicationUseCase(repository),
    list: new ListMedicationsUseCase(repository),
  },
  clinicalEvents: {
    create: new CreateClinicalEventUseCase(repository),
    update: new UpdateClinicalEventUseCase(repository),
    remove: new RemoveClinicalEventUseCase(repository),
    list: new ListClinicalEventsUseCase(repository),
  },
  familyHistories: {
    create: async (input: FamilyHistoryCreate) => {
      const result = await rawCreateFamilyHistory.execute(input);
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: FamilyHistoryProps) => {
      const result = await rawUpdateFamilyHistory.execute(props);
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: rawRemoveFamilyHistory,
    list: new ListFamilyHistoriesUseCase(repository),
  },
  personalHistories: {
    create: async (input: PersonalHistoryCreate) => {
      const result = await rawCreatePersonalHistory.execute(input);
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: PersonalHistoryProps) => {
      const result = await rawUpdatePersonalHistory.execute(props);
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: rawRemovePersonalHistory,
    list: new ListPersonalHistoriesUseCase(repository),
  },
  habits: {
    create: new CreateHabitUseCase(repository),
    update: new UpdateHabitUseCase(repository),
    remove: new RemoveHabitUseCase(repository),
    list: new ListHabitsUseCase(repository),
  },
  physicalActivities: {
    create: new CreatePhysicalActivityUseCase(repository),
    update: new UpdatePhysicalActivityUseCase(repository),
    remove: new RemovePhysicalActivityUseCase(repository),
    list: new ListPhysicalActivitiesUseCase(repository),
  },
  dietHistory: {
    get: new GetDietHistoryUseCase(repository),
    save: new SaveDietHistoryUseCase(repository),
    update: new UpdateDietHistoryUseCase(repository),
  },
  intolerances: {
    create: async (input: IntoleranceCreate) => {
      const result = await rawCreateIntolerance.execute(input);
      await clinicalRuleService.updatePatientTags(input.patientId);
      return result;
    },
    update: async (props: IntoleranceProps) => {
      const result = await rawUpdateIntolerance.execute(props);
      await clinicalRuleService.updatePatientTags(PatientId.fromUnsafe(result.patientId));
      return result;
    },
    remove: rawRemoveIntolerance,
    list: new ListIntolerancesUseCase(repository),
  },
  surgeries: {
    create: new CreateSurgeryUseCase(repository),
    update: new UpdateSurgeryUseCase(repository),
    remove: new RemoveSurgeryUseCase(repository),
    list: new ListSurgeriesUseCase(repository),
  },
  hospitalizations: {
    create: new CreateHospitalizationUseCase(repository),
    update: new UpdateHospitalizationUseCase(repository),
    remove: new RemoveHospitalizationUseCase(repository),
    list: new ListHospitalizationsUseCase(repository),
  },
  supplements: {
    create: new CreateSupplementUseCase(repository),
    update: new UpdateSupplementUseCase(repository),
    remove: new RemoveSupplementUseCase(repository),
    list: new ListSupplementsUseCase(repository),
  },
  foodFrequencies: {
    create: new CreateFoodFrequencyUseCase(repository),
    update: new UpdateFoodFrequencyUseCase(repository),
    remove: new RemoveFoodFrequencyUseCase(repository),
    list: new ListFoodFrequenciesUseCase(repository),
  },
  giSymptoms: {
    create: new CreateGiSymptomUseCase(repository),
    update: new UpdateGiSymptomUseCase(repository),
    remove: new RemoveGiSymptomUseCase(repository),
    list: new ListGiSymptomsUseCase(repository),
  },
  snapshots: {
    create: new CreateSnapshotExpedienteUseCase(snapshotRepository),
    getByConsulta: new GetSnapshotByConsultaUseCase(snapshotRepository),
    listByPatient: new ListSnapshotsByPatientUseCase(snapshotRepository),
  },
};

export type ClinicalRecordService = typeof clinicalRecordService;
