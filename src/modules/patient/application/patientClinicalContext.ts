import type { ActivityLevelKey } from "@utils/calculations/tdee";
import type {
  PatientActivityProfile,
  Patient,
  PatientCurrentTreatmentDetail,
  PatientDailyActivity,
  PatientDailyMedicationDetail,
  PatientDigestiveHealth,
  PatientEatingPatterns,
  PatientFamilyHistoryDetails,
  PatientFamilyHistoryMode,
  PatientFoodPreferences,
  PatientHydrationHabits,
  PatientIntoleranceDetail,
  PatientMealRoutine,
  PatientMedicalIntake,
  PatientMedicationAllergyDetail,
  PatientPhysicalActivityLevel,
  PatientPreviousSurgeryDetail,
  PatientSupplementDetail,
} from "../domain/Patient";
import type { Sex } from "../domain/Sex";
import type { Gender } from "../domain/Gender";
import type { MaritalStatus } from "../domain/MaritalStatus";
import type { EducationLevel } from "../domain/EducationLevel";

export interface PatientClinicalDiagnosis {
  readonly name: string;
  readonly diagnosisYear: number | null;
  readonly status: "active" | "controlled" | "resolved";
  readonly treatment: string | null;
}

export type PatientClinicalTreatment = PatientCurrentTreatmentDetail;
export type PatientClinicalMedication = PatientDailyMedicationDetail;
export type PatientClinicalSupplement = PatientSupplementDetail;
export type PatientClinicalMedicationAllergy = PatientMedicationAllergyDetail;
export type PatientClinicalIntolerance = PatientIntoleranceDetail;
export type PatientClinicalPreviousSurgery = PatientPreviousSurgeryDetail;

export type PatientClinicalIntakeResponses = Readonly<
  Pick<
    PatientMedicalIntake,
    | "diagnosedConditions"
    | "previousSurgeries"
    | "currentTreatments"
    | "intolerances"
    | "familyHistory"
    | "medications"
    | "supplements"
    | "medicationAllergies"
    | "adverseMedicationOrSupplementEffects"
  >
>;

export interface PatientClinicalPhysicalActivity {
  readonly reported: boolean | null;
  readonly level: PatientPhysicalActivityLevel | null;
  readonly daysPerWeek: number | null;
  readonly activityLevelKey: ActivityLevelKey | null;
  readonly profile: PatientActivityProfile | null;
  readonly dailyActivity: PatientDailyActivity | null;
}

export interface PatientClinicalContext {
  readonly fullName: string;
  readonly age: number;
  readonly sex: Sex;
  readonly gender: Gender | null;
  readonly maritalStatus: MaritalStatus | null;
  readonly occupation: string | null;
  readonly education: EducationLevel | null;
  readonly admissionReason: string | null;
  readonly intakeResponses: PatientClinicalIntakeResponses;
  readonly diagnoses: readonly PatientClinicalDiagnosis[];
  readonly previousSurgeries: readonly PatientClinicalPreviousSurgery[];
  readonly treatments: readonly PatientClinicalTreatment[];
  readonly medications: readonly PatientClinicalMedication[];
  readonly supplements: readonly PatientClinicalSupplement[];
  readonly medicationAllergies: readonly PatientClinicalMedicationAllergy[];
  readonly intolerances: readonly PatientClinicalIntolerance[];
  readonly familyHistoryMode: PatientFamilyHistoryMode | null;
  readonly familyHistoryDetails: PatientFamilyHistoryDetails | null;
  readonly adverseEffectDetails: string | null;
  readonly diet: PatientFoodPreferences | null;
  readonly mealRoutine: PatientMealRoutine | null;
  readonly eatingPatterns: PatientEatingPatterns | null;
  readonly mealsPerDay: number | null;
  readonly hydration: PatientHydrationHabits | null;
  readonly digestive: PatientDigestiveHealth | null;
  readonly physicalActivity: PatientClinicalPhysicalActivity;
  readonly generalNotes: string | null;
  readonly clinicalTags: readonly string[];
}

