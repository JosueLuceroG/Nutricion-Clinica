import { PatientId } from "./PatientId";
import { ConsentId } from "./ConsentId";
import type { Sex } from "./Sex";
import type { Gender } from "./Gender";
import type { MaritalStatus } from "./MaritalStatus";
import type { EducationLevel } from "./EducationLevel";
import type { RecordStatus } from "./RecordStatus";
import type { Email, Phone } from "./Contact";
import type { PatientStatus } from "./PatientStatus";

export type PatientFamilyRelationship =
  | "none"
  | "mother"
  | "father"
  | "maternalGrandparents"
  | "paternalGrandparents"
  | "siblings";

export type PatientFamilyHistoryMode = "none" | "unknown" | "recorded";

export interface PatientFamilyHistoryDetails {
  readonly diabetes: readonly PatientFamilyRelationship[];
  readonly hypertension: readonly PatientFamilyRelationship[];
  readonly obesity: readonly PatientFamilyRelationship[];
  readonly cardiovascularDisease: readonly PatientFamilyRelationship[];
  readonly dyslipidemia: readonly PatientFamilyRelationship[];
  readonly kidneyDisease: readonly PatientFamilyRelationship[];
  readonly thyroidDisease: readonly PatientFamilyRelationship[];
  readonly otherConditions: string | null;
  readonly notes: string | null;
}

export type PatientMedicationFrequency =
  | "daily"
  | "twiceDaily"
  | "weekly"
  | "asNeeded"
  | "other";

export interface PatientSupplementDetail {
  readonly name: string;
  readonly dose: string;
  readonly frequency: PatientMedicationFrequency;
  readonly objective: string;
}

export interface PatientMedicationAllergyDetail {
  readonly medication: string;
  readonly reaction: string;
  readonly severity: "mild" | "moderate" | "severe";
  readonly requiredMedicalAttention: boolean;
}

export interface PatientDailyMedicationDetail {
  readonly name: string;
  readonly dose: string;
  readonly frequency: PatientMedicationFrequency;
  readonly schedule: string;
  readonly reason: string;
  readonly prescribedByProfessional: boolean;
}

export type PatientConditionStatus = "active" | "controlled" | "resolved";

export interface PatientDiagnosedConditionDetail {
  readonly diagnosis: string;
  readonly diagnosisYear: number | null;
  readonly status: PatientConditionStatus;
  readonly treatment: string | null;
}

export interface PatientPreviousSurgeryDetail {
  readonly procedure: string;
  readonly year: number | null;
  readonly reason: string | null;
}

export interface PatientCurrentTreatmentDetail {
  readonly name: string;
  readonly reason: string;
  readonly frequency: string;
  readonly professional: string | null;
}

export interface PatientIntoleranceDetail {
  readonly substance: string;
  readonly reaction: string;
  readonly severity: "mild" | "moderate" | "severe";
}

export type PatientSkippedMeal = "breakfast" | "mainMeal" | "dinner" | "snack";

export type PatientMealScheduleVariation =
  | "weekendsLater"
  | "weekendsEarlier"
  | "workdays"
  | "rotatingShifts"
  | "irregular";

export type PatientMealDuration =
  | "lessThan15"
  | "15To20"
  | "20To30"
  | "30To45"
  | "moreThan45";

export interface PatientMealRoutine {
  readonly breakfastTime: string;
  readonly mainMealTime: string;
  readonly dinnerTime: string;
  readonly snackTimes: readonly string[];
  readonly mealsPerDay: number;
  readonly skipsMeals: boolean;
  readonly mostSkippedMeal: PatientSkippedMeal | null;
  readonly scheduleVaries: boolean;
  readonly scheduleVariation: PatientMealScheduleVariation | null;
  readonly mealDuration: PatientMealDuration;
}

export type PatientEatingOutFrequency =
  | "never"
  | "rarely"
  | "oneToTwoPerWeek"
  | "threeToFourPerWeek"
  | "daily";

export type PatientCravingTime =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "variable";

export type PatientMealPreparer =
  | "self"
  | "partner"
  | "family"
  | "householdHelp"
  | "preparedFood"
  | "varies";

export type PatientMealLocation =
  | "home"
  | "work"
  | "school"
  | "restaurant"
  | "street"
  | "varies";

export interface PatientEatingPatterns {
  readonly eatingOutFrequency: PatientEatingOutFrequency;
  readonly snacksBetweenMeals: boolean;
  readonly eatsLateAtNight: boolean;
  readonly frequentCravings: boolean;
  readonly cravingTime: PatientCravingTime | null;
  readonly mealPreparer: PatientMealPreparer;
  readonly primaryMealLocation: PatientMealLocation | null;
}

export type PatientUsualDietType =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "mediterranean"
  | "lowCarb"
  | "other";

export type PatientSpecialEatingPreference =
  | "none"
  | "lowSodium"
  | "lowSugar"
  | "lowFat"
  | "softTextures"
  | "temperatureSensitive"
  | "other";

export interface PatientFoodPreferences {
  readonly usualDietType: PatientUsualDietType;
  readonly otherDietDescription: string | null;
  readonly avoidsFoods: boolean;
  readonly avoidedFoods: string | null;
  readonly followsFoodRestrictions: boolean;
  readonly foodRestrictionDetails: string | null;
  readonly hasFoodDiscomfort: boolean;
  readonly discomfortFoods: string | null;
  readonly specialPreference: PatientSpecialEatingPreference;
  readonly notes: string | null;
}

export type PatientWaterIntake =
  | "lessThanOneLiter"
  | "oneToOneAndHalfLiters"
  | "oneAndHalfToTwoLiters"
  | "twoToThreeLiters"
  | "moreThanThreeLiters";

