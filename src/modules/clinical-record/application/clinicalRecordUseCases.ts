import type { ClinicalRecordRepository } from "../domain/ClinicalRecordRepository";
import { Allergy, type AllergyCreate, type AllergyProps } from "../domain/Allergy";
import { Medication, type MedicationCreate, type MedicationProps } from "../domain/Medication";
import { ClinicalEvent, type ClinicalEventCreate, type ClinicalEventProps } from "../domain/ClinicalEvent";
import { FamilyHistory, type FamilyHistoryCreate, type FamilyHistoryProps } from "../domain/FamilyHistory";
import { PersonalHistory, type PersonalHistoryCreate, type PersonalHistoryProps } from "../domain/PersonalHistory";
import { Habit, type HabitCreate, type HabitProps } from "../domain/Habit";
import { PhysicalActivity, type PhysicalActivityCreate, type PhysicalActivityProps } from "../domain/PhysicalActivity";
import { DietHistory, type DietHistoryCreate, type DietHistoryProps } from "../domain/DietHistory";
import { Intolerance, type IntoleranceCreate, type IntoleranceProps } from "../domain/Intolerance";
import { Surgery, type SurgeryCreate, type SurgeryProps } from "../domain/Surgery";
import { Hospitalization, type HospitalizationCreate, type HospitalizationProps } from "../domain/Hospitalization";
import { Supplement, type SupplementCreate, type SupplementProps } from "../domain/Supplement";
import { FoodFrequency, type FoodFrequencyCreate, type FoodFrequencyProps } from "../domain/FoodFrequency";
import { GiSymptom, type GiSymptomCreate, type GiSymptomProps } from "../domain/GiSymptom";
import { SnapshotExpediente, type SnapshotExpedienteCreate } from "../domain/SnapshotExpediente";
import type { SnapshotExpedienteRepository } from "../domain/SnapshotExpedienteRepository";

export class CreateAllergyUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: AllergyCreate): Promise<Allergy> {
    const allergy = Allergy.create(input);
    await this.repo.addAllergy(allergy.toProps());
    return allergy;
  }
}

export class UpdateAllergyUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: AllergyProps): Promise<Allergy> {
    const allergy = Allergy.reconstitute(props);
    await this.repo.updateAllergy(allergy.toProps());
    return allergy;
  }
}

export class RemoveAllergyUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeAllergy(id);
  }
}

export class ListAllergiesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Allergy[]> {
    const rows = await this.repo.findAllergies(patientId);
    return rows.map(Allergy.reconstitute);
  }
}

export class CreateMedicationUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: MedicationCreate): Promise<Medication> {
    const medication = Medication.create(input);
    await this.repo.addMedication(medication.toProps());
    return medication;
  }
}

export class UpdateMedicationUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: MedicationProps): Promise<Medication> {
    const medication = Medication.reconstitute(props);
    await this.repo.updateMedication(medication.toProps());
    return medication;
  }
}

export class RemoveMedicationUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeMedication(id);
  }
}

export class ListMedicationsUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Medication[]> {
    const rows = await this.repo.findMedications(patientId);
    return rows.map(Medication.reconstitute);
  }
}

export class CreateClinicalEventUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: ClinicalEventCreate): Promise<ClinicalEvent> {
    const event = ClinicalEvent.create(input);
    await this.repo.addClinicalEvent(event.toProps());
    return event;
  }
}

export class UpdateClinicalEventUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: ClinicalEventProps): Promise<ClinicalEvent> {
    const event = ClinicalEvent.reconstitute(props);
    await this.repo.updateClinicalEvent(event.toProps());
    return event;
  }
}

export class RemoveClinicalEventUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeClinicalEvent(id);
  }
}

export class ListClinicalEventsUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<ClinicalEvent[]> {
    const rows = await this.repo.findClinicalEvents(patientId);
    return rows.map(ClinicalEvent.reconstitute);
  }
}

export class CreateFamilyHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: FamilyHistoryCreate): Promise<FamilyHistory> {
    const fh = FamilyHistory.create(input);
    await this.repo.addFamilyHistory(fh.toProps());
    return fh;
  }
}