export interface PatientMealPlanClinicalContext {
  readonly diagnosisNames: readonly string[];
  readonly restrictions: readonly string[];
  readonly preferences: readonly string[];
  readonly clinicalConsiderations: readonly string[];
}

const ACTIVITY_LEVEL_KEY_BY_PATIENT_LEVEL = {
  sedentary: "sedentary",
  light: "light",
  moderate: "moderate",
  intense: "active",
} as const satisfies Record<PatientPhysicalActivityLevel, ActivityLevelKey>;

export function toActivityLevelKey(
  level: PatientPhysicalActivityLevel | null,
): ActivityLevelKey | null {
  return level ? ACTIVITY_LEVEL_KEY_BY_PATIENT_LEVEL[level] : null;
}

export function toPatientClinicalContext(
  patient: Patient,
): PatientClinicalContext {
  const intake = patient.medicalIntake;
  const nutrition = intake.nutritionIntake;
  const activityProfile = copyActivityProfile(
    intake.physicalActivityIntake?.activity ?? null,
  );
  const dailyActivity = copyRecord(
    intake.physicalActivityIntake?.dailyActivity ?? null,
  );
  const mealRoutine = copyMealRoutine(nutrition?.routine ?? null);

  return Object.freeze({
    fullName: patient.fullName,
    age: patient.age,
    sex: patient.sex,
    gender: patient.gender,
    maritalStatus: patient.maritalStatus,
    occupation: patient.occupation,
    education: patient.education,
    admissionReason: patient.admissionReason,
    intakeResponses: Object.freeze({
      diagnosedConditions: intake.diagnosedConditions,
      previousSurgeries: intake.previousSurgeries,
      currentTreatments: intake.currentTreatments,
      intolerances: intake.intolerances,
      familyHistory: intake.familyHistory,
      medications: intake.medications,
      supplements: intake.supplements,
      medicationAllergies: intake.medicationAllergies,
      adverseMedicationOrSupplementEffects:
        intake.adverseMedicationOrSupplementEffects,
    }),
    diagnoses: Object.freeze(
      intake.diagnosedConditionDetails.map((diagnosis) =>
        Object.freeze({
          name: diagnosis.diagnosis,
          diagnosisYear: diagnosis.diagnosisYear,
          status: diagnosis.status,
          treatment: diagnosis.treatment,
        }),
      ),
    ),
    previousSurgeries: copyRecords(intake.previousSurgeryDetails),
    treatments: copyRecords(intake.currentTreatmentDetails),
    medications: copyRecords(intake.dailyMedicationDetails),
    supplements: copyRecords(intake.supplementDetails),
    medicationAllergies: copyRecords(intake.medicationAllergyDetails),
    intolerances: copyRecords(intake.intoleranceDetails),
    familyHistoryMode: intake.familyHistoryMode,
    familyHistoryDetails: copyFamilyHistoryDetails(intake.familyHistoryDetails),
    adverseEffectDetails: intake.adverseEffectDetails,
    diet: copyRecord(nutrition?.preferences ?? null),
    mealRoutine,
    eatingPatterns: copyRecord(nutrition?.patterns ?? null),
    mealsPerDay: mealRoutine?.mealsPerDay ?? null,
    hydration: copyRecord(nutrition?.hydration ?? null),
    digestive: copyDigestiveHealth(nutrition?.digestive ?? null),
    physicalActivity: Object.freeze({
      reported: intake.physicalActivity,
      level: activityProfile?.level ?? null,
      daysPerWeek: activityProfile?.daysPerWeek ?? null,
      activityLevelKey: toActivityLevelKey(activityProfile?.level ?? null),
      profile: activityProfile,
      dailyActivity,
    }),
    generalNotes: patient.generalNotes,
    clinicalTags: Object.freeze([...patient.clinicalTags]),
  });
}