export type PatientCoffeeTeaFrequency =
  | "never"
  | "occasional"
  | "onePerDay"
  | "oneToTwoPerDay"
  | "threeOrMorePerDay";

export type PatientSugaryDrinkFrequency =
  | "never"
  | "oneToTwoPerWeek"
  | "threeToFourPerWeek"
  | "daily"
  | "multiplePerDay";

export type PatientOtherBeverage =
  | "none"
  | "infusions"
  | "flavoredWater"
  | "juice"
  | "sportsDrinks"
  | "other";

export type PatientAlcoholFrequency =
  | "never"
  | "monthlyOrLess"
  | "twoToFourPerMonth"
  | "twoToThreePerWeek"
  | "fourOrMorePerWeek";

export interface PatientHydrationHabits {
  readonly waterIntake: PatientWaterIntake;
  readonly drinksWaterThroughoutDay: boolean;
  readonly carriesWaterBottle: boolean;
  readonly coffeeTeaFrequency: PatientCoffeeTeaFrequency;
  readonly sugaryDrinkFrequency: PatientSugaryDrinkFrequency;
  readonly consumesEnergyDrinks: boolean;
  readonly otherBeverage: PatientOtherBeverage;
  readonly alcoholFrequency: PatientAlcoholFrequency | null;
  readonly notes: string | null;
}

export type PatientAppetiteLevel = "low" | "normal" | "high" | "variable";

export type PatientDigestiveSymptom =
  | "reflux"
  | "bloating"
  | "gas"
  | "nausea"
  | "constipation"
  | "diarrhea"
  | "abdominalPain"
  | "heartburn"
  | "vomiting"
  | "belching"
  | "abdominalCramps"
  | "other";

export type PatientSymptomTiming =
  | "duringMeals"
  | "afterMeals"
  | "morning"
  | "night"
  | "variable";

export interface PatientDigestiveHealth {
  readonly appetiteLevel: PatientAppetiteLevel;
  readonly earlySatiety: boolean;
  readonly hasDigestiveDiscomfort: boolean;
  readonly symptoms: readonly PatientDigestiveSymptom[];
  readonly otherSymptomDescription: string | null;
  readonly symptomTiming: PatientSymptomTiming | null;
  readonly notes: string | null;
}

export interface PatientNutritionIntake {
  readonly routine: PatientMealRoutine | null;
  readonly patterns: PatientEatingPatterns | null;
  readonly preferences: PatientFoodPreferences | null;
  readonly hydration: PatientHydrationHabits | null;
  readonly digestive: PatientDigestiveHealth | null;
}

export interface PatientMedicalIntake {
  readonly diagnosedConditions: boolean | null;
  readonly previousSurgeries: boolean | null;
  readonly currentTreatments: boolean | null;
  readonly intolerances: boolean | null;
  readonly diagnosedConditionDetails: readonly PatientDiagnosedConditionDetail[];
  readonly previousSurgeryDetails: readonly PatientPreviousSurgeryDetail[];
  readonly currentTreatmentDetails: readonly PatientCurrentTreatmentDetail[];
  readonly intoleranceDetails: readonly PatientIntoleranceDetail[];
  readonly familyHistory: boolean | null;
  readonly familyHistoryMode: PatientFamilyHistoryMode | null;
  readonly familyHistoryDetails: PatientFamilyHistoryDetails | null;
  readonly medications: boolean | null;
  readonly supplements: boolean | null;
  readonly medicationAllergies: boolean | null;
  readonly adverseMedicationOrSupplementEffects: boolean | null;
  readonly supplementDetails: readonly PatientSupplementDetail[];
  readonly medicationAllergyDetails: readonly PatientMedicationAllergyDetail[];
  readonly dailyMedicationDetails: readonly PatientDailyMedicationDetail[];
  readonly adverseEffectDetails: string | null;
  readonly nutritionIntake: PatientNutritionIntake | null;
  readonly physicalActivity: boolean | null;
}

type PatientMedicalIntakeInput = Omit<
  Partial<PatientMedicalIntake>,
  "familyHistoryDetails" | "nutritionIntake"
> & {
  familyHistoryDetails?: Partial<PatientFamilyHistoryDetails> | null;
  nutritionIntake?: PatientNutritionIntakeInput | null;
};

interface PatientNutritionIntakeInput {
  readonly routine?: Partial<PatientMealRoutine> | null;
  readonly patterns?: Partial<PatientEatingPatterns> | null;
  readonly preferences?: Partial<PatientFoodPreferences> | null;
  readonly hydration?: Partial<PatientHydrationHabits> | null;
  readonly digestive?: Partial<PatientDigestiveHealth> | null;
}

