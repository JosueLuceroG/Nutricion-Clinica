import * as React from "react";
import { ClipboardCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import type {
  PatientFamilyRelationship,
  PatientMedicalIntake,
} from "@modules/patient/domain/Patient";

interface PatientMedicalIntakeCardProps {
  intake: PatientMedicalIntake;
}

export const PatientMedicalIntakeCard = React.memo(function PatientMedicalIntakeCard({
  intake,
}: PatientMedicalIntakeCardProps) {
  const { t } = useTranslation();
  const nutrition = intake.nutritionIntake;
  const activity = intake.physicalActivityIntake?.activity;
  const dailyActivity = intake.physicalActivityIntake?.dailyActivity;
  const hasNutrition = Boolean(
    nutrition?.routine ||
    nutrition?.patterns ||
    nutrition?.preferences ||
    nutrition?.hydration ||
    nutrition?.digestive,
  );
  const hasPersonalHistory =
    intake.diagnosedConditions !== null ||
    intake.previousSurgeries !== null ||
    intake.currentTreatments !== null ||
    intake.intolerances !== null ||
    intake.diagnosedConditionDetails.length > 0 ||
    intake.previousSurgeryDetails.length > 0 ||
    intake.currentTreatmentDetails.length > 0 ||
    intake.intoleranceDetails.length > 0;
  const familyDetails = intake.familyHistoryDetails;
  const hasFamilyDetails = Boolean(
    familyDetails &&
    (familyDetails.diabetes.length > 0 ||
      familyDetails.hypertension.length > 0 ||
      familyDetails.obesity.length > 0 ||
      familyDetails.cardiovascularDisease.length > 0 ||
      familyDetails.dyslipidemia.length > 0 ||
      familyDetails.kidneyDisease.length > 0 ||
      familyDetails.thyroidDisease.length > 0 ||
      familyDetails.otherConditions ||
      familyDetails.notes),
  );
  const hasFamilyHistory =
    intake.familyHistory !== null ||
    intake.familyHistoryMode !== null ||
    hasFamilyDetails;
  const hasMedicationHistory =
    intake.medications !== null ||
    intake.supplements !== null ||
    intake.medicationAllergies !== null ||
    intake.adverseMedicationOrSupplementEffects !== null ||
    intake.supplementDetails.length > 0 ||
    intake.medicationAllergyDetails.length > 0 ||
    intake.dailyMedicationDetails.length > 0 ||
    intake.adverseEffectDetails !== null;
  const hasActivity = intake.physicalActivity !== null || Boolean(activity);
  const hasData =
    hasPersonalHistory ||
    hasFamilyHistory ||
    hasMedicationHistory ||
    hasNutrition ||
    hasActivity ||
    Boolean(dailyActivity);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          {t("patient.initial_screening_title")}
        </CardTitle>
        <CardDescription>
          {t("patient.initial_screening_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            {t("patient.initial_screening_empty")}
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {hasPersonalHistory && (
              <IntakeSection
                title={t("patient.wizard.pathological_history_title")}
              >
                <FactGrid>
                  <BooleanFact
                    label={t("patient.wizard.question_diagnosed_conditions")}
                    value={intake.diagnosedConditions}
                  />
                  <BooleanFact
                    label={t("patient.wizard.question_previous_surgeries")}
                    value={intake.previousSurgeries}
                  />
                  <BooleanFact
                    label={t("patient.wizard.question_current_treatments")}
                    value={intake.currentTreatments}
                  />
                  <BooleanFact
                    label={t("patient.wizard.question_intolerances")}
                    value={intake.intolerances}
                  />
                </FactGrid>

                <DetailGrid>
                  {intake.diagnosedConditionDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.diagnosis}-${index}`}
                      title={t("patient.wizard.condition_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact
                          label={t("patient.wizard.condition_diagnosis_label")}
                        >
                          {detail.diagnosis}
                        </Fact>
                        {detail.diagnosisYear !== null && (
                          <Fact
                            label={t("patient.wizard.condition_year_label")}
                          >
                            {detail.diagnosisYear}
                          </Fact>
                        )}
                        <Fact
                          label={t("patient.wizard.condition_status_label")}
                        >
                          {t(
                            `patient.wizard.condition_status_${detail.status}`,
                          )}
                        </Fact>
                        {detail.treatment && (
                          <Fact
                            label={t(
                              "patient.wizard.condition_treatment_label",
                            )}
                          >
                            {detail.treatment}
                          </Fact>
                        )}
                      </FactGrid>
                    </DetailCard>
                  ))}

                  {intake.previousSurgeryDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.procedure}-${index}`}
                      title={t("patient.wizard.surgery_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact
                          label={t("patient.wizard.surgery_procedure_label")}
                        >
                          {detail.procedure}
                        </Fact>
                        {detail.year !== null && (
                          <Fact label={t("patient.wizard.surgery_year_label")}>
                            {detail.year}
                          </Fact>
                        )}
                        {detail.reason && (
                          <Fact
                            label={t("patient.wizard.surgery_reason_label")}
                          >
                            {detail.reason}
                          </Fact>
                        )}
                      </FactGrid>
                    </DetailCard>
                  ))}

                  {intake.currentTreatmentDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.name}-${index}`}
                      title={t("patient.wizard.treatment_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact label={t("patient.wizard.treatment_name_label")}>
                          {detail.name}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.treatment_reason_label")}
                        >
                          {detail.reason}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.treatment_frequency_label")}
                        >
                          {detail.frequency}
                        </Fact>
                        {detail.professional && (
                          <Fact
                            label={t(
                              "patient.wizard.treatment_professional_label",
                            )}
                          >
                            {detail.professional}
                          </Fact>
                        )}
                      </FactGrid>
                    </DetailCard>
                  ))}

                  {intake.intoleranceDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.substance}-${index}`}
                      title={t("patient.wizard.intolerance_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact
                          label={t(
                            "patient.wizard.intolerance_substance_label",
                          )}
                        >
                          {detail.substance}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.intolerance_reaction_label")}
                        >
                          {detail.reaction}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.intolerance_severity_label")}
                        >
                          {t(
                            `patient.wizard.allergy_severity_${detail.severity}`,
                          )}
                        </Fact>
                      </FactGrid>
                    </DetailCard>
                  ))}
                </DetailGrid>
              </IntakeSection>
            )}

            {hasFamilyHistory && (
              <IntakeSection title={t("patient.wizard.family_history_title")}>
                <FactGrid>
                  <BooleanFact
                    label={t("patient.wizard.question_family_history")}
                    value={intake.familyHistory}
                  />
                  {intake.familyHistoryMode && (
                    <Fact label={t("patient.wizard.family_mode_question")}>
                      {t(
                        `patient.wizard.family_mode_${intake.familyHistoryMode}`,
                      )}
                    </Fact>
                  )}
                </FactGrid>

                {familyDetails && hasFamilyDetails && (
                  <FactGrid>
                    <RelationshipFact
                      label={t("patient.wizard.family_diabetes")}
                      values={familyDetails.diabetes}
                    />
                    <RelationshipFact
                      label={t("patient.wizard.family_hypertension")}
                      values={familyDetails.hypertension}
                    />
                    <RelationshipFact
                      label={t("patient.wizard.family_obesity")}
                      values={familyDetails.obesity}
                    />
                    <RelationshipFact
                      label={t("patient.wizard.family_cardiovascular")}
                      values={familyDetails.cardiovascularDisease}
                    />
                    <RelationshipFact
                      label={t("patient.wizard.family_dyslipidemia")}
                      values={familyDetails.dyslipidemia}
                    />
                    <RelationshipFact
                      label={t("patient.wizard.family_kidney_disease")}
                      values={familyDetails.kidneyDisease}
                    />
                    <RelationshipFact
                      label={t("patient.wizard.family_thyroid_disease")}
                      values={familyDetails.thyroidDisease}
                    />
                    {familyDetails.otherConditions && (
                      <Fact label={t("patient.wizard.family_other_conditions")}>
                        {familyDetails.otherConditions}
                      </Fact>
                    )}
                    {familyDetails.notes && (
                      <Fact label={t("patient.wizard.family_notes")}>
                        {familyDetails.notes}
                      </Fact>
                    )}
                  </FactGrid>
                )}
              </IntakeSection>
            )}

            {hasMedicationHistory && (
              <IntakeSection
                title={t("patient.wizard.medications_supplements_title")}
              >
                <FactGrid>
                  <BooleanFact
                    label={t("patient.wizard.question_medications")}
                    value={intake.medications}
                  />
                  <BooleanFact
                    label={t("patient.wizard.question_supplements")}
                    value={intake.supplements}
                  />
                  <BooleanFact
                    label={t("patient.wizard.question_medication_allergies")}
                    value={intake.medicationAllergies}
                  />
                  <BooleanFact
                    label={t(
                      "patient.wizard.question_adverse_medication_effects",
                    )}
                    value={intake.adverseMedicationOrSupplementEffects}
                  />
                  {intake.adverseEffectDetails && (
                    <Fact label={t("patient.wizard.adverse_effect_label")}>
                      {intake.adverseEffectDetails}
                    </Fact>
                  )}
                </FactGrid>

                <DetailGrid>
                  {intake.dailyMedicationDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.name}-${index}`}
                      title={t("patient.wizard.medication_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact label={t("patient.wizard.medication_name_label")}>
                          {detail.name}
                        </Fact>
                        <Fact label={t("patient.wizard.medication_dose_label")}>
                          {detail.dose}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.medication_frequency_label")}
                        >
                          {t(
                            `patient.wizard.medication_frequency_${detail.frequency}`,
                          )}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.medication_schedule_label")}
                        >
                          {detail.schedule}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.medication_reason_label")}
                        >
                          {detail.reason}
                        </Fact>
                        <BooleanFact
                          label={t(
                            "patient.wizard.medication_prescribed_label",
                          )}
                          value={detail.prescribedByProfessional}
                        />
                      </FactGrid>
                    </DetailCard>
                  ))}

                  {intake.supplementDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.name}-${index}`}
                      title={t("patient.wizard.supplement_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact label={t("patient.wizard.supplement_name_label")}>
                          {detail.name}
                        </Fact>
                        <Fact label={t("patient.wizard.medication_dose_label")}>
                          {detail.dose}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.medication_frequency_label")}
                        >
                          {t(
                            `patient.wizard.medication_frequency_${detail.frequency}`,
                          )}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.supplement_objective_label")}
                        >
                          {detail.objective}
                        </Fact>
                      </FactGrid>
                    </DetailCard>
                  ))}

                  {intake.medicationAllergyDetails.map((detail, index) => (
                    <DetailCard
                      key={`${detail.medication}-${index}`}
                      title={t("patient.wizard.allergy_number", {
                        number: index + 1,
                      })}
                    >
                      <FactGrid>
                        <Fact
                          label={t("patient.wizard.allergy_medication_label")}
                        >
                          {detail.medication}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.allergy_reaction_label")}
                        >
                          {detail.reaction}
                        </Fact>
                        <Fact
                          label={t("patient.wizard.allergy_severity_label")}
                        >
                          {t(
                            `patient.wizard.allergy_severity_${detail.severity}`,
                          )}
                        </Fact>
                        <BooleanFact
                          label={t("patient.wizard.allergy_attention_label")}
                          value={detail.requiredMedicalAttention}
                        />
                      </FactGrid>
                    </DetailCard>
                  ))}
                </DetailGrid>
              </IntakeSection>
            )}

            {nutrition?.routine && (
              <IntakeSection
                title={t("patient.wizard.nutrition_routine_title")}
              >
                <FactGrid>
                  <Fact label={t("patient.wizard.nutrition_breakfast")}>
                    {nutrition.routine.breakfastTime}
                  </Fact>
                  <Fact label={t("patient.wizard.nutrition_main_meal")}>
                    {nutrition.routine.mainMealTime}
                  </Fact>
                  <Fact label={t("patient.wizard.nutrition_dinner")}>
                    {nutrition.routine.dinnerTime}
                  </Fact>
                  {nutrition.routine.snackTimes.length > 0 && (
                    <Fact label={t("patient.wizard.nutrition_snacks")}>
                      {nutrition.routine.snackTimes.join(", ")}
                    </Fact>
                  )}
                  <Fact label={t("patient.wizard.nutrition_meals_per_day")}>
                    {t("patient.wizard.nutrition_meal_count", {
                      count: nutrition.routine.mealsPerDay,
                    })}
                  </Fact>
                  <BooleanFact
                    label={t("patient.wizard.nutrition_skips_meals")}
                    value={nutrition.routine.skipsMeals}
                  />
                  {nutrition.routine.mostSkippedMeal && (
                    <Fact
                      label={t("patient.wizard.nutrition_most_skipped_meal")}
                    >
                      {t(
                        `patient.wizard.nutrition_meal_${nutrition.routine.mostSkippedMeal}`,
                      )}
                    </Fact>
                  )}
                  <BooleanFact
                    label={t("patient.wizard.nutrition_schedule_varies")}
                    value={nutrition.routine.scheduleVaries}
                  />
                  {nutrition.routine.scheduleVariation && (
                    <Fact
                      label={t("patient.wizard.nutrition_schedule_variation")}
                    >
                      {t(
                        `patient.wizard.nutrition_schedule_${nutrition.routine.scheduleVariation}`,
                      )}
                    </Fact>
                  )}
                  <Fact label={t("patient.wizard.nutrition_meal_duration")}>
                    {t(
                      `patient.wizard.nutrition_duration_${nutrition.routine.mealDuration}`,
                    )}
                  </Fact>
                </FactGrid>
              </IntakeSection>
            )}

            {nutrition?.patterns && (
              <IntakeSection
                title={t("patient.wizard.nutrition_patterns_title")}
              >
                <FactGrid>
                  <Fact label={t("patient.wizard.nutrition_eating_out")}>
                    {t(
                      `patient.wizard.nutrition_eating_out_${nutrition.patterns.eatingOutFrequency}`,
                    )}
                  </Fact>
                  <BooleanFact
                    label={t("patient.wizard.nutrition_snacks_between_meals")}
                    value={nutrition.patterns.snacksBetweenMeals}
                  />
                  <BooleanFact
                    label={t("patient.wizard.nutrition_eats_late_at_night")}
                    value={nutrition.patterns.eatsLateAtNight}
                  />
                  <BooleanFact
                    label={t("patient.wizard.nutrition_frequent_cravings")}
                    value={nutrition.patterns.frequentCravings}
                  />
                  {nutrition.patterns.cravingTime && (
                    <Fact label={t("patient.wizard.nutrition_craving_time")}>
                      {t(
                        `patient.wizard.nutrition_craving_time_${nutrition.patterns.cravingTime}`,
                      )}
                    </Fact>
                  )}
                  <Fact label={t("patient.wizard.nutrition_meal_preparer")}>
                    {t(
                      `patient.wizard.nutrition_preparer_${nutrition.patterns.mealPreparer}`,
                    )}
                  </Fact>
                  {nutrition.patterns.primaryMealLocation && (
                    <Fact label={t("patient.wizard.nutrition_meal_location")}>
                      {t(
                        `patient.wizard.nutrition_location_${nutrition.patterns.primaryMealLocation}`,
                      )}
                    </Fact>
                  )}
                </FactGrid>
              </IntakeSection>
            )}

            {nutrition?.preferences && (
              <IntakeSection
                title={t("patient.wizard.nutrition_preferences_title")}
              >
                <FactGrid>
                  <Fact label={t("patient.wizard.nutrition_usual_diet_type")}>
                    {t(
                      `patient.wizard.nutrition_diet_${nutrition.preferences.usualDietType}`,
                    )}
                  </Fact>
                  {nutrition.preferences.otherDietDescription && (
                    <Fact
                      label={t("patient.wizard.nutrition_other_diet_label")}
                    >
                      {nutrition.preferences.otherDietDescription}
                    </Fact>
                  )}
                  <BooleanFact
                    label={t("patient.wizard.nutrition_avoids_foods")}
                    value={nutrition.preferences.avoidsFoods}
                  />
                  {nutrition.preferences.avoidedFoods && (
                    <Fact
                      label={t("patient.wizard.nutrition_avoided_foods_label")}
                    >
                      {nutrition.preferences.avoidedFoods}
                    </Fact>
                  )}
                  <BooleanFact
                    label={t("patient.wizard.nutrition_food_restrictions")}
                    value={nutrition.preferences.followsFoodRestrictions}
                  />
                  {nutrition.preferences.foodRestrictionDetails && (
                    <Fact
                      label={t(
                        "patient.wizard.nutrition_food_restriction_details_label",
                      )}
                    >
                      {nutrition.preferences.foodRestrictionDetails}
                    </Fact>
                  )}
                  <BooleanFact
                    label={t("patient.wizard.nutrition_food_discomfort")}
                    value={nutrition.preferences.hasFoodDiscomfort}
                  />
                  {nutrition.preferences.discomfortFoods && (
                    <Fact
                      label={t(
                        "patient.wizard.nutrition_discomfort_foods_label",
                      )}
                    >
                      {nutrition.preferences.discomfortFoods}
                    </Fact>
                  )}
                  <Fact
                    label={t("patient.wizard.nutrition_special_preference")}
                  >
                    {t(
                      `patient.wizard.nutrition_special_${nutrition.preferences.specialPreference}`,
                    )}
                  </Fact>
                  {nutrition.preferences.notes && (
                    <Fact
                      label={t("patient.wizard.nutrition_preference_notes")}
                    >
                      {nutrition.preferences.notes}
                    </Fact>
                  )}
                </FactGrid>
              </IntakeSection>
            )}

            {nutrition?.hydration && (
              <IntakeSection
                title={t("patient.wizard.nutrition_hydration_title")}
              >
                <FactGrid>
                  <Fact label={t("patient.wizard.nutrition_water_intake")}>
                    {t(
                      `patient.wizard.nutrition_water_${nutrition.hydration.waterIntake}`,
                    )}
                  </Fact>
                  <BooleanFact
                    label={t("patient.wizard.nutrition_water_throughout_day")}
                    value={nutrition.hydration.drinksWaterThroughoutDay}
                  />
                  <BooleanFact
                    label={t("patient.wizard.nutrition_carries_bottle")}
                    value={nutrition.hydration.carriesWaterBottle}
                  />
                  <Fact
                    label={t("patient.wizard.nutrition_coffee_tea_frequency")}
                  >
                    {t(
                      `patient.wizard.nutrition_coffee_${nutrition.hydration.coffeeTeaFrequency}`,
                    )}
                  </Fact>
                  <Fact
                    label={t("patient.wizard.nutrition_sugary_drink_frequency")}
                  >
                    {t(
                      `patient.wizard.nutrition_sugary_${nutrition.hydration.sugaryDrinkFrequency}`,
                    )}
                  </Fact>
                  <BooleanFact
                    label={t("patient.wizard.nutrition_energy_drinks")}
                    value={nutrition.hydration.consumesEnergyDrinks}
                  />
                  <Fact label={t("patient.wizard.nutrition_other_beverage")}>
                    {t(
                      `patient.wizard.nutrition_beverage_${nutrition.hydration.otherBeverage}`,
                    )}
                  </Fact>
                  {nutrition.hydration.alcoholFrequency && (
                    <Fact
                      label={t("patient.wizard.nutrition_alcohol_frequency")}
                    >
                      {t(
                        `patient.wizard.nutrition_alcohol_${nutrition.hydration.alcoholFrequency}`,
                      )}
                    </Fact>
                  )}
                  {nutrition.hydration.notes && (
                    <Fact label={t("patient.wizard.nutrition_hydration_notes")}>
                      {nutrition.hydration.notes}
                    </Fact>
                  )}
                </FactGrid>
              </IntakeSection>
            )}

            {nutrition?.digestive && (
              <IntakeSection
                title={t("patient.wizard.nutrition_digestive_title")}
              >
                <FactGrid>
                  <Fact label={t("patient.wizard.nutrition_appetite_level")}>
                    {t(
                      `patient.wizard.nutrition_appetite_${nutrition.digestive.appetiteLevel}`,
                    )}
                  </Fact>
                  <BooleanFact
                    label={t("patient.wizard.nutrition_early_satiety")}
                    value={nutrition.digestive.earlySatiety}
                  />
                  <BooleanFact
                    label={t(
                      "patient.wizard.nutrition_has_digestive_discomfort",
                    )}
                    value={nutrition.digestive.hasDigestiveDiscomfort}
                  />
                  {nutrition.digestive.symptoms.length > 0 && (
                    <Fact label={t("patient.wizard.nutrition_select_symptoms")}>
                      {nutrition.digestive.symptoms
                        .map((symptom) =>
                          t(`patient.wizard.nutrition_symptom_${symptom}`),
                        )
                        .join(", ")}
                    </Fact>
                  )}
                  {nutrition.digestive.otherSymptomDescription && (
                    <Fact
                      label={t("patient.wizard.nutrition_other_symptom_label")}
                    >
                      {nutrition.digestive.otherSymptomDescription}
                    </Fact>
                  )}
                  {nutrition.digestive.symptomTiming && (
                    <Fact label={t("patient.wizard.nutrition_symptom_timing")}>
                      {t(
                        `patient.wizard.nutrition_timing_${nutrition.digestive.symptomTiming}`,
                      )}
                    </Fact>
                  )}
                  {nutrition.digestive.notes && (
                    <Fact label={t("patient.wizard.nutrition_digestive_notes")}>
                      {nutrition.digestive.notes}
                    </Fact>
                  )}
                </FactGrid>
              </IntakeSection>
            )}

            {hasActivity && (
              <IntakeSection
                title={t("patient.wizard.physical_activity_section_title")}
              >
                <FactGrid>
                  <BooleanFact
                    label={t("patient.wizard.question_physical_activity")}
                    value={intake.physicalActivity}
                  />
                  {activity && (
                    <>
                      <Fact
                        label={t(
                          "patient.wizard.physical_activity_level_question",
                        )}
                      >
                        {t(
                          `patient.wizard.physical_activity_level_${activity.level}`,
                        )}
                      </Fact>
                      <Fact
                        label={t(
                          "patient.wizard.physical_activity_days_question",
                        )}
                      >
                        {t("patient.wizard.physical_activity_days_option", {
                          count: activity.daysPerWeek,
                        })}
                      </Fact>
                      {activity.sessionDurationMinutes !== null && (
                        <Fact
                          label={t(
                            "patient.wizard.physical_activity_duration_question",
                          )}
                        >
                          {t(
                            "patient.wizard.physical_activity_duration_option",
                            { count: activity.sessionDurationMinutes },
                          )}
                        </Fact>
                      )}
                      {activity.activityTypes.length > 0 && (
                        <Fact
                          label={t(
                            "patient.wizard.physical_activity_type_question",
                          )}
                        >
                          {activity.activityTypes
                            .map((type) =>
                              t(
                                `patient.wizard.physical_activity_type_${type}`,
                              ),
                            )
                            .join(", ")}
                        </Fact>
                      )}
                      {activity.primaryGoal && (
                        <Fact
                          label={t(
                            "patient.wizard.physical_activity_goal_question",
                          )}
                        >
                          {t(
                            `patient.wizard.physical_activity_goal_${activity.primaryGoal}`,
                          )}
                        </Fact>
                      )}
                      <BooleanFact
                        label={t(
                          "patient.wizard.physical_activity_limitation_question",
                        )}
                        value={activity.hasPhysicalLimitation}
                      />
                      {activity.physicalLimitationDetails && (
                        <Fact
                          label={t(
                            "patient.wizard.physical_activity_limitation_details",
                          )}
                        >
                          {activity.physicalLimitationDetails}
                        </Fact>
                      )}
                      {activity.notes && (
                        <Fact
                          label={t("patient.wizard.physical_activity_notes")}
                        >
                          {activity.notes}
                        </Fact>
                      )}
                    </>
                  )}
                </FactGrid>
              </IntakeSection>
            )}

            {dailyActivity && (
              <IntakeSection
                title={t("patient.wizard.daily_activity_section_title")}
              >
                <FactGrid>
                  <Fact
                    label={t(
                      "patient.wizard.daily_activity_sedentary_question",
                    )}
                  >
                    {t(
                      `patient.wizard.daily_activity_sedentary_${dailyActivity.sedentaryTime}`,
                    )}
                  </Fact>
                  <Fact
                    label={t(
                      "patient.wizard.daily_activity_transport_question",
                    )}
                  >
                    {t(
                      `patient.wizard.daily_activity_transport_${dailyActivity.usualTransportation}`,
                    )}
                  </Fact>
                  <BooleanFact
                    label={t("patient.wizard.daily_activity_stairs_question")}
                    value={dailyActivity.usesStairsFrequently}
                  />
                  <Fact
                    label={t("patient.wizard.daily_activity_breaks_question")}
                  >
                    {t(
                      `patient.wizard.daily_activity_breaks_${dailyActivity.activeBreakFrequency}`,
                    )}
                  </Fact>
                  <Fact
                    label={t("patient.wizard.daily_activity_routine_question")}
                  >
                    {t(
                      `patient.wizard.daily_activity_routine_${dailyActivity.routineType}`,
                    )}
                  </Fact>
                  {dailyActivity.notes && (
                    <Fact label={t("patient.wizard.daily_activity_notes")}>
                      {dailyActivity.notes}
                    </Fact>
                  )}
                </FactGrid>
              </IntakeSection>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

function IntakeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const titleId = React.useId();
  return (
    <section
      aria-labelledby={titleId}
      className="space-y-3 rounded-lg border bg-muted/10 p-4"
    >
      <h3 id={titleId} className="font-semibold leading-none">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FactGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-2 sm:grid-cols-2">{children}</dl>;
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  if (items.length === 0) return null;
  return <div className="grid gap-3">{items}</div>;
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article aria-label={title} className="rounded-md border bg-background p-3">
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      {children}
    </article>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium whitespace-pre-wrap">
        {children}
      </dd>
    </div>
  );
}

function BooleanFact({
  label,
  value,
}: {
  label: string;
  value: boolean | null;
}) {
  const { t } = useTranslation();
  if (value === null) return null;
  return <Fact label={label}>{t(value ? "common.yes" : "common.no")}</Fact>;
}

function RelationshipFact({
  label,
  values,
}: {
  label: string;
  values: readonly PatientFamilyRelationship[];
}) {
  const { t } = useTranslation();
  if (values.length === 0) return null;
  return (
    <Fact label={label}>
      {values
        .map((relationship) =>
          t(`patient.wizard.family_member_${relationship}`),
        )
        .join(", ")}
    </Fact>
  );
}