export function toPatientMealPlanClinicalContext(
  context: PatientClinicalContext,
): PatientMealPlanClinicalContext {
  const diet = context.diet;
  const dietType = diet
    ? diet.usualDietType === "other"
      ? (diet.otherDietDescription ?? diet.usualDietType)
      : diet.usualDietType
    : null;

  return Object.freeze({
    diagnosisNames: uniqueStrings(
      context.diagnoses.map((diagnosis) => diagnosis.name),
    ),
    restrictions: uniqueStrings([
      diet?.avoidedFoods,
      diet?.foodRestrictionDetails,
      diet?.discomfortFoods,
      ...context.intolerances.map((intolerance) => intolerance.substance),
    ]),
    preferences: uniqueStrings([
      dietType,
      diet?.specialPreference === "none" ? null : diet?.specialPreference,
      diet?.notes,
    ]),
    clinicalConsiderations: buildMealPlanClinicalConsiderations(context),
  });
}

export function buildConsultationPrefill(
  context: PatientClinicalContext,
): string {
  const lines = [
    `Paciente: ${context.fullName} | Edad: ${context.age} | Sexo: ${context.sex}`,
  ];

  const socialContext = [
    context.gender ? `género: ${context.gender}` : null,
    context.maritalStatus ? `estado civil: ${context.maritalStatus}` : null,
    context.occupation ? `ocupación: ${context.occupation}` : null,
    context.education ? `escolaridad: ${context.education}` : null,
  ].filter((value): value is string => Boolean(value));
  if (socialContext.length > 0) {
    lines.push(`Contexto sociodemográfico: ${socialContext.join("; ")}`);
  }

  if (context.admissionReason) {
    lines.push(`Motivo de ingreso: ${context.admissionReason}`);
  }

  if (context.diagnoses.length > 0) {
    lines.push(
      `Diagnósticos: ${context.diagnoses
        .map(
          (diagnosis) =>
            `${diagnosis.name} (año: ${formatNullable(diagnosis.diagnosisYear)}; estado: ${diagnosis.status}; tratamiento: ${formatNullable(diagnosis.treatment)})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Diagnósticos",
      context.intakeResponses.diagnosedConditions,
    );
  }
  if (context.previousSurgeries.length > 0) {
    lines.push(
      `Cirugías previas: ${context.previousSurgeries
        .map(
          (surgery) =>
            `${surgery.procedure} (año: ${formatNullable(surgery.year)}; motivo: ${formatNullable(surgery.reason)})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Cirugías previas",
      context.intakeResponses.previousSurgeries,
    );
  }
  if (context.treatments.length > 0) {
    lines.push(
      `Tratamientos actuales: ${context.treatments
        .map(
          (treatment) =>
            `${treatment.name} (motivo: ${treatment.reason}; frecuencia: ${treatment.frequency}; profesional: ${formatNullable(treatment.professional)})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Tratamientos actuales",
      context.intakeResponses.currentTreatments,
    );
  }
  if (context.medications.length > 0) {
    lines.push(
      `Medicamentos: ${context.medications
        .map(
          (medication) =>
            `${medication.name} ${medication.dose} (frecuencia: ${medication.frequency}; horario: ${medication.schedule}; motivo: ${medication.reason}; prescrito por profesional: ${formatBoolean(medication.prescribedByProfessional)})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Medicamentos",
      context.intakeResponses.medications,
    );
  }
  if (context.supplements.length > 0) {
    lines.push(
      `Suplementos: ${context.supplements
        .map(
          (supplement) =>
            `${supplement.name} ${supplement.dose} (frecuencia: ${supplement.frequency}; objetivo: ${supplement.objective})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Suplementos",
      context.intakeResponses.supplements,
    );
  }
  if (context.medicationAllergies.length > 0) {
    lines.push(
      `Alergias a medicamentos: ${context.medicationAllergies
        .map(
          (allergy) =>
            `${allergy.medication}: ${allergy.reaction} (severidad: ${allergy.severity}; requirió atención médica: ${formatBoolean(allergy.requiredMedicalAttention)})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Alergias a medicamentos",
      context.intakeResponses.medicationAllergies,
    );
  }
  if (context.intolerances.length > 0) {
    lines.push(
      `Intolerancias: ${context.intolerances
        .map(
          (intolerance) =>
            `${intolerance.substance}: ${intolerance.reaction} (${intolerance.severity})`,
        )
        .join(", ")}`,
    );
  } else {
    pushReportedStatus(
      lines,
      "Intolerancias",
      context.intakeResponses.intolerances,
    );
  }
  if (
    context.intakeResponses.adverseMedicationOrSupplementEffects !== null ||
    context.adverseEffectDetails
  ) {
    lines.push(
      `Efectos adversos de medicamentos o suplementos: ${formatNullableBoolean(context.intakeResponses.adverseMedicationOrSupplementEffects)}; detalles: ${formatNullable(context.adverseEffectDetails)}`,
    );
  }
  if (
    context.familyHistoryMode !== null ||
    context.intakeResponses.familyHistory !== null ||
    context.familyHistoryDetails
  ) {
    const details = context.familyHistoryDetails;
    lines.push(
      [
        `Antecedentes familiares: modo ${formatNullable(context.familyHistoryMode)}`,
        `reporte: ${formatNullableBoolean(context.intakeResponses.familyHistory)}`,
        details
          ? `diabetes: ${formatList(details.diabetes)}; hipertensión: ${formatList(details.hypertension)}; obesidad: ${formatList(details.obesity)}; enfermedad cardiovascular: ${formatList(details.cardiovascularDisease)}; dislipidemia: ${formatList(details.dyslipidemia)}; enfermedad renal: ${formatList(details.kidneyDisease)}; enfermedad tiroidea: ${formatList(details.thyroidDisease)}; otras: ${formatNullable(details.otherConditions)}; notas: ${formatNullable(details.notes)}`
          : "detalles: no especificado",
      ].join("; "),
    );
  }

  const mealPlanContext = toPatientMealPlanClinicalContext(context);
  if (mealPlanContext.preferences.length > 0) {
    lines.push(`Preferencias: ${mealPlanContext.preferences.join(", ")}`);
  }
  if (mealPlanContext.restrictions.length > 0) {
    lines.push(`Restricciones: ${mealPlanContext.restrictions.join(", ")}`);
  }
  if (context.diet) {
    lines.push(
      `Alimentación habitual: tipo ${context.diet.usualDietType}; otra descripción: ${formatNullable(context.diet.otherDietDescription)}; evita alimentos: ${formatBoolean(context.diet.avoidsFoods)} (${formatNullable(context.diet.avoidedFoods)}); sigue restricciones: ${formatBoolean(context.diet.followsFoodRestrictions)} (${formatNullable(context.diet.foodRestrictionDetails)}); alimentos con malestar: ${formatBoolean(context.diet.hasFoodDiscomfort)} (${formatNullable(context.diet.discomfortFoods)}); preferencia especial: ${context.diet.specialPreference}; notas: ${formatNullable(context.diet.notes)}`,
    );
  }
  if (context.mealRoutine) {
    lines.push(formatMealRoutine(context.mealRoutine));
  }
  if (context.eatingPatterns) {
    lines.push(formatEatingPatterns(context.eatingPatterns));
  }
  if (context.hydration) {
    lines.push(formatHydration(context.hydration));
  }
  if (context.digestive) {
    lines.push(formatDigestive(context.digestive));
  }
  if (context.physicalActivity.profile) {
    lines.push(formatActivityProfile(context.physicalActivity));
  } else if (context.physicalActivity.reported !== null) {
    lines.push(
      `Actividad física reportada: ${context.physicalActivity.reported ? "sí" : "no"}; perfil no disponible`,
    );
  }
  if (context.physicalActivity.dailyActivity) {
    lines.push(formatDailyActivity(context.physicalActivity.dailyActivity));
  }
  if (context.generalNotes) lines.push(`Notas: ${context.generalNotes}`);
  if (context.clinicalTags.length > 0) {
    lines.push(`Etiquetas: ${context.clinicalTags.join(", ")}`);
  }

  return lines.join("\n");
}