export class Patient {
  private constructor(
    public readonly id: PatientId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly secondLastName: string | null,
    public readonly birthDate: Date,
    public readonly sex: Sex,
    public readonly gender: Gender | null,
    public readonly maritalStatus: MaritalStatus | null,
    public readonly occupation: string | null,
    public readonly education: EducationLevel | null,
    public readonly email: Email | null,
    public readonly phone: Phone | null,
    public readonly secondaryPhone: Phone | null,
    public readonly whatsappEnabled: boolean | null,
    public readonly emergencyContactName: string | null,
    public readonly emergencyContactRelationship: string | null,
    public readonly emergencyContactPhone: Phone | null,
    public readonly recordStatus: RecordStatus,
    public readonly recordOpenedAt: Date,
    public readonly generalNotes: string | null,
    public readonly consentimientoInformadoId: ConsentId | null,
    public readonly fechaFirmaConsentimiento: Date | null,
    public readonly versionPoliticaPrivacidad: string | null,
    public readonly clinicalTags: string[],
    public readonly claveInterna: string | null,
    public readonly birthPlace: string | null,
    public readonly address: string | null,
    public readonly nationality: string | null,
    public readonly idType: string | null,
    public readonly idNumber: string | null,
    public readonly dischargeReason: string | null,
    public readonly responsibleProfessionalId: string | null,
    public readonly externalRecordNumber: string | null,
    public readonly admissionReason: string | null,
    public readonly photoUrl: string | null,
    public readonly medicalIntake: PatientMedicalIntake,
    public readonly status: PatientStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  get fullName(): string {
    const parts = [this.firstName, this.lastName];
    if (this.secondLastName) parts.push(this.secondLastName);
    return parts.join(" ").trim();
  }

  get age(): number {
    const now = new Date();
    let years = now.getFullYear() - this.birthDate.getFullYear();
    const m = now.getMonth() - this.birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < this.birthDate.getDate())) {
      years--;
    }
    return years;
  }

  get isActive(): boolean {
    return this.status === "active" && this.deletedAt === null;
  }

  get hasSignedConsent(): boolean {
    return (
      this.consentimientoInformadoId !== null &&
      this.fechaFirmaConsentimiento !== null
    );
  }

  with(updates: Partial<PatientUpdate>): Patient {
    return Patient.reconstitute({
      id: this.id,
      firstName: updates.firstName ?? this.firstName,
      lastName: updates.lastName ?? this.lastName,
      secondLastName:
        updates.secondLastName !== undefined
          ? updates.secondLastName
          : this.secondLastName,
      birthDate: updates.birthDate ?? this.birthDate,
      sex: updates.sex ?? this.sex,
      gender: updates.gender !== undefined ? updates.gender : this.gender,
      maritalStatus:
        updates.maritalStatus !== undefined
          ? updates.maritalStatus
          : this.maritalStatus,
      occupation:
        updates.occupation !== undefined ? updates.occupation : this.occupation,
      education:
        updates.education !== undefined ? updates.education : this.education,
      email: updates.email !== undefined ? updates.email : this.email,
      phone: updates.phone !== undefined ? updates.phone : this.phone,
      secondaryPhone:
        updates.secondaryPhone !== undefined
          ? updates.secondaryPhone
          : this.secondaryPhone,
      whatsappEnabled:
        updates.whatsappEnabled !== undefined
          ? updates.whatsappEnabled
          : this.whatsappEnabled,
      emergencyContactName:
        updates.emergencyContactName !== undefined
          ? updates.emergencyContactName
          : this.emergencyContactName,
      emergencyContactRelationship:
        updates.emergencyContactRelationship !== undefined
          ? updates.emergencyContactRelationship
          : this.emergencyContactRelationship,
      emergencyContactPhone:
        updates.emergencyContactPhone !== undefined
          ? updates.emergencyContactPhone
          : this.emergencyContactPhone,
      recordStatus: updates.recordStatus ?? this.recordStatus,
      recordOpenedAt: updates.recordOpenedAt ?? this.recordOpenedAt,
      generalNotes:
        updates.generalNotes !== undefined
          ? updates.generalNotes
          : this.generalNotes,
      consentimientoInformadoId:
        updates.consentimientoInformadoId !== undefined
          ? coerceConsentId(updates.consentimientoInformadoId)
          : this.consentimientoInformadoId,
      fechaFirmaConsentimiento:
        updates.fechaFirmaConsentimiento !== undefined
          ? updates.fechaFirmaConsentimiento
          : this.fechaFirmaConsentimiento,
      versionPoliticaPrivacidad:
        updates.versionPoliticaPrivacidad !== undefined
          ? updates.versionPoliticaPrivacidad
          : this.versionPoliticaPrivacidad,
      clinicalTags: updates.clinicalTags ?? this.clinicalTags,
      claveInterna:
        updates.claveInterna !== undefined
          ? updates.claveInterna
          : this.claveInterna,
      birthPlace:
        updates.birthPlace !== undefined ? updates.birthPlace : this.birthPlace,
      address: updates.address !== undefined ? updates.address : this.address,
      nationality:
        updates.nationality !== undefined
          ? updates.nationality
          : this.nationality,
      idType: updates.idType !== undefined ? updates.idType : this.idType,
      idNumber:
        updates.idNumber !== undefined ? updates.idNumber : this.idNumber,
      dischargeReason:
        updates.dischargeReason !== undefined
          ? updates.dischargeReason
          : this.dischargeReason,
      responsibleProfessionalId:
        updates.responsibleProfessionalId !== undefined
          ? updates.responsibleProfessionalId
          : this.responsibleProfessionalId,
      externalRecordNumber:
        updates.externalRecordNumber !== undefined
          ? updates.externalRecordNumber
          : this.externalRecordNumber,
      admissionReason:
        updates.admissionReason !== undefined
          ? updates.admissionReason
          : this.admissionReason,
      photoUrl:
        updates.photoUrl !== undefined ? updates.photoUrl : this.photoUrl,
      medicalIntake:
        updates.medicalIntake !== undefined
          ? normalizeMedicalIntake(updates.medicalIntake)
          : this.medicalIntake,
      status: updates.status ?? this.status,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      deletedAt: this.deletedAt,
    });
  }

  softDelete(now: Date = new Date()): Patient {
    if (this.deletedAt) return this;
    return Patient.reconstitute({
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      secondLastName: this.secondLastName,
      birthDate: this.birthDate,
      sex: this.sex,
      gender: this.gender,
      maritalStatus: this.maritalStatus,
      occupation: this.occupation,
      education: this.education,
      email: this.email,
      phone: this.phone,
      secondaryPhone: this.secondaryPhone,
      whatsappEnabled: this.whatsappEnabled,
      emergencyContactName: this.emergencyContactName,
      emergencyContactRelationship: this.emergencyContactRelationship,
      emergencyContactPhone: this.emergencyContactPhone,
      recordStatus: "inactive",
      recordOpenedAt: this.recordOpenedAt,
      generalNotes: this.generalNotes,
      consentimientoInformadoId: this.consentimientoInformadoId,
      fechaFirmaConsentimiento: this.fechaFirmaConsentimiento,
      versionPoliticaPrivacidad: this.versionPoliticaPrivacidad,
      clinicalTags: this.clinicalTags,
      claveInterna: this.claveInterna,
      birthPlace: this.birthPlace,
      address: this.address,
      nationality: this.nationality,
      idType: this.idType,
      idNumber: this.idNumber,
      dischargeReason: this.dischargeReason,
      responsibleProfessionalId: this.responsibleProfessionalId,
      externalRecordNumber: this.externalRecordNumber,
      admissionReason: this.admissionReason,
      photoUrl: this.photoUrl,
      medicalIntake: this.medicalIntake,
      status: "inactive",
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: now,
    });
  }

  static create(input: PatientCreate): Patient {
    validateName(input.firstName, "firstName");
    validateName(input.lastName, "lastName");
    validateBirthDate(input.birthDate);
    const now = new Date();
    const fechaFirma = input.fechaFirmaConsentimiento ?? null;
    const consentId = coerceConsentId(input.consentimientoInformadoId ?? null);
    if (fechaFirma) validateConsentDate(fechaFirma);

    return new Patient(
      input.id ?? PatientId.generate(),
      input.firstName.trim(),
      input.lastName.trim(),
      input.secondLastName?.trim() ?? null,
      input.birthDate,
      input.sex,
      input.gender ?? null,
      input.maritalStatus ?? null,
      input.occupation?.trim() ?? null,
      input.education ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.secondaryPhone ?? null,
      input.whatsappEnabled ?? null,
      input.emergencyContactName?.trim() ?? null,
      input.emergencyContactRelationship?.trim() ?? null,
      input.emergencyContactPhone ?? null,
      input.recordStatus ?? "active",
      input.recordOpenedAt ?? now,
      input.generalNotes?.trim() ?? null,
      consentId,
      fechaFirma,
      input.versionPoliticaPrivacidad?.trim() ?? null,
      input.clinicalTags ?? [],
      input.claveInterna?.trim() ?? null,
      input.birthPlace?.trim() ?? null,
      input.address?.trim() ?? null,
      input.nationality?.trim() ?? null,
      input.idType?.trim() ?? null,
      input.idNumber?.trim() ?? null,
      input.dischargeReason?.trim() ?? null,
      input.responsibleProfessionalId?.trim() ?? null,
      input.externalRecordNumber?.trim() ?? null,
      input.admissionReason?.trim() ?? null,
      input.photoUrl?.trim() ?? null,
      normalizeMedicalIntake(input.medicalIntake),
      input.status ?? "active",
      now,
      now,
      null,
    );
  }

  static reconstitute(props: PatientProps): Patient {
    return new Patient(
      props.id,
      props.firstName,
      props.lastName,
      props.secondLastName,
      props.birthDate,
      props.sex,
      props.gender,
      props.maritalStatus,
      props.occupation,
      props.education,
      props.email,
      props.phone,
      props.secondaryPhone,
      props.whatsappEnabled,
      props.emergencyContactName,
      props.emergencyContactRelationship,
      props.emergencyContactPhone,
      props.recordStatus,
      props.recordOpenedAt,
      props.generalNotes,
      props.consentimientoInformadoId,
      props.fechaFirmaConsentimiento,
      props.versionPoliticaPrivacidad,
      props.clinicalTags,
      props.claveInterna,
      props.birthPlace,
      props.address,
      props.nationality,
      props.idType,
      props.idNumber,
      props.dischargeReason,
      props.responsibleProfessionalId,
      props.externalRecordNumber,
      props.admissionReason,
      props.photoUrl,
      normalizeMedicalIntake(props.medicalIntake),
      props.status,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }
}