export class UpdateFamilyHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: FamilyHistoryProps): Promise<FamilyHistory> {
    const fh = FamilyHistory.reconstitute(props);
    await this.repo.updateFamilyHistory(fh.toProps());
    return fh;
  }
}

export class RemoveFamilyHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeFamilyHistory(id);
  }
}

export class ListFamilyHistoriesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<FamilyHistory[]> {
    const rows = await this.repo.findFamilyHistories(patientId);
    return rows.map(FamilyHistory.reconstitute);
  }
}

export class CreatePersonalHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: PersonalHistoryCreate): Promise<PersonalHistory> {
    const ph = PersonalHistory.create(input);
    await this.repo.addPersonalHistory(ph.toProps());
    return ph;
  }
}

export class UpdatePersonalHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: PersonalHistoryProps): Promise<PersonalHistory> {
    const ph = PersonalHistory.reconstitute(props);
    await this.repo.updatePersonalHistory(ph.toProps());
    return ph;
  }
}

export class RemovePersonalHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removePersonalHistory(id);
  }
}

export class ListPersonalHistoriesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<PersonalHistory[]> {
    const rows = await this.repo.findPersonalHistories(patientId);
    return rows.map(PersonalHistory.reconstitute);
  }
}

export class CreateHabitUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: HabitCreate): Promise<Habit> {
    const habit = Habit.create(input);
    await this.repo.addHabit(habit.toProps());
    return habit;
  }
}

export class UpdateHabitUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: HabitProps): Promise<Habit> {
    const habit = Habit.reconstitute(props);
    await this.repo.updateHabit(habit.toProps());
    return habit;
  }
}

export class RemoveHabitUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeHabit(id);
  }
}

export class ListHabitsUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Habit[]> {
    const rows = await this.repo.findHabits(patientId);
    return rows.map(Habit.reconstitute);
  }
}

export class CreatePhysicalActivityUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: PhysicalActivityCreate): Promise<PhysicalActivity> {
    const pa = PhysicalActivity.create(input);
    await this.repo.addPhysicalActivity(pa.toProps());
    return pa;
  }
}

export class UpdatePhysicalActivityUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: PhysicalActivityProps): Promise<PhysicalActivity> {
    const pa = PhysicalActivity.reconstitute(props);
    await this.repo.updatePhysicalActivity(pa.toProps());
    return pa;
  }
}

export class RemovePhysicalActivityUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removePhysicalActivity(id);
  }
}

export class ListPhysicalActivitiesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<PhysicalActivity[]> {
    const rows = await this.repo.findPhysicalActivities(patientId);
    return rows.map(PhysicalActivity.reconstitute);
  }
}

export class GetDietHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<DietHistory | null> {
    const props = await this.repo.findDietHistory(patientId);
    return props ? DietHistory.reconstitute(props) : null;
  }
}

export class SaveDietHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: DietHistoryCreate): Promise<DietHistory> {
    const dh = DietHistory.create(input);
    await this.repo.saveDietHistory(dh.toProps());
    return dh;
  }
}

export class UpdateDietHistoryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: DietHistoryProps): Promise<DietHistory> {
    const dh = DietHistory.reconstitute(props);
    await this.repo.saveDietHistory(dh.toProps());
    return dh;
  }
}

export class CreateIntoleranceUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: IntoleranceCreate): Promise<Intolerance> {
    const intolerance = Intolerance.create(input);
    await this.repo.addIntolerance(intolerance.toProps());
    return intolerance;
  }
}

export class UpdateIntoleranceUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: IntoleranceProps): Promise<Intolerance> {
    const intolerance = Intolerance.reconstitute(props);
    await this.repo.updateIntolerance(intolerance.toProps());
    return intolerance;
  }
}

export class RemoveIntoleranceUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeIntolerance(id);
  }
}

export class ListIntolerancesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Intolerance[]> {
    const rows = await this.repo.findIntolerances(patientId);
    return rows.map(Intolerance.reconstitute);
  }
}

export class CreateSurgeryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: SurgeryCreate): Promise<Surgery> {
    const surgery = Surgery.create(input);
    await this.repo.addSurgery(surgery.toProps());
    return surgery;
  }
}
export class UpdateSurgeryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: SurgeryProps): Promise<Surgery> {
    const surgery = Surgery.reconstitute(props);
    await this.repo.updateSurgery(surgery.toProps());
    return surgery;
  }
}
export class RemoveSurgeryUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeSurgery(id);
  }
}
export class ListSurgeriesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Surgery[]> {
    const rows = await this.repo.findSurgeries(patientId);
    return rows.map(Surgery.reconstitute);
  }
}