function copyRecord<T extends object>(value: T | null): T | null {
  return value ? Object.freeze({ ...value }) : null;
}

function copyRecords<T extends object>(values: readonly T[]): readonly T[] {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })));
}

function copyMealRoutine(
  value: PatientMealRoutine | null,
): PatientMealRoutine | null {
  return value
    ? Object.freeze({
        ...value,
        snackTimes: Object.freeze([...value.snackTimes]),
      })
    : null;
}

function copyFamilyHistoryDetails(
  value: PatientFamilyHistoryDetails | null,
): PatientFamilyHistoryDetails | null {
  return value
    ? Object.freeze({
        ...value,
        diabetes: Object.freeze([...value.diabetes]),
        hypertension: Object.freeze([...value.hypertension]),
        obesity: Object.freeze([...value.obesity]),
        cardiovascularDisease: Object.freeze([...value.cardiovascularDisease]),
        dyslipidemia: Object.freeze([...value.dyslipidemia]),
        kidneyDisease: Object.freeze([...value.kidneyDisease]),
        thyroidDisease: Object.freeze([...value.thyroidDisease]),
      })
    : null;
}

function copyActivityProfile(
  value: PatientActivityProfile | null,
): PatientActivityProfile | null {
  return value
    ? Object.freeze({
        ...value,
        activityTypes: Object.freeze([...value.activityTypes]),
      })
    : null;
}