export interface PatientProps {
  id: PatientId;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  birthDate: Date;
  sex: Sex;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  occupation: string | null;
  education: EducationLevel | null;
  email: Email | null;
  phone: Phone | null;
  secondaryPhone: Phone | null;
  whatsappEnabled: boolean | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: Phone | null;
  recordStatus: RecordStatus;
  recordOpenedAt: Date;
  generalNotes: string | null;
  consentimientoInformadoId: ConsentId | null;
  fechaFirmaConsentimiento: Date | null;
  versionPoliticaPrivacidad: string | null;
  clinicalTags: string[];
  claveInterna: string | null;
  birthPlace: string | null;
  address: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  dischargeReason: string | null;
  responsibleProfessionalId: string | null;
  externalRecordNumber: string | null;
  admissionReason: string | null;
  photoUrl: string | null;
  medicalIntake?: PatientMedicalIntakeInput | null;
  status: PatientStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PatientCreate {
  id?: PatientId;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  birthDate: Date;
  sex: Sex;
  gender?: Gender | null;
  maritalStatus?: MaritalStatus | null;
  occupation?: string | null;
  education?: EducationLevel | null;
  email?: Email | null;
  phone?: Phone | null;
  secondaryPhone?: Phone | null;
  whatsappEnabled?: boolean | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: Phone | null;
  recordStatus?: RecordStatus;
  recordOpenedAt?: Date;
  generalNotes?: string | null;
  consentimientoInformadoId?: string | ConsentId | null;
  fechaFirmaConsentimiento?: Date | null;
  versionPoliticaPrivacidad?: string | null;
  clinicalTags?: string[];
  claveInterna?: string | null;
  birthPlace?: string | null;
  address?: string | null;
  nationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  dischargeReason?: string | null;
  responsibleProfessionalId?: string | null;
  externalRecordNumber?: string | null;
  admissionReason?: string | null;
  photoUrl?: string | null;
  medicalIntake?: PatientMedicalIntakeInput | null;
  status?: PatientStatus;
}

export type PatientUpdate = Omit<Partial<PatientCreate>, "id">;

function normalizeMedicalIntake(
  value?: PatientMedicalIntakeInput | null,
): PatientMedicalIntake {
  return Object.freeze({
    diagnosedConditions: value?.diagnosedConditions ?? null,
    previousSurgeries: value?.previousSurgeries ?? null,
    currentTreatments: value?.currentTreatments ?? null,
    intolerances: value?.intolerances ?? null,
    diagnosedConditionDetails: normalizeDiagnosedConditionDetails(
      value?.diagnosedConditionDetails,
    ),
    previousSurgeryDetails: normalizePreviousSurgeryDetails(
      value?.previousSurgeryDetails,
    ),
    currentTreatmentDetails: normalizeCurrentTreatmentDetails(
      value?.currentTreatmentDetails,
    ),
    intoleranceDetails: normalizeIntoleranceDetails(value?.intoleranceDetails),
    familyHistory: value?.familyHistory ?? null,
    familyHistoryMode: normalizeFamilyHistoryMode(value?.familyHistoryMode),
    familyHistoryDetails: normalizeFamilyHistoryDetails(
      value?.familyHistoryDetails,
    ),
    medications: value?.medications ?? null,
    supplements: value?.supplements ?? null,
    medicationAllergies: value?.medicationAllergies ?? null,
    adverseMedicationOrSupplementEffects:
      value?.adverseMedicationOrSupplementEffects ?? null,
    supplementDetails: normalizeSupplementDetails(value?.supplementDetails),
    medicationAllergyDetails: normalizeMedicationAllergyDetails(
      value?.medicationAllergyDetails,
    ),
    dailyMedicationDetails: normalizeDailyMedicationDetails(
      value?.dailyMedicationDetails,
    ),
    adverseEffectDetails: normalizeOptionalText(value?.adverseEffectDetails),
    nutritionIntake: normalizeNutritionIntake(value?.nutritionIntake),
    physicalActivity: value?.physicalActivity ?? null,
  });
}

const PATIENT_SKIPPED_MEALS = new Set<PatientSkippedMeal>([
  "breakfast",
  "mainMeal",
  "dinner",
  "snack",
]);

const PATIENT_MEAL_SCHEDULE_VARIATIONS = new Set<PatientMealScheduleVariation>([
  "weekendsLater",
  "weekendsEarlier",
  "workdays",
  "rotatingShifts",
  "irregular",
]);

const PATIENT_MEAL_DURATIONS = new Set<PatientMealDuration>([
  "lessThan15",
  "15To20",
  "20To30",
  "30To45",
  "moreThan45",
]);

const PATIENT_EATING_OUT_FREQUENCIES = new Set<PatientEatingOutFrequency>([
  "never",
  "rarely",
  "oneToTwoPerWeek",
  "threeToFourPerWeek",
  "daily",
]);

const PATIENT_CRAVING_TIMES = new Set<PatientCravingTime>([
  "morning",
  "afternoon",
  "evening",
  "night",
  "variable",
]);

const PATIENT_MEAL_PREPARERS = new Set<PatientMealPreparer>([
  "self",
  "partner",
  "family",
  "householdHelp",
  "preparedFood",
  "varies",
]);

const PATIENT_MEAL_LOCATIONS = new Set<PatientMealLocation>([
  "home",
  "work",
  "school",
  "restaurant",
  "street",
  "varies",
]);

const PATIENT_USUAL_DIET_TYPES = new Set<PatientUsualDietType>([
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "mediterranean",
  "lowCarb",
  "other",
]);

const PATIENT_SPECIAL_EATING_PREFERENCES =
  new Set<PatientSpecialEatingPreference>([
    "none",
    "lowSodium",
    "lowSugar",
    "lowFat",
    "softTextures",
    "temperatureSensitive",
    "other",
  ]);

const PATIENT_WATER_INTAKES = new Set<PatientWaterIntake>([
  "lessThanOneLiter",
  "oneToOneAndHalfLiters",
  "oneAndHalfToTwoLiters",
  "twoToThreeLiters",
  "moreThanThreeLiters",
]);

const PATIENT_COFFEE_TEA_FREQUENCIES = new Set<PatientCoffeeTeaFrequency>([
  "never",
  "occasional",
  "onePerDay",
  "oneToTwoPerDay",
  "threeOrMorePerDay",
]);

const PATIENT_SUGARY_DRINK_FREQUENCIES = new Set<PatientSugaryDrinkFrequency>([
  "never",
  "oneToTwoPerWeek",
  "threeToFourPerWeek",
  "daily",
  "multiplePerDay",
]);

const PATIENT_OTHER_BEVERAGES = new Set<PatientOtherBeverage>([
  "none",
  "infusions",
  "flavoredWater",
  "juice",
  "sportsDrinks",
  "other",
]);

const PATIENT_ALCOHOL_FREQUENCIES = new Set<PatientAlcoholFrequency>([
  "never",
  "monthlyOrLess",
  "twoToFourPerMonth",
  "twoToThreePerWeek",
  "fourOrMorePerWeek",
]);

const PATIENT_APPETITE_LEVELS = new Set<PatientAppetiteLevel>([
  "low",
  "normal",
  "high",
  "variable",
]);

const PATIENT_DIGESTIVE_SYMPTOMS = new Set<PatientDigestiveSymptom>([
  "reflux",
  "bloating",
  "gas",
  "nausea",
  "constipation",
  "diarrhea",
  "abdominalPain",
  "heartburn",
  "vomiting",
  "belching",
  "abdominalCramps",
  "other",
]);

const PATIENT_SYMPTOM_TIMINGS = new Set<PatientSymptomTiming>([
  "duringMeals",
  "afterMeals",
  "morning",
  "night",
  "variable",
]);

function normalizeNutritionIntake(
  value?: PatientNutritionIntakeInput | null,
): PatientNutritionIntake | null {
  if (!value) return null;
  return Object.freeze({
    routine: normalizeMealRoutine(value.routine),
    patterns: normalizeEatingPatterns(value.patterns),
    preferences: normalizeFoodPreferences(value.preferences),
    hydration: normalizeHydrationHabits(value.hydration),
    digestive: normalizeDigestiveHealth(value.digestive),
  });
}

function normalizeMealRoutine(
  value?: Partial<PatientMealRoutine> | null,
): PatientMealRoutine | null {
  if (!value) return null;
  const breakfastTime = normalizeMealTime(value.breakfastTime);
  const mainMealTime = normalizeMealTime(value.mainMealTime);
  const dinnerTime = normalizeMealTime(value.dinnerTime);
  const mealsPerDay = value.mealsPerDay;
  const mealDuration = PATIENT_MEAL_DURATIONS.has(
    value.mealDuration as PatientMealDuration,
  )
    ? (value.mealDuration as PatientMealDuration)
    : null;
  if (
    !breakfastTime ||
    !mainMealTime ||
    !dinnerTime ||
    !Number.isInteger(mealsPerDay) ||
    mealsPerDay === undefined ||
    mealsPerDay < 1 ||
    mealsPerDay > 8 ||
    !mealDuration
  ) {
    return null;
  }

  const skipsMeals = Boolean(value.skipsMeals);
  const mostSkippedMeal = PATIENT_SKIPPED_MEALS.has(
    value.mostSkippedMeal as PatientSkippedMeal,
  )
    ? (value.mostSkippedMeal as PatientSkippedMeal)
    : null;
  if (skipsMeals && !mostSkippedMeal) return null;

  const scheduleVaries = Boolean(value.scheduleVaries);
  const scheduleVariation = PATIENT_MEAL_SCHEDULE_VARIATIONS.has(
    value.scheduleVariation as PatientMealScheduleVariation,
  )
    ? (value.scheduleVariation as PatientMealScheduleVariation)
    : null;
  if (scheduleVaries && !scheduleVariation) return null;

  return Object.freeze({
    breakfastTime,
    mainMealTime,
    dinnerTime,
    snackTimes: Object.freeze(
      (value.snackTimes ?? []).flatMap((time) => {
        const normalized = normalizeMealTime(time);
        return normalized ? [normalized] : [];
      }),
    ),
    mealsPerDay,
    skipsMeals,
    mostSkippedMeal: skipsMeals ? mostSkippedMeal : null,
    scheduleVaries,
    scheduleVariation: scheduleVaries ? scheduleVariation : null,
    mealDuration,
  });
}

function normalizeMealTime(value?: string | null): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? `${match[1]}:${match[2]}` : null;
}

