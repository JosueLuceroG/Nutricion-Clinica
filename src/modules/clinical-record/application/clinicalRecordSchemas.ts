import { z } from "zod";
import { SeveritySchema, AllergyDiagnosisSchema } from "../domain/Allergy";
import { MedicationFreqSchema } from "../domain/Medication";
import { EventTypeSchema } from "../domain/ClinicalEvent";
import { FamilyRelationshipSchema, ConditionSchema } from "../domain/FamilyHistory";
import { PersonalConditionSchema } from "../domain/PersonalHistory";
import { HabitCategorySchema } from "../domain/Habit";
import { ActivityTypeSchema, BorgIntensitySchema } from "../domain/PhysicalActivity";
import { DietTypeSchema, MealPlaceSchema } from "../domain/DietHistory";
import { MechanismSchema, IntoleranceSeveritySchema } from "../domain/Intolerance";
import { SurgeryTypeSchema } from "../domain/Surgery";
import { SupplementCategorySchema } from "../domain/Supplement";
import { FrequencyValueSchema } from "../domain/FoodFrequency";
import { GiSymptomTypeSchema } from "../domain/GiSymptom";

export const allergyFormSchema = z.object({
  allergen: z.string().min(2, "Mínimo 2 caracteres").max(200, "Máximo 200 caracteres"),
  reaction: z.string().min(2, "Mínimo 2 caracteres").max(500, "Máximo 500 caracteres"),
  severity: SeveritySchema,
  diagnosis: AllergyDiagnosisSchema,
  notes: z.string().max(1000).optional(),
});

export type AllergyFormData = z.infer<typeof allergyFormSchema>;

export const medicationFormSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(200),
  activeIngredient: z.string().min(2, "Mínimo 2 caracteres").max(200),
  dose: z.string().min(1, "Requerido").max(100),
  frequency: MedicationFreqSchema,
  route: z.string().min(1, "Requerido").max(100).default("oral"),
  startDate: z.string().min(1, "Requerido"),
  endDate: z.string().optional(),
  prescribedBy: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export type MedicationFormData = z.infer<typeof medicationFormSchema>;

export const clinicalEventFormSchema = z.object({
  type: EventTypeSchema,
  name: z.string().min(2, "Mínimo 2 caracteres").max(200),
  description: z.string().max(2000).optional(),
  date: z.string().min(1, "Requerido"),
  endDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type ClinicalEventFormData = z.infer<typeof clinicalEventFormSchema>;

export const familyHistoryFormSchema = z.object({
  relationship: FamilyRelationshipSchema,
  condition: ConditionSchema,
  diagnosisAge: z.coerce.number().int().min(0).max(120).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

export type FamilyHistoryFormData = z.infer<typeof familyHistoryFormSchema>;

export const personalHistoryFormSchema = z.object({
  condition: PersonalConditionSchema,
  diagnosisDate: z.string().optional(),
  status: z.string().min(1, "Requerido").default("activo"),
  treatingPhysician: z.string().max(200).optional(),
  treatment: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export type PersonalHistoryFormData = z.infer<typeof personalHistoryFormSchema>;

export const habitFormSchema = z.object({
  category: HabitCategorySchema,
  status: z.string().min(1, "Requerido"),
  frequency: z.string().max(200).optional(),
  quantity: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export type HabitFormData = z.infer<typeof habitFormSchema>;

export const physicalActivityFormSchema = z.object({
  type: ActivityTypeSchema,
  frequencyPerWeek: z.coerce.number().int().min(0).max(14),
  durationMinutes: z.coerce.number().int().min(1).max(600),
  intensity: BorgIntensitySchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type PhysicalActivityFormData = z.infer<typeof physicalActivityFormSchema>;

export const dietHistoryFormSchema = z.object({
  dietType: DietTypeSchema,
  mealsPerDay: z.coerce.number().int().min(1).max(20),
  mealSchedule: z.string().max(500).optional(),
  mealPlace: MealPlaceSchema.optional(),
  mealPreparer: z.string().max(200).optional(),
  timeAvailable: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  kitchenEquipment: z.string().max(500).optional(),
  previousDiets: z.string().max(1000).optional(),
  labelReading: z.boolean().optional(),
  nutritionalKnowledge: z.string().max(500).optional(),
  preferences: z.string().max(1000).optional(),
  aversions: z.string().max(1000).optional(),
  chewing: z.string().max(500).optional(),
  workSchedule: z.string().max(500).optional(),
  householdPeople: z.coerce.number().int().min(1).max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export type DietHistoryFormData = z.infer<typeof dietHistoryFormSchema>;

export const intoleranceFormSchema = z.object({
  food: z.string().min(2, "Mínimo 2 caracteres").max(200),
  symptom: z.string().min(2, "Mínimo 2 caracteres").max(500),
  severity: IntoleranceSeveritySchema,
  thresholdDose: z.string().max(100).optional(),
  mechanism: MechanismSchema,
  notes: z.string().max(1000).optional(),
});

export type IntoleranceFormData = z.infer<typeof intoleranceFormSchema>;

export const surgeryFormSchema = z.object({
  type: SurgeryTypeSchema,
  date: z.string().min(1, "Requerido"),
  hospital: z.string().max(200).optional(),
  complications: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type SurgeryFormData = z.infer<typeof surgeryFormSchema>;

export const hospitalizationFormSchema = z.object({
  reason: z.string().min(2, "Mínimo 2 caracteres").max(500),
  admissionDate: z.string().min(1, "Requerido"),
  dischargeDate: z.string().optional(),
  stayDays: z.coerce.number().int().min(0).max(365).optional(),
  hospital: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});
export type HospitalizationFormData = z.infer<typeof hospitalizationFormSchema>;

export const supplementFormSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(200),
  brand: z.string().max(200).optional(),
  category: SupplementCategorySchema.optional(),
  composition: z.string().max(500).optional(),
  dose: z.string().max(100).optional(),
  frequency: z.string().max(200).optional(),
  prescribedBy: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
export type SupplementFormData = z.infer<typeof supplementFormSchema>;

export const foodFrequencyFormSchema = z.object({
  foodGroupId: z.string().min(1, "Requerido"),
  foodGroupName: z.string().max(200).optional(),
  frequency: FrequencyValueSchema,
  quantity: z.string().max(100).optional(),
  preparation: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type FoodFrequencyFormData = z.infer<typeof foodFrequencyFormSchema>;

export const giSymptomFormSchema = z.object({
  symptomType: GiSymptomTypeSchema,
  description: z.string().max(500).optional(),
  frequency: z.string().max(200).optional(),
  severity: z.coerce.number().int().min(1).max(10).optional(),
  foodRelation: z.string().max(500).optional(),
  onsetDate: z.string().optional(),
  triggers: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});
export type GiSymptomFormData = z.infer<typeof giSymptomFormSchema>;