function copyDigestiveHealth(
  value: PatientDigestiveHealth | null,
): PatientDigestiveHealth | null {
  return value
    ? Object.freeze({
        ...value,
        symptoms: Object.freeze([...value.symptoms]),
      })
    : null;
}

function buildMealPlanClinicalConsiderations(
  context: PatientClinicalContext,
): readonly string[] {
  const medication = context.medications.length
    ? `Medicación: ${context.medications
        .map(
          (item) =>
            `${item.name} ${item.dose}, ${item.frequency}, horario ${item.schedule}, motivo ${item.reason}`,
        )
        .join("; ")}`
    : null;
  const medicationAllergies = context.medicationAllergies.length
    ? `Alergias a medicamentos: ${context.medicationAllergies
        .map(
          (item) =>
            `${item.medication} (${item.reaction}, ${item.severity}, atención médica: ${formatBoolean(item.requiredMedicalAttention)})`,
        )
        .join("; ")}`
    : null;
  const adverseEffects = context.adverseEffectDetails
    ? `Efectos adversos reportados: ${context.adverseEffectDetails}`
    : null;
  const activity = context.physicalActivity.profile
    ? formatActivityProfile(context.physicalActivity)
    : context.physicalActivity.reported !== null
      ? `Actividad física reportada: ${formatBoolean(context.physicalActivity.reported)}; perfil no disponible`
      : null;

  return uniqueStrings([
    medication,
    medicationAllergies,
    adverseEffects,
    context.hydration ? formatHydration(context.hydration) : null,
    context.digestive ? formatDigestive(context.digestive) : null,
    context.eatingPatterns
      ? formatEatingPatterns(context.eatingPatterns)
      : null,
    activity,
    context.physicalActivity.dailyActivity
      ? formatDailyActivity(context.physicalActivity.dailyActivity)
      : null,
  ]);
}

function formatMealRoutine(routine: PatientMealRoutine): string {
  return `Rutina alimentaria: ${routine.mealsPerDay} comidas/día; desayuno: ${routine.breakfastTime}; comida: ${routine.mainMealTime}; cena: ${routine.dinnerTime}; colaciones: ${formatList(routine.snackTimes)}; salta comidas: ${formatBoolean(routine.skipsMeals)}; comida más omitida: ${formatNullable(routine.mostSkippedMeal)}; horarios variables: ${formatBoolean(routine.scheduleVaries)}; variación: ${formatNullable(routine.scheduleVariation)}; duración: ${routine.mealDuration}`;
}