function normalizeEatingPatterns(
  value?: Partial<PatientEatingPatterns> | null,
): PatientEatingPatterns | null {
  if (!value) return null;
  const eatingOutFrequency = PATIENT_EATING_OUT_FREQUENCIES.has(
    value.eatingOutFrequency as PatientEatingOutFrequency,
  )
    ? (value.eatingOutFrequency as PatientEatingOutFrequency)
    : null;
  const mealPreparer = PATIENT_MEAL_PREPARERS.has(
    value.mealPreparer as PatientMealPreparer,
  )
    ? (value.mealPreparer as PatientMealPreparer)
    : null;
  if (!eatingOutFrequency || !mealPreparer) return null;

  const frequentCravings = Boolean(value.frequentCravings);
  const cravingTime = PATIENT_CRAVING_TIMES.has(
    value.cravingTime as PatientCravingTime,
  )
    ? (value.cravingTime as PatientCravingTime)
    : null;
  if (frequentCravings && !cravingTime) return null;

  const primaryMealLocation = PATIENT_MEAL_LOCATIONS.has(
    value.primaryMealLocation as PatientMealLocation,
  )
    ? (value.primaryMealLocation as PatientMealLocation)
    : null;

  return Object.freeze({
    eatingOutFrequency,
    snacksBetweenMeals: Boolean(value.snacksBetweenMeals),
    eatsLateAtNight: Boolean(value.eatsLateAtNight),
    frequentCravings,
    cravingTime: frequentCravings ? cravingTime : null,
    mealPreparer,
    primaryMealLocation,
  });
}