export class CreateHospitalizationUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: HospitalizationCreate): Promise<Hospitalization> {
    const h = Hospitalization.create(input);
    await this.repo.addHospitalization(h.toProps());
    return h;
  }
}
export class UpdateHospitalizationUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: HospitalizationProps): Promise<Hospitalization> {
    const h = Hospitalization.reconstitute(props);
    await this.repo.updateHospitalization(h.toProps());
    return h;
  }
}
export class RemoveHospitalizationUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeHospitalization(id);
  }
}
export class ListHospitalizationsUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Hospitalization[]> {
    const rows = await this.repo.findHospitalizations(patientId);
    return rows.map(Hospitalization.reconstitute);
  }
}

export class CreateSupplementUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: SupplementCreate): Promise<Supplement> {
    const s = Supplement.create(input);
    await this.repo.addSupplement(s.toProps());
    return s;
  }
}
export class UpdateSupplementUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: SupplementProps): Promise<Supplement> {
    const s = Supplement.reconstitute(props);
    await this.repo.updateSupplement(s.toProps());
    return s;
  }
}
export class RemoveSupplementUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeSupplement(id);
  }
}
export class ListSupplementsUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<Supplement[]> {
    const rows = await this.repo.findSupplements(patientId);
    return rows.map(Supplement.reconstitute);
  }
}

export class CreateFoodFrequencyUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: FoodFrequencyCreate): Promise<FoodFrequency> {
    const ff = FoodFrequency.create(input);
    await this.repo.addFoodFrequency(ff.toProps());
    return ff;
  }
}
export class UpdateFoodFrequencyUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: FoodFrequencyProps): Promise<FoodFrequency> {
    const ff = FoodFrequency.reconstitute(props);
    await this.repo.updateFoodFrequency(ff.toProps());
    return ff;
  }
}
export class RemoveFoodFrequencyUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeFoodFrequency(id);
  }
}
export class ListFoodFrequenciesUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<FoodFrequency[]> {
    const rows = await this.repo.findFoodFrequencies(patientId);
    return rows.map(FoodFrequency.reconstitute);
  }
}

export class CreateGiSymptomUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(input: GiSymptomCreate): Promise<GiSymptom> {
    const s = GiSymptom.create(input);
    await this.repo.addGiSymptom(s.toProps());
    return s;
  }
}
export class UpdateGiSymptomUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(props: GiSymptomProps): Promise<GiSymptom> {
    const s = GiSymptom.reconstitute(props);
    await this.repo.updateGiSymptom(s.toProps());
    return s;
  }
}
export class RemoveGiSymptomUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.removeGiSymptom(id);
  }
}
export class ListGiSymptomsUseCase {
  constructor(private readonly repo: ClinicalRecordRepository) {}
  async execute(patientId: string): Promise<GiSymptom[]> {
    const rows = await this.repo.findGiSymptoms(patientId);
    return rows.map(GiSymptom.reconstitute);
  }
}

export class CreateSnapshotExpedienteUseCase {
  constructor(private readonly repo: SnapshotExpedienteRepository) {}
  async execute(input: SnapshotExpedienteCreate): Promise<SnapshotExpediente> {
    const snapshot = await SnapshotExpediente.create(input);
    await this.repo.save(snapshot.toProps());
    return snapshot;
  }
}

export class GetSnapshotByConsultaUseCase {
  constructor(private readonly repo: SnapshotExpedienteRepository) {}
  async execute(consultaId: string): Promise<SnapshotExpediente | null> {
    const props = await this.repo.findByConsultaId(consultaId);
    return props ? SnapshotExpediente.reconstitute(props) : null;
  }
}

export class ListSnapshotsByPatientUseCase {
  constructor(private readonly repo: SnapshotExpedienteRepository) {}
  async execute(patientId: string): Promise<SnapshotExpediente[]> {
    const rows = await this.repo.findByPatientId(patientId);
    return rows.map(SnapshotExpediente.reconstitute);
  }
}