function formatEatingPatterns(patterns: PatientEatingPatterns): string {
  return `Patrones alimentarios: come fuera ${patterns.eatingOutFrequency}; colaciones entre comidas: ${formatBoolean(patterns.snacksBetweenMeals)}; come tarde por la noche: ${formatBoolean(patterns.eatsLateAtNight)}; antojos frecuentes: ${formatBoolean(patterns.frequentCravings)}; horario de antojos: ${formatNullable(patterns.cravingTime)}; prepara alimentos: ${patterns.mealPreparer}; lugar principal: ${formatNullable(patterns.primaryMealLocation)}`;
}

function formatHydration(hydration: PatientHydrationHabits): string {
  return `Hidratación: agua ${hydration.waterIntake}; bebe durante el día: ${formatBoolean(hydration.drinksWaterThroughoutDay)}; lleva botella: ${formatBoolean(hydration.carriesWaterBottle)}; café/té: ${hydration.coffeeTeaFrequency}; bebidas azucaradas: ${hydration.sugaryDrinkFrequency}; bebidas energéticas: ${formatBoolean(hydration.consumesEnergyDrinks)}; otra bebida: ${hydration.otherBeverage}; alcohol: ${formatNullable(hydration.alcoholFrequency)}; notas: ${formatNullable(hydration.notes)}`;
}

function formatDigestive(digestive: PatientDigestiveHealth): string {
  return `Digestivo: apetito ${digestive.appetiteLevel}; saciedad temprana: ${formatBoolean(digestive.earlySatiety)}; malestar digestivo: ${formatBoolean(digestive.hasDigestiveDiscomfort)}; síntomas: ${formatList(digestive.symptoms)}; otro síntoma: ${formatNullable(digestive.otherSymptomDescription)}; momento: ${formatNullable(digestive.symptomTiming)}; notas: ${formatNullable(digestive.notes)}`;
}

function formatActivityProfile(
  activity: PatientClinicalPhysicalActivity,
): string {
  const profile = activity.profile;
  if (!profile) return "Actividad física: perfil no disponible";
  return `Actividad física: ${profile.level}, ${profile.daysPerWeek} días/semana; duración: ${formatNullable(profile.sessionDurationMinutes)} minutos; tipos: ${formatList(profile.activityTypes)}; meta: ${formatNullable(profile.primaryGoal)}; limitaciones: ${formatBoolean(profile.hasPhysicalLimitation)}; detalle de limitación: ${formatNullable(profile.physicalLimitationDetails)}; notas: ${formatNullable(profile.notes)}; TDEE: ${formatNullable(activity.activityLevelKey)}`;
}

function formatDailyActivity(activity: PatientDailyActivity): string {
  return `Actividad diaria: tiempo sedentario ${activity.sedentaryTime}; transporte ${activity.usualTransportation}; usa escaleras frecuentemente: ${formatBoolean(activity.usesStairsFrequently)}; pausas activas: ${activity.activeBreakFrequency}; rutina: ${activity.routineType}; notas: ${formatNullable(activity.notes)}`;
}

function pushReportedStatus(
  lines: string[],
  label: string,
  reported: boolean | null,
): void {
  if (reported !== null) {
    lines.push(
      `${label}: ${formatBoolean(reported)}; sin detalles registrados`,
    );
  }
}

function formatBoolean(value: boolean): string {
  return value ? "sí" : "no";
}

function formatNullableBoolean(value: boolean | null): string {
  return value === null ? "no especificado" : formatBoolean(value);
}

function formatNullable(value: string | number | null): string {
  return value === null || value === "" ? "no especificado" : String(value);
}

function formatList(values: readonly (string | number)[]): string {
  return values.length > 0 ? values.join(", ") : "ninguno registrado";
}

function uniqueStrings(
  values: readonly (string | null | undefined)[],
): readonly string[] {
  return Object.freeze(
    Array.from(
      new Set(
        values.flatMap((value) => {
          const normalized = value?.trim();
          return normalized ? [normalized] : [];
        }),
      ),
    ),
  );
}