function normalizeFoodPreferences(
  value?: Partial<PatientFoodPreferences> | null,
): PatientFoodPreferences | null {
  if (!value) return null;
  const usualDietType = PATIENT_USUAL_DIET_TYPES.has(
    value.usualDietType as PatientUsualDietType,
  )
    ? (value.usualDietType as PatientUsualDietType)
    : null;
  const specialPreference = PATIENT_SPECIAL_EATING_PREFERENCES.has(
    value.specialPreference as PatientSpecialEatingPreference,
  )
    ? (value.specialPreference as PatientSpecialEatingPreference)
    : null;
  if (!usualDietType || !specialPreference) return null;

  const avoidsFoods = Boolean(value.avoidsFoods);
  const avoidedFoods = normalizeOptionalText(value.avoidedFoods);
  if (avoidsFoods && !avoidedFoods) return null;
  const followsFoodRestrictions = Boolean(value.followsFoodRestrictions);
  const hasFoodDiscomfort = Boolean(value.hasFoodDiscomfort);
  const discomfortFoods = normalizeOptionalText(value.discomfortFoods);
  if (hasFoodDiscomfort && !discomfortFoods) return null;

  return Object.freeze({
    usualDietType,
    otherDietDescription:
      usualDietType === "other"
        ? normalizeOptionalText(value.otherDietDescription)
        : null,
    avoidsFoods,
    avoidedFoods: avoidsFoods ? avoidedFoods : null,
    followsFoodRestrictions,
    foodRestrictionDetails: followsFoodRestrictions
      ? normalizeOptionalText(value.foodRestrictionDetails)
      : null,
    hasFoodDiscomfort,
    discomfortFoods: hasFoodDiscomfort ? discomfortFoods : null,
    specialPreference,
    notes: normalizeOptionalText(value.notes),
  });
}

function normalizeHydrationHabits(
  value?: Partial<PatientHydrationHabits> | null,
): PatientHydrationHabits | null {
  if (!value) return null;
  const waterIntake = PATIENT_WATER_INTAKES.has(
    value.waterIntake as PatientWaterIntake,
  )
    ? (value.waterIntake as PatientWaterIntake)
    : null;
  const coffeeTeaFrequency = PATIENT_COFFEE_TEA_FREQUENCIES.has(
    value.coffeeTeaFrequency as PatientCoffeeTeaFrequency,
  )
    ? (value.coffeeTeaFrequency as PatientCoffeeTeaFrequency)
    : null;
  const sugaryDrinkFrequency = PATIENT_SUGARY_DRINK_FREQUENCIES.has(
    value.sugaryDrinkFrequency as PatientSugaryDrinkFrequency,
  )
    ? (value.sugaryDrinkFrequency as PatientSugaryDrinkFrequency)
    : null;
  const otherBeverage = PATIENT_OTHER_BEVERAGES.has(
    value.otherBeverage as PatientOtherBeverage,
  )
    ? (value.otherBeverage as PatientOtherBeverage)
    : null;
  if (
    !waterIntake ||
    !coffeeTeaFrequency ||
    !sugaryDrinkFrequency ||
    !otherBeverage
  ) {
    return null;
  }
  const alcoholFrequency = PATIENT_ALCOHOL_FREQUENCIES.has(
    value.alcoholFrequency as PatientAlcoholFrequency,
  )
    ? (value.alcoholFrequency as PatientAlcoholFrequency)
    : null;

  return Object.freeze({
    waterIntake,
    drinksWaterThroughoutDay: Boolean(value.drinksWaterThroughoutDay),
    carriesWaterBottle: Boolean(value.carriesWaterBottle),
    coffeeTeaFrequency,
    sugaryDrinkFrequency,
    consumesEnergyDrinks: Boolean(value.consumesEnergyDrinks),
    otherBeverage,
    alcoholFrequency,
    notes: normalizeOptionalText(value.notes),
  });
}

function normalizeDigestiveHealth(
  value?: Partial<PatientDigestiveHealth> | null,
): PatientDigestiveHealth | null {
  if (!value) return null;
  const appetiteLevel = PATIENT_APPETITE_LEVELS.has(
    value.appetiteLevel as PatientAppetiteLevel,
  )
    ? (value.appetiteLevel as PatientAppetiteLevel)
    : null;
  if (!appetiteLevel) return null;
  const hasDigestiveDiscomfort = Boolean(value.hasDigestiveDiscomfort);
  const symptoms = Array.from(
    new Set(
      (value.symptoms ?? []).filter((symptom) =>
        PATIENT_DIGESTIVE_SYMPTOMS.has(symptom),
      ),
    ),
  );
  const symptomTiming = PATIENT_SYMPTOM_TIMINGS.has(
    value.symptomTiming as PatientSymptomTiming,
  )
    ? (value.symptomTiming as PatientSymptomTiming)
    : null;
  if (hasDigestiveDiscomfort && (symptoms.length === 0 || !symptomTiming)) {
    return null;
  }

  return Object.freeze({
    appetiteLevel,
    earlySatiety: Boolean(value.earlySatiety),
    hasDigestiveDiscomfort,
    symptoms: Object.freeze(hasDigestiveDiscomfort ? symptoms : []),
    otherSymptomDescription:
      hasDigestiveDiscomfort && symptoms.includes("other")
        ? normalizeOptionalText(value.otherSymptomDescription)
        : null,
    symptomTiming: hasDigestiveDiscomfort ? symptomTiming : null,
    notes: normalizeOptionalText(value.notes),
  });
}

const PATIENT_FAMILY_RELATIONSHIPS = new Set<PatientFamilyRelationship>([
  "none",
  "mother",
  "father",
  "maternalGrandparents",
  "paternalGrandparents",
  "siblings",
]);

function normalizeFamilyHistoryMode(
  value?: PatientFamilyHistoryMode | null,
): PatientFamilyHistoryMode | null {
  return value === "none" || value === "unknown" || value === "recorded"
    ? value
    : null;
}

function normalizeFamilyHistoryDetails(
  value?: Partial<PatientFamilyHistoryDetails> | null,
): PatientFamilyHistoryDetails | null {
  if (!value) return null;
  return Object.freeze({
    diabetes: normalizeFamilyRelationships(value.diabetes),
    hypertension: normalizeFamilyRelationships(value.hypertension),
    obesity: normalizeFamilyRelationships(value.obesity),
    cardiovascularDisease: normalizeFamilyRelationships(
      value.cardiovascularDisease,
    ),
    dyslipidemia: normalizeFamilyRelationships(value.dyslipidemia),
    kidneyDisease: normalizeFamilyRelationships(value.kidneyDisease),
    thyroidDisease: normalizeFamilyRelationships(value.thyroidDisease),
    otherConditions: normalizeOptionalText(value.otherConditions),
    notes: normalizeOptionalText(value.notes),
  });
}

function normalizeFamilyRelationships(
  value?: readonly PatientFamilyRelationship[],
): readonly PatientFamilyRelationship[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const normalized = Array.from(
    new Set(
      value.filter((item): item is PatientFamilyRelationship =>
        PATIENT_FAMILY_RELATIONSHIPS.has(item),
      ),
    ),
  );
  if (normalized.length > 1) {
    return Object.freeze(normalized.filter((item) => item !== "none"));
  }
  return Object.freeze(normalized);
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

const PATIENT_CONDITION_STATUSES = new Set<PatientConditionStatus>([
  "active",
  "controlled",
  "resolved",
]);

function normalizeDiagnosedConditionDetails(
  value?: readonly PatientDiagnosedConditionDetail[] | null,
): readonly PatientDiagnosedConditionDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const diagnosis = normalizeOptionalText(detail?.diagnosis);
      if (!diagnosis || !PATIENT_CONDITION_STATUSES.has(detail.status))
        return [];
      return [
        Object.freeze({
          diagnosis,
          diagnosisYear: normalizeOptionalYear(detail.diagnosisYear),
          status: detail.status,
          treatment: normalizeOptionalText(detail.treatment),
        }),
      ];
    }),
  );
}

function normalizePreviousSurgeryDetails(
  value?: readonly PatientPreviousSurgeryDetail[] | null,
): readonly PatientPreviousSurgeryDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const procedure = normalizeOptionalText(detail?.procedure);
      if (!procedure) return [];
      return [
        Object.freeze({
          procedure,
          year: normalizeOptionalYear(detail.year),
          reason: normalizeOptionalText(detail.reason),
        }),
      ];
    }),
  );
}

function normalizeCurrentTreatmentDetails(
  value?: readonly PatientCurrentTreatmentDetail[] | null,
): readonly PatientCurrentTreatmentDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const name = normalizeOptionalText(detail?.name);
      const reason = normalizeOptionalText(detail?.reason);
      const frequency = normalizeOptionalText(detail?.frequency);
      if (!name || !reason || !frequency) return [];
      return [
        Object.freeze({
          name,
          reason,
          frequency,
          professional: normalizeOptionalText(detail.professional),
        }),
      ];
    }),
  );
}

function normalizeIntoleranceDetails(
  value?: readonly PatientIntoleranceDetail[] | null,
): readonly PatientIntoleranceDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const substance = normalizeOptionalText(detail?.substance);
      const reaction = normalizeOptionalText(detail?.reaction);
      if (!substance || !reaction) return [];
      if (
        !(["mild", "moderate", "severe"] as const).includes(detail.severity)
      ) {
        return [];
      }
      return [
        Object.freeze({ substance, reaction, severity: detail.severity }),
      ];
    }),
  );
}

function normalizeOptionalYear(value?: number | null): number | null {
  if (typeof value !== "number") return null;
  const currentYear = new Date().getFullYear();
  return Number.isInteger(value) && value >= 1900 && value <= currentYear
    ? value
    : null;
}

const PATIENT_MEDICATION_FREQUENCIES = new Set<PatientMedicationFrequency>([
  "daily",
  "twiceDaily",
  "weekly",
  "asNeeded",
  "other",
]);

function normalizeSupplementDetails(
  value?: readonly PatientSupplementDetail[] | null,
): readonly PatientSupplementDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const name = normalizeOptionalText(detail?.name);
      const dose = normalizeOptionalText(detail?.dose);
      const objective = normalizeOptionalText(detail?.objective);
      if (!name || !dose || !objective) return [];
      const frequency = PATIENT_MEDICATION_FREQUENCIES.has(detail.frequency)
        ? detail.frequency
        : "other";
      return [Object.freeze({ name, dose, frequency, objective })];
    }),
  );
}

function normalizeMedicationAllergyDetails(
  value?: readonly PatientMedicationAllergyDetail[] | null,
): readonly PatientMedicationAllergyDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const medication = normalizeOptionalText(detail.medication);
      const reaction = normalizeOptionalText(detail.reaction);
      if (!medication || !reaction) return [];
      if (
        !(["mild", "moderate", "severe"] as const).includes(detail.severity)
      ) {
        return [];
      }
      return [
        Object.freeze({
          medication,
          reaction,
          severity: detail.severity,
          requiredMedicalAttention: Boolean(detail.requiredMedicalAttention),
        }),
      ];
    }),
  );
}

function normalizeDailyMedicationDetails(
  value?: readonly PatientDailyMedicationDetail[] | null,
): readonly PatientDailyMedicationDetail[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((detail) => {
      const name = normalizeOptionalText(detail.name);
      const dose = normalizeOptionalText(detail.dose);
      const schedule = normalizeOptionalText(detail.schedule);
      const reason = normalizeOptionalText(detail.reason);
      if (!name || !dose || !schedule || !reason) return [];
      const frequency = PATIENT_MEDICATION_FREQUENCIES.has(detail.frequency)
        ? detail.frequency
        : "other";
      return [
        Object.freeze({
          name,
          dose,
          frequency,
          schedule,
          reason,
          prescribedByProfessional: Boolean(detail.prescribedByProfessional),
        }),
      ];
    }),
  );
}

function validateName(name: string, field: string): void {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error(`El campo ${field} debe tener al menos 2 caracteres.`);
  }
  if (trimmed.length > 100) {
    throw new Error(`El campo ${field} no puede exceder 100 caracteres.`);
  }
}

function validateBirthDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de nacimiento inválida.");
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) {
    throw new Error("La fecha de nacimiento no puede estar en el futuro.");
  }
  const minDate = new Date(1900, 0, 1);
  if (date.getTime() < minDate.getTime()) {
    throw new Error("La fecha de nacimiento no puede ser anterior a 1900.");
  }
}

function validateConsentDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de firma de consentimiento inválida.");
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) {
    throw new Error(
      "La fecha de firma de consentimiento no puede estar en el futuro.",
    );
  }
}

function coerceConsentId(value: string | ConsentId | null): ConsentId | null {
  if (value === null) return null;
  if (typeof value === "string") {
    if (!value.trim()) return null;
    return ConsentId.fromUnsafe(value);
  }
  return value;
}
