import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Bandage,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleEllipsis,
  Clock3,
  CloudUpload,
  createLucideIcon,
  Droplet,
  FolderOpen,
  Flame,
  Frown,
  Heart,
  HeartPulse,
  Info,
  Mail,
  MessageCircle,
  MessageCircleOff,
  Pill,
  PillBottle,
  Phone,
  Plus,
  Salad,
  Save,
  ShieldCheck,
  Stethoscope,
  Tags,
  Toilet,
  Trash2,
  UserRound,
  UsersRound,
  Utensils,
  Waves,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type FieldError,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { PageContent, PageHeader } from "@app/layout/AppLayout";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import { Button } from "@components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { useUnsavedChangesGuard } from "@hooks/useUnsavedChangesGuard";
import {
  Email,
  EmailSchema,
  Phone as PhoneVO,
  PhoneSchema,
} from "@modules/patient/domain/Contact";
import type {
  Patient,
  PatientAlcoholFrequency,
  PatientAppetiteLevel,
  PatientCoffeeTeaFrequency,
  PatientConditionStatus,
  PatientCravingTime,
  PatientDigestiveSymptom,
  PatientEatingOutFrequency,
  PatientMealLocation,
  PatientMealPreparer,
  PatientMedicationAllergyDetail,
  PatientMedicationFrequency,
  PatientMealDuration,
  PatientMealScheduleVariation,
  PatientOtherBeverage,
  PatientSkippedMeal,
  PatientSpecialEatingPreference,
  PatientSugaryDrinkFrequency,
  PatientSymptomTiming,
  PatientUsualDietType,
  PatientWaterIntake,
} from "@modules/patient/domain/Patient";
import { SexSchema, type Sex } from "@modules/patient/domain/Sex";
import { patientService } from "@services/patientService";
import { useAuthStore } from "@store/authStore";
import "./NewPatientWizard.css";

const MedicalClipboardIcon = createLucideIcon("MedicalClipboard", [
  [
    "rect",
    { width: "14", height: "18", x: "5", y: "4", rx: "2", key: "clipboard" },
  ],
  ["path", { d: "M9 4V2h6v2", key: "clip" }],
  ["path", { d: "M8 13h2l1.5-3 2.5 6 1.5-3H18", key: "pulse" }],
]);

const FamilyGroupIcon = createLucideIcon("FamilyGroup", [
  ["circle", { cx: "12", cy: "7", r: "3", key: "center-head" }],
  ["circle", { cx: "5", cy: "9", r: "2", key: "left-head" }],
  ["circle", { cx: "19", cy: "9", r: "2", key: "right-head" }],
  ["path", { d: "M6 20v-1a6 6 0 0 1 12 0v1", key: "center-body" }],
  ["path", { d: "M2 20v-.5A4.5 4.5 0 0 1 6.5 15", key: "left-body" }],
  ["path", { d: "M22 20v-.5a4.5 4.5 0 0 0-4.5-4.5", key: "right-body" }],
]);

const RunningIcon = createLucideIcon("Running", [
  ["circle", { cx: "14", cy: "4", r: "2", key: "head" }],
  ["path", { d: "m13 7-3 4 3 2 2 4 3 4", key: "body" }],
  ["path", { d: "m10 11-3 3-3-1", key: "back-arm" }],
  ["path", { d: "m12 8 4 3 4-1", key: "front-arm" }],
  ["path", { d: "m13 13-4 3-2 5", key: "back-leg" }],
]);

const DigestiveStomachIcon = createLucideIcon("DigestiveStomach", [
  [
    "path",
    {
      d: "M7.5 2.5v3.2c0 1.7 1 3.2 2.6 3.9 1.5.6 2.3 2.3 1.8 3.8-.5 1.4-1.8 2.3-3.3 2.3H7.1c-2.2 0-4 1.8-4 4v1.8",
      key: "stomach-inner",
    },
  ],
  [
    "path",
    {
      d: "M10.8 2.5c.5 1.3 1.5 2.4 2.8 3l1.4.7a6 6 0 0 1 3.5 5.5v.8A6.5 6.5 0 0 1 12 19c-1.3 0-2.6-.4-3.7-1.2",
      key: "stomach-body",
    },
  ],
  [
    "path",
    {
      d: "M6 21.5v-1.7c0-.9.7-1.6 1.6-1.6h.7",
      key: "stomach-outlet",
    },
  ],
]);

const GasSymptomIcon = createLucideIcon("GasSymptom", [
  ["circle", { cx: "7", cy: "8", r: "2", key: "bubble-left" }],
  ["circle", { cx: "15.5", cy: "6.5", r: "1.5", key: "bubble-top" }],
  ["circle", { cx: "14", cy: "15", r: "2.5", key: "bubble-bottom" }],
  ["path", { d: "M3 15h4m11-3h3", key: "motion" }],
]);

const BloatingSymptomIcon = createLucideIcon("BloatingSymptom", [
  [
    "path",
    {
      d: "M8 4v3c0 1.4-2 2.2-2 5v3a6 6 0 0 0 12 0v-3c0-2.8-2-3.6-2-5V4",
      key: "torso",
    },
  ],
  ["path", { d: "M8 11c2 1.3 6 1.3 8 0M9 16h6", key: "swelling" }],
]);

const VomitingSymptomIcon = createLucideIcon("VomitingSymptom", [
  ["circle", { cx: "10", cy: "9", r: "5", key: "face" }],
  ["path", { d: "M8 8h.01M12 8h.01M8 11h4", key: "features" }],
  ["path", { d: "M15 12c3 .5 4 2.2 4 5m-4-2h5m-4 3h4", key: "sickness" }],
]);

const AbdominalPainSymptomIcon = createLucideIcon("AbdominalPainSymptom", [
  ["circle", { cx: "12", cy: "4", r: "2", key: "head" }],
  ["path", { d: "M8 22v-5l-2-3 2-7m8 15v-5l2-3-2-7", key: "body" }],
  ["path", { d: "M9.5 12h5m-2.5-2.5v5", key: "pain" }],
]);

const KidneyIcon = createLucideIcon("Kidney", [
  [
    "path",
    {
      d: "M9.986 6c.157-1.406-.982-3-3.415-3C4.047 3 2 5.462 2 8.5S3.539 14 6.064 14c1.616 0 2.472-1.254 2.292-2.341",
      key: "left-kidney",
    },
  ],
  [
    "path",
    {
      d: "M7 8c1.5 0 3.5.496 3.5 3.64 0 4.16-2 5.72-.5 9.36",
      key: "left-ureter",
    },
  ],
  [
    "path",
    {
      d: "M17 8c-1.5 0-3.5.496-3.5 3.64 0 4.16 2 5.72.5 9.36",
      key: "right-ureter",
    },
  ],
  [
    "path",
    {
      d: "M6.61 6c.204.571.55 1.943.306 2.857C6.814 9.238 6.488 10 6 10",
      key: "left-hilum",
    },
  ],
  [
    "path",
    {
      d: "M14.014 6c-.157-1.406.982-3 3.415-3C19.953 3 22 5.462 22 8.5S20.461 14 17.936 14c-1.695 0-2.554-1.38-2.258-2.5",
      key: "right-kidney",
    },
  ],
  [
    "path",
    {
      d: "M17.39 6c-.204.571-.55 1.943-.306 2.857.102.381.428 1.143.916 1.143",
      key: "right-hilum",
    },
  ],
]);

const ThyroidIcon = createLucideIcon("Thyroid", [
  [
    "path",
    {
      d: "M12 18.176a3 3 0 1 1-4.953-2.449l-.025.023A4.502 4.502 0 0 1 8.505 7c1.414 0 2.675.652 3.5 1.671a4.5 4.5 0 1 1 4.983 7.079A3 3 0 1 1 12.005 18Z",
      key: "lobes",
    },
  ],
  ["path", { d: "M12 19V9", key: "isthmus" }],
  ["path", { d: "m9 3 3 2 3-2", key: "upper-lobes" }],
]);

const SupplementBottleIcon = createLucideIcon("SupplementBottle", [
  ["path", { d: "M5.5 4.5v-2h6v2", key: "cap" }],
  [
    "rect",
    {
      x: "3.5",
      y: "4.5",
      width: "10",
      height: "15.5",
      rx: "2.25",
      key: "bottle",
    },
  ],
  ["path", { d: "M3.5 8h10", key: "shoulder" }],
  [
    "rect",
    { x: "5.5", y: "10", width: "6", height: "5", rx: ".8", key: "label" },
  ],
  ["path", { d: "M7 12.5h3", key: "label-line" }],
  [
    "path",
    {
      d: "m15.3 15.5 2.9-2.9a2.15 2.15 0 0 1 3.05 3.05l-2.9 2.9a2.15 2.15 0 0 1-3.05-3.05Z",
      key: "capsule",
    },
  ],
  ["path", { d: "m17.15 13.65 3.05 3.05", key: "capsule-line" }],
  ["circle", { cx: "18.5", cy: "21", r: "1.65", key: "tablet" }],
  ["path", { d: "M17.35 21h2.3", key: "tablet-line" }],
]);

const MedicationAllergyIcon = createLucideIcon("MedicationAllergy", [
  ["path", { d: "M5.5 4.5v-2h6v2", key: "cap" }],
  [
    "rect",
    {
      x: "3.5",
      y: "4.5",
      width: "10",
      height: "15.5",
      rx: "2.25",
      key: "bottle",
    },
  ],
  ["path", { d: "M3.5 8h10", key: "shoulder" }],
  [
    "rect",
    { x: "5.5", y: "10", width: "6", height: "5", rx: ".8", key: "label" },
  ],
  ["path", { d: "M8.5 11.25v2.5M7.25 12.5h2.5", key: "cross" }],
  ["path", { d: "m17.5 9.5 5 9h-10Z", key: "warning" }],
  ["path", { d: "M17.5 13v2.25m0 1.6h.01", key: "alert" }],
]);

const PrescriptionIcon = createLucideIcon("Prescription", [
  ["path", { d: "M3.5 2.5h7.5l3 3V21H3.5Z", key: "page" }],
  ["path", { d: "M11 2.5V6h3", key: "fold" }],
  [
    "path",
    { d: "M6.25 9h2a1.65 1.65 0 0 1 0 3.3h-2V9Zm1.8 3.3 2.2 3", key: "rx-r" },
  ],
  ["path", { d: "m7 16 3-3m-3 0 3 3", key: "rx-x" }],
  ["path", { d: "M16.25 8h5v2h-5Z", key: "bottle-cap" }],
  [
    "rect",
    { x: "15.25", y: "10", width: "7", height: "11", rx: "2", key: "bottle" },
  ],
  ["path", { d: "M17 14.25h3.5m-1.75-1.75V16", key: "bottle-cross" }],
  ["path", { d: "M17.25 18.5h3", key: "bottle-label" }],
]);

const AdverseAlertIcon = createLucideIcon("AdverseAlert", [
  ["path", { d: "M12 2.5 22 20.5H2Z", key: "triangle" }],
  ["path", { d: "M12 8.25v6.25", key: "alert-line" }],
  ["circle", { cx: "12", cy: "17.25", r: ".7", key: "alert-dot" }],
]);

const FAMILY_RELATIONSHIP_VALUES = [
  "none",
  "mother",
  "father",
  "maternalGrandparents",
  "paternalGrandparents",
  "siblings",
] as const;

type FamilyRelationship = (typeof FAMILY_RELATIONSHIP_VALUES)[number];

const familySelectionSchema = z.array(z.enum(FAMILY_RELATIONSHIP_VALUES));

const requiredBinaryAnswer = z
  .enum(["yes", "no", ""])
  .refine((value): boolean => value !== "", "Selecciona una opción");

const clinicalDetailText = z.string().trim().max(500, "Máximo 500 caracteres");
const optionalClinicalYear = z.string().trim().max(4, "Ingresa un año válido");
const isValidOptionalClinicalYear = (value: string): boolean => {
  if (!value) return true;
  const year = Number(value);
  return (
    /^\d{4}$/.test(value) && year >= 1900 && year <= new Date().getFullYear()
  );
};

const diagnosedConditionDetailSchema = z.object({
  diagnosis: clinicalDetailText,
  diagnosisYear: optionalClinicalYear,
  status: z.enum(["", "active", "controlled", "resolved"]),
  treatment: clinicalDetailText,
});

const previousSurgeryDetailSchema = z.object({
  procedure: clinicalDetailText,
  year: optionalClinicalYear,
  reason: clinicalDetailText,
});

const currentTreatmentDetailSchema = z.object({
  name: clinicalDetailText,
  reason: clinicalDetailText,
  frequency: clinicalDetailText,
  professional: clinicalDetailText,
});

const intoleranceDetailSchema = z.object({
  substance: clinicalDetailText,
  reaction: clinicalDetailText,
  severity: z.enum(["", "mild", "moderate", "severe"]),
});

const supplementDetailSchema = z.object({
  name: clinicalDetailText,
  dose: clinicalDetailText,
  frequency: z.enum(["", "daily", "twiceDaily", "weekly", "asNeeded", "other"]),
  objective: clinicalDetailText,
});

const medicationAllergyDetailSchema = z.object({
  medication: clinicalDetailText,
  reaction: clinicalDetailText,
  severity: z.enum(["", "mild", "moderate", "severe"]),
  requiredMedicalAttention: z.enum(["", "yes", "no"]),
});

const dailyMedicationDetailSchema = z.object({
  name: clinicalDetailText,
  dose: clinicalDetailText,
  frequency: z.enum(["", "daily", "twiceDaily", "weekly", "asNeeded", "other"]),
  schedule: clinicalDetailText,
  reason: clinicalDetailText,
  prescribedByProfessional: z.enum(["", "yes", "no"]),
});

const mealTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona un horario");
const optionalMealTimeSchema = z
  .string()
  .refine(
    (value): boolean => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
    "Selecciona un horario válido",
  );

const NewPatientWizardSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(100, "Máximo 100 caracteres"),
    lastName: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(100, "Máximo 100 caracteres"),
    secondLastName: z.string().trim().max(100).optional().or(z.literal("")),
    age: z
      .string()
      .trim()
      .min(1, "Requerido")
      .refine((value) => /^\d{1,3}$/.test(value), "Ingresa una edad válida")
      .refine((value) => Number(value) <= 125, "La edad máxima es 125 años"),
    sex: z
      .union([SexSchema, z.literal("")])
      .refine((value): boolean => value !== "", "Requerido"),
    occupation: z
      .string()
      .trim()
      .max(200, "Máximo 200 caracteres")
      .optional()
      .or(z.literal("")),
    email: requiredContact(EmailSchema, "Correo electrónico inválido"),
    phone: requiredContact(PhoneSchema, "Teléfono inválido"),
    secondaryPhone: optionalContact(PhoneSchema, "Teléfono inválido"),
    whatsappEnabled: z.enum(["yes", "no"]),
    emergencyContactName: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(200, "Máximo 200 caracteres"),
    emergencyContactRelationship: z
      .string()
      .trim()
      .min(1, "Requerido")
      .max(100, "Máximo 100 caracteres"),
    emergencyContactPhone: requiredContact(PhoneSchema, "Teléfono inválido"),
    externalRecordNumber: z
      .string()
      .trim()
      .min(1, "Requerido")
      .max(100, "Máximo 100 caracteres"),
    admissionReason: z
      .string()
      .trim()
      .min(5, "Mínimo 5 caracteres")
      .max(500, "Máximo 500 caracteres"),
    photoUrl: z.string().max(7_000_000, "La imagen no puede superar 5 MB"),
    diagnosedConditions: requiredBinaryAnswer,
    previousSurgeries: requiredBinaryAnswer,
    currentTreatments: requiredBinaryAnswer,
    intolerances: requiredBinaryAnswer,
    diagnosedConditionDetails: z.array(diagnosedConditionDetailSchema).max(12),
    previousSurgeryDetails: z.array(previousSurgeryDetailSchema).max(12),
    currentTreatmentDetails: z.array(currentTreatmentDetailSchema).max(12),
    intoleranceDetails: z.array(intoleranceDetailSchema).max(12),
    familyHistoryMode: z
      .enum(["", "none", "unknown", "recorded"])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    familyDiabetes: familySelectionSchema,
    familyHypertension: familySelectionSchema,
    familyObesity: familySelectionSchema,
    familyCardiovascular: familySelectionSchema,
    familyDyslipidemia: familySelectionSchema,
    familyKidneyDisease: familySelectionSchema,
    familyThyroidDisease: familySelectionSchema,
    familyOtherConditions: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("")),
    familyHistoryNotes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .or(z.literal("")),
    medications: requiredBinaryAnswer,
    supplements: requiredBinaryAnswer,
    medicationAllergies: requiredBinaryAnswer,
    adverseMedicationOrSupplementEffects: requiredBinaryAnswer,
    supplementDetails: z.array(supplementDetailSchema).max(12),
    medicationAllergyDetails: z.array(medicationAllergyDetailSchema).max(12),
    dailyMedicationDetails: z.array(dailyMedicationDetailSchema).max(12),
    adverseEffectDetails: z.string().trim().max(1000, "Máximo 1000 caracteres"),
    breakfastTime: mealTimeSchema,
    mainMealTime: mealTimeSchema,
    dinnerTime: mealTimeSchema,
    snackTimes: z.array(z.object({ time: optionalMealTimeSchema })).max(4),
    mealsPerDay: z
      .enum(["", "1", "2", "3", "4", "5", "6", "7", "8"])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    skipsMeals: requiredBinaryAnswer,
    mostSkippedMeal: z.enum(["", "breakfast", "mainMeal", "dinner", "snack"]),
    scheduleVaries: requiredBinaryAnswer,
    scheduleVariation: z.enum([
      "",
      "weekendsLater",
      "weekendsEarlier",
      "workdays",
      "rotatingShifts",
      "irregular",
    ]),
    mealDuration: z.enum([
      "",
      "lessThan15",
      "15To20",
      "20To30",
      "30To45",
      "moreThan45",
    ]),
    eatingOutFrequency: z
      .enum([
        "",
        "never",
        "rarely",
        "oneToTwoPerWeek",
        "threeToFourPerWeek",
        "daily",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    snacksBetweenMeals: requiredBinaryAnswer,
    eatsLateAtNight: requiredBinaryAnswer,
    frequentCravings: requiredBinaryAnswer,
    cravingTime: z.enum([
      "",
      "morning",
      "afternoon",
      "evening",
      "night",
      "variable",
    ]),
    mealPreparer: z
      .enum([
        "",
        "self",
        "partner",
        "family",
        "householdHelp",
        "preparedFood",
        "varies",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    primaryMealLocation: z.enum([
      "",
      "home",
      "work",
      "school",
      "restaurant",
      "street",
      "varies",
    ]),
    usualDietType: z
      .enum([
        "",
        "omnivore",
        "vegetarian",
        "vegan",
        "pescatarian",
        "mediterranean",
        "lowCarb",
        "other",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    otherDietDescription: z.string().trim().max(500, "Máximo 500 caracteres"),
    avoidsFoods: requiredBinaryAnswer,
    avoidedFoods: z.string().trim().max(500, "Máximo 500 caracteres"),
    followsFoodRestrictions: requiredBinaryAnswer,
    foodRestrictionDetails: z.string().trim().max(500, "Máximo 500 caracteres"),
    hasFoodDiscomfort: requiredBinaryAnswer,
    discomfortFoods: z.string().trim().max(500, "Máximo 500 caracteres"),
    specialEatingPreference: z
      .enum([
        "",
        "none",
        "lowSodium",
        "lowSugar",
        "lowFat",
        "softTextures",
        "temperatureSensitive",
        "other",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    foodPreferenceNotes: z.string().trim().max(1000, "Máximo 1000 caracteres"),
    waterIntake: z
      .enum([
        "",
        "lessThanOneLiter",
        "oneToOneAndHalfLiters",
        "oneAndHalfToTwoLiters",
        "twoToThreeLiters",
        "moreThanThreeLiters",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    drinksWaterThroughoutDay: requiredBinaryAnswer,
    carriesWaterBottle: requiredBinaryAnswer,
    coffeeTeaFrequency: z
      .enum([
        "",
        "never",
        "occasional",
        "onePerDay",
        "oneToTwoPerDay",
        "threeOrMorePerDay",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    sugaryDrinkFrequency: z
      .enum([
        "",
        "never",
        "oneToTwoPerWeek",
        "threeToFourPerWeek",
        "daily",
        "multiplePerDay",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    consumesEnergyDrinks: requiredBinaryAnswer,
    otherBeverage: z
      .enum([
        "",
        "none",
        "infusions",
        "flavoredWater",
        "juice",
        "sportsDrinks",
        "other",
      ])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    alcoholFrequency: z.enum([
      "",
      "never",
      "monthlyOrLess",
      "twoToFourPerMonth",
      "twoToThreePerWeek",
      "fourOrMorePerWeek",
    ]),
    hydrationNotes: z.string().trim().max(1000, "Máximo 1000 caracteres"),
    appetiteLevel: z
      .enum(["", "low", "normal", "high", "variable"])
      .refine((value): boolean => value !== "", "Selecciona una opción"),
    earlySatiety: requiredBinaryAnswer,
    hasDigestiveDiscomfort: requiredBinaryAnswer,
    digestiveSymptoms: z
      .array(
        z.enum([
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
        ]),
      )
      .max(12),
    otherDigestiveSymptom: z.string().trim().max(500, "Máximo 500 caracteres"),
    symptomTiming: z.enum([
      "",
      "duringMeals",
      "afterMeals",
      "morning",
      "night",
      "variable",
    ]),
    digestiveNotes: z.string().trim().max(1000, "Máximo 1000 caracteres"),
    physicalActivity: requiredBinaryAnswer,
    clinicalTags: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
    generalNotes: z
      .string()
      .trim()
      .max(2000, "Máximo 2000 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((values, context) => {
    const requireDetail = (value: string, path: Array<string | number>) => {
      if (value.trim().length < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: "Completa este dato",
        });
      }
    };
    const validateOptionalYear = (
      value: string,
      path: Array<string | number>,
    ) => {
      if (!isValidOptionalClinicalYear(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: "Ingresa un año válido",
        });
      }
    };

    if (values.diagnosedConditions === "yes") {
      values.diagnosedConditionDetails.forEach((detail, index) => {
        requireDetail(detail.diagnosis, [
          "diagnosedConditionDetails",
          index,
          "diagnosis",
        ]);
        requireDetail(detail.status, [
          "diagnosedConditionDetails",
          index,
          "status",
        ]);
        validateOptionalYear(detail.diagnosisYear, [
          "diagnosedConditionDetails",
          index,
          "diagnosisYear",
        ]);
      });
    }
    if (values.previousSurgeries === "yes") {
      values.previousSurgeryDetails.forEach((detail, index) => {
        requireDetail(detail.procedure, [
          "previousSurgeryDetails",
          index,
          "procedure",
        ]);
        validateOptionalYear(detail.year, [
          "previousSurgeryDetails",
          index,
          "year",
        ]);
      });
    }
    if (values.currentTreatments === "yes") {
      values.currentTreatmentDetails.forEach((detail, index) => {
        requireDetail(detail.name, ["currentTreatmentDetails", index, "name"]);
        requireDetail(detail.reason, [
          "currentTreatmentDetails",
          index,
          "reason",
        ]);
        requireDetail(detail.frequency, [
          "currentTreatmentDetails",
          index,
          "frequency",
        ]);
      });
    }
    if (values.intolerances === "yes") {
      values.intoleranceDetails.forEach((detail, index) => {
        requireDetail(detail.substance, [
          "intoleranceDetails",
          index,
          "substance",
        ]);
        requireDetail(detail.reaction, [
          "intoleranceDetails",
          index,
          "reaction",
        ]);
        requireDetail(detail.severity, [
          "intoleranceDetails",
          index,
          "severity",
        ]);
      });
    }
    if (values.familyHistoryMode === "recorded") {
      const familyFields = [
        "familyDiabetes",
        "familyHypertension",
        "familyObesity",
        "familyCardiovascular",
        "familyDyslipidemia",
        "familyKidneyDisease",
        "familyThyroidDisease",
      ] as const;
      familyFields.forEach((field) => {
        if (values[field].length === 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: "Selecciona familiares o Ninguno",
          });
        }
      });
    }

    if (values.supplements === "yes") {
      values.supplementDetails.forEach((detail, index) => {
        requireDetail(detail.name, ["supplementDetails", index, "name"]);
        requireDetail(detail.dose, ["supplementDetails", index, "dose"]);
        requireDetail(detail.frequency, [
          "supplementDetails",
          index,
          "frequency",
        ]);
        requireDetail(detail.objective, [
          "supplementDetails",
          index,
          "objective",
        ]);
      });
    }
    if (values.medicationAllergies === "yes") {
      values.medicationAllergyDetails.forEach((detail, index) => {
        requireDetail(detail.medication, [
          "medicationAllergyDetails",
          index,
          "medication",
        ]);
        requireDetail(detail.reaction, [
          "medicationAllergyDetails",
          index,
          "reaction",
        ]);
        requireDetail(detail.severity, [
          "medicationAllergyDetails",
          index,
          "severity",
        ]);
        requireDetail(detail.requiredMedicalAttention, [
          "medicationAllergyDetails",
          index,
          "requiredMedicalAttention",
        ]);
      });
    }
    if (values.medications === "yes") {
      values.dailyMedicationDetails.forEach((detail, index) => {
        requireDetail(detail.name, ["dailyMedicationDetails", index, "name"]);
        requireDetail(detail.dose, ["dailyMedicationDetails", index, "dose"]);
        requireDetail(detail.frequency, [
          "dailyMedicationDetails",
          index,
          "frequency",
        ]);
        requireDetail(detail.schedule, [
          "dailyMedicationDetails",
          index,
          "schedule",
        ]);
        requireDetail(detail.reason, [
          "dailyMedicationDetails",
          index,
          "reason",
        ]);
        requireDetail(detail.prescribedByProfessional, [
          "dailyMedicationDetails",
          index,
          "prescribedByProfessional",
        ]);
      });
    }
    if (values.adverseMedicationOrSupplementEffects === "yes") {
      requireDetail(values.adverseEffectDetails, ["adverseEffectDetails"]);
    }
    if (values.skipsMeals === "yes") {
      requireDetail(values.mostSkippedMeal, ["mostSkippedMeal"]);
    }
    if (values.scheduleVaries === "yes") {
      requireDetail(values.scheduleVariation, ["scheduleVariation"]);
    }
    requireDetail(values.mealDuration, ["mealDuration"]);
    if (values.frequentCravings === "yes") {
      requireDetail(values.cravingTime, ["cravingTime"]);
    }
    if (values.usualDietType === "other") {
      requireDetail(values.otherDietDescription, ["otherDietDescription"]);
    }
    if (values.avoidsFoods === "yes") {
      requireDetail(values.avoidedFoods, ["avoidedFoods"]);
    }
    if (values.followsFoodRestrictions === "yes") {
      requireDetail(values.foodRestrictionDetails, ["foodRestrictionDetails"]);
    }
    if (values.hasFoodDiscomfort === "yes") {
      requireDetail(values.discomfortFoods, ["discomfortFoods"]);
    }
    if (values.hasDigestiveDiscomfort === "yes") {
      if (values.digestiveSymptoms.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["digestiveSymptoms"],
          message: "Selecciona al menos un síntoma",
        });
      }
      if (values.digestiveSymptoms.includes("other")) {
        requireDetail(values.otherDigestiveSymptom, ["otherDigestiveSymptom"]);
      }
      requireDetail(values.symptomTiming, ["symptomTiming"]);
    }
  });

type NewPatientWizardValues = z.infer<typeof NewPatientWizardSchema>;

interface NewPatientWizardProps {
  onCreated?: (patient: Patient) => void;
}

interface WizardStep {
  title: string;
  cardTitle?: string;
  description: string;
  cardDescription: string;
  icon: LucideIcon;
  fields: Path<NewPatientWizardValues>[];
}

const DEFAULT_VALUES: NewPatientWizardValues = {
  firstName: "",
  lastName: "",
  secondLastName: "",
  age: "",
  sex: "",
  occupation: "",
  email: "",
  phone: "",
  secondaryPhone: "",
  whatsappEnabled: "yes",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  externalRecordNumber: "",
  admissionReason: "",
  photoUrl: "",
  diagnosedConditions: "",
  previousSurgeries: "",
  currentTreatments: "",
  intolerances: "",
  diagnosedConditionDetails: [
    { diagnosis: "", diagnosisYear: "", status: "", treatment: "" },
  ],
  previousSurgeryDetails: [{ procedure: "", year: "", reason: "" }],
  currentTreatmentDetails: [
    { name: "", reason: "", frequency: "", professional: "" },
  ],
  intoleranceDetails: [{ substance: "", reaction: "", severity: "" }],
  familyHistoryMode: "",
  familyDiabetes: [],
  familyHypertension: [],
  familyObesity: [],
  familyCardiovascular: [],
  familyDyslipidemia: [],
  familyKidneyDisease: [],
  familyThyroidDisease: [],
  familyOtherConditions: "",
  familyHistoryNotes: "",
  medications: "",
  supplements: "",
  medicationAllergies: "",
  adverseMedicationOrSupplementEffects: "",
  supplementDetails: [{ name: "", dose: "", frequency: "", objective: "" }],
  medicationAllergyDetails: [
    {
      medication: "",
      reaction: "",
      severity: "",
      requiredMedicalAttention: "",
    },
  ],
  dailyMedicationDetails: [
    {
      name: "",
      dose: "",
      frequency: "",
      schedule: "",
      reason: "",
      prescribedByProfessional: "",
    },
  ],
  adverseEffectDetails: "",
  breakfastTime: "",
  mainMealTime: "",
  dinnerTime: "",
  snackTimes: [{ time: "" }],
  mealsPerDay: "",
  skipsMeals: "",
  mostSkippedMeal: "",
  scheduleVaries: "",
  scheduleVariation: "",
  mealDuration: "",
  eatingOutFrequency: "",
  snacksBetweenMeals: "",
  eatsLateAtNight: "",
  frequentCravings: "",
  cravingTime: "",
  mealPreparer: "",
  primaryMealLocation: "",
  usualDietType: "",
  otherDietDescription: "",
  avoidsFoods: "",
  avoidedFoods: "",
  followsFoodRestrictions: "",
  foodRestrictionDetails: "",
  hasFoodDiscomfort: "",
  discomfortFoods: "",
  specialEatingPreference: "",
  foodPreferenceNotes: "",
  waterIntake: "",
  drinksWaterThroughoutDay: "",
  carriesWaterBottle: "",
  coffeeTeaFrequency: "",
  sugaryDrinkFrequency: "",
  consumesEnergyDrinks: "",
  otherBeverage: "",
  alcoholFrequency: "",
  hydrationNotes: "",
  appetiteLevel: "",
  earlySatiety: "",
  hasDigestiveDiscomfort: "",
  digestiveSymptoms: [],
  otherDigestiveSymptom: "",
  symptomTiming: "",
  digestiveNotes: "",
  physicalActivity: "",
  clinicalTags: "",
  generalNotes: "",
};

const EMERGENCY_RELATIONSHIPS = [
  ["Madre", "mother"],
  ["Padre", "father"],
  ["Cónyuge", "spouse"],
  ["Pareja", "partner"],
  ["Hijo/a", "child"],
  ["Hermano/a", "sibling"],
  ["Tutor(a)", "guardian"],
  ["Otro", "other"],
] as const;

const MEDICATION_FREQUENCIES = [
  "daily",
  "twiceDaily",
  "weekly",
  "asNeeded",
  "other",
] as const;

const MEDICAL_SECTION_FIELDS = {
  personal: [
    "diagnosedConditions",
    "previousSurgeries",
    "currentTreatments",
    "intolerances",
    "diagnosedConditionDetails",
    "previousSurgeryDetails",
    "currentTreatmentDetails",
    "intoleranceDetails",
  ],
  family: [
    "familyHistoryMode",
    "familyDiabetes",
    "familyHypertension",
    "familyObesity",
    "familyCardiovascular",
    "familyDyslipidemia",
    "familyKidneyDisease",
    "familyThyroidDisease",
    "familyOtherConditions",
    "familyHistoryNotes",
  ],
  medications: [
    "supplements",
    "medicationAllergies",
    "medications",
    "adverseMedicationOrSupplementEffects",
    "supplementDetails",
    "medicationAllergyDetails",
    "dailyMedicationDetails",
    "adverseEffectDetails",
  ],
} satisfies Record<string, Path<NewPatientWizardValues>[]>;

const NUTRITION_ROUTINE_FIELDS = [
  "breakfastTime",
  "mainMealTime",
  "dinnerTime",
  "snackTimes",
  "mealsPerDay",
  "skipsMeals",
  "mostSkippedMeal",
  "scheduleVaries",
  "scheduleVariation",
  "mealDuration",
] satisfies Path<NewPatientWizardValues>[];

const NUTRITION_PATTERNS_FIELDS = [
  "eatingOutFrequency",
  "snacksBetweenMeals",
  "eatsLateAtNight",
  "frequentCravings",
  "cravingTime",
  "mealPreparer",
  "primaryMealLocation",
] satisfies Path<NewPatientWizardValues>[];

const NUTRITION_PREFERENCES_FIELDS = [
  "usualDietType",
  "otherDietDescription",
  "avoidsFoods",
  "avoidedFoods",
  "followsFoodRestrictions",
  "foodRestrictionDetails",
  "hasFoodDiscomfort",
  "discomfortFoods",
  "specialEatingPreference",
  "foodPreferenceNotes",
] satisfies Path<NewPatientWizardValues>[];

const NUTRITION_HYDRATION_FIELDS = [
  "waterIntake",
  "drinksWaterThroughoutDay",
  "carriesWaterBottle",
  "coffeeTeaFrequency",
  "sugaryDrinkFrequency",
  "consumesEnergyDrinks",
  "otherBeverage",
  "alcoholFrequency",
  "hydrationNotes",
] satisfies Path<NewPatientWizardValues>[];

const NUTRITION_DIGESTIVE_FIELDS = [
  "appetiteLevel",
  "earlySatiety",
  "hasDigestiveDiscomfort",
  "digestiveSymptoms",
  "otherDigestiveSymptom",
  "symptomTiming",
  "digestiveNotes",
] satisfies Path<NewPatientWizardValues>[];

type MedicalSection = keyof typeof MEDICAL_SECTION_FIELDS;
type NutritionSection =
  | "routine"
  | "patterns"
  | "preferences"
  | "hydration"
  | "digestive";

const NUTRITION_SECTION_FIELDS = {
  routine: NUTRITION_ROUTINE_FIELDS,
  patterns: NUTRITION_PATTERNS_FIELDS,
  preferences: NUTRITION_PREFERENCES_FIELDS,
  hydration: NUTRITION_HYDRATION_FIELDS,
  digestive: NUTRITION_DIGESTIVE_FIELDS,
} satisfies Record<NutritionSection, Path<NewPatientWizardValues>[]>;
type FamilyHistoryField =
  | "familyDiabetes"
  | "familyHypertension"
  | "familyObesity"
  | "familyCardiovascular"
  | "familyDyslipidemia"
  | "familyKidneyDisease"
  | "familyThyroidDisease";
type BinaryQuestionField =
  | "diagnosedConditions"
  | "previousSurgeries"
  | "currentTreatments"
  | "intolerances"
  | "medications"
  | "supplements"
  | "medicationAllergies"
  | "adverseMedicationOrSupplementEffects"
  | "physicalActivity";
type CollapsibleMedicalField =
  | "diagnosedConditions"
  | "previousSurgeries"
  | "currentTreatments"
  | "intolerances"
  | "supplements"
  | "medicationAllergies"
  | "medications"
  | "adverseMedicationOrSupplementEffects";

interface MissingOptionalMedicalInfo {
  id: string;
  label: string;
  section: MedicalSection;
  field: Path<NewPatientWizardValues>;
  card?: CollapsibleMedicalField;
}

export function NewPatientWizard({ onCreated }: NewPatientWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const allowsPreviewNavigation = import.meta.env.DEV;
  const user = useAuthStore((state) => state.user);
  const [step, setStep] = React.useState(0);
  const [medicalSection, setMedicalSection] =
    React.useState<MedicalSection>("personal");
  const [nutritionSection, setNutritionSection] =
    React.useState<NutritionSection>("routine");
  const [collapsedMedicalDetails, setCollapsedMedicalDetails] = React.useState<
    Record<CollapsibleMedicalField, boolean>
  >({
    diagnosedConditions: false,
    previousSurgeries: false,
    currentTreatments: false,
    intolerances: false,
    supplements: false,
    medicationAllergies: false,
    medications: false,
    adverseMedicationOrSupplementEffects: false,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [missingOptionalMedicalInfo, setMissingOptionalMedicalInfo] =
    React.useState<MissingOptionalMedicalInfo[]>([]);
  const [optionalMedicalInfoOpen, setOptionalMedicalInfoOpen] =
    React.useState(false);
  const [optionalMedicalInfoSkipped, setOptionalMedicalInfoSkipped] =
    React.useState(false);
  const [showContactNotice, setShowContactNotice] = React.useState(true);
  const [showClinicalNotice, setShowClinicalNotice] = React.useState(true);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [draggingPhoto, setDraggingPhoto] = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const submitLockRef = React.useRef(false);
  const medicalSections: Array<{
    id: MedicalSection;
    title: string;
    menuDescription: string;
    cardDescription: string;
    icon: LucideIcon;
  }> = [
    {
      id: "personal",
      title: t("patient.wizard.pathological_history_title"),
      menuDescription: t(
        "patient.wizard.pathological_history_menu_description",
      ),
      cardDescription: t("patient.wizard.pathological_history_description"),
      icon: MedicalClipboardIcon,
    },
    {
      id: "family",
      title: t("patient.wizard.family_history_title"),
      menuDescription: t("patient.wizard.family_history_menu_description"),
      cardDescription: t("patient.wizard.family_history_description"),
      icon: FamilyGroupIcon,
    },
    {
      id: "medications",
      title: t("patient.wizard.medications_supplements_title"),
      menuDescription: t("patient.wizard.medications_supplements_description"),
      cardDescription: t("patient.wizard.medications_supplements_description"),
      icon: Pill,
    },
  ];
  const nutritionSections: Array<{
    id: NutritionSection;
    title: string;
    menuDescription: string;
    cardDescription: string;
    icon: LucideIcon;
    implemented: boolean;
  }> = [
    {
      id: "routine",
      title: t("patient.wizard.nutrition_routine_title"),
      menuDescription: t("patient.wizard.nutrition_routine_menu_description"),
      cardDescription: t("patient.wizard.nutrition_routine_description"),
      icon: Clock3,
      implemented: true,
    },
    {
      id: "patterns",
      title: t("patient.wizard.nutrition_patterns_title"),
      menuDescription: t("patient.wizard.nutrition_patterns_menu_description"),
      cardDescription: t("patient.wizard.nutrition_patterns_menu_description"),
      icon: Utensils,
      implemented: true,
    },
    {
      id: "preferences",
      title: t("patient.wizard.nutrition_preferences_title"),
      menuDescription: t(
        "patient.wizard.nutrition_preferences_menu_description",
      ),
      cardDescription: t(
        "patient.wizard.nutrition_preferences_menu_description",
      ),
      icon: Salad,
      implemented: true,
    },
    {
      id: "hydration",
      title: t("patient.wizard.nutrition_hydration_title"),
      menuDescription: t("patient.wizard.nutrition_hydration_description"),
      cardDescription: t("patient.wizard.nutrition_hydration_description"),
      icon: Droplet,
      implemented: true,
    },
    {
      id: "digestive",
      title: t("patient.wizard.nutrition_digestive_title"),
      menuDescription: t("patient.wizard.nutrition_digestive_description"),
      cardDescription: t("patient.wizard.nutrition_digestive_description"),
      icon: DigestiveStomachIcon,
      implemented: true,
    },
  ];
  const activeMedicalSection =
    medicalSections.find((section) => section.id === medicalSection) ??
    medicalSections[0]!;
  const activeNutritionSection =
    nutritionSections.find((section) => section.id === nutritionSection) ??
    nutritionSections[0]!;
  const steps: WizardStep[] = [
    {
      title: t("patient.wizard.personal_short"),
      description: t("patient.wizard.personal_menu_description"),
      cardDescription: t("patient.wizard.personal_card_description"),
      icon: UserRound,
      fields: [
        "firstName",
        "lastName",
        "secondLastName",
        "age",
        "sex",
        "occupation",
      ],
    },
    {
      title: t("patient.wizard.contact_short"),
      cardTitle: t("patient.wizard.contact_title"),
      description: t("patient.wizard.contact_menu_description"),
      cardDescription: t("patient.contact_desc"),
      icon: Phone,
      fields: ["email", "phone", "secondaryPhone", "whatsappEnabled"],
    },
    {
      title: t("patient.wizard.emergency_short"),
      cardTitle: t("patient.wizard.emergency_title"),
      description: t("patient.wizard.emergency_menu_description"),
      cardDescription: t("patient.emergency_contact_desc"),
      icon: Heart,
      fields: [
        "emergencyContactName",
        "emergencyContactRelationship",
        "emergencyContactPhone",
      ],
    },
    {
      title: t("patient.wizard.clinical_record_short"),
      description: t("patient.wizard.clinical_record_menu_description"),
      cardDescription: t("patient.wizard.clinical_record_menu_description"),
      icon: FolderOpen,
      fields: ["externalRecordNumber", "admissionReason", "photoUrl"],
    },
    {
      title: t("patient.wizard.medical_history_short"),
      description: t("patient.wizard.medical_history_menu_description"),
      cardDescription: t("patient.wizard.medical_history_menu_description"),
      icon: HeartPulse,
      fields: [
        "diagnosedConditions",
        "previousSurgeries",
        "currentTreatments",
        "intolerances",
        "diagnosedConditionDetails",
        "previousSurgeryDetails",
        "currentTreatmentDetails",
        "intoleranceDetails",
        "familyHistoryMode",
        "familyDiabetes",
        "familyHypertension",
        "familyObesity",
        "familyCardiovascular",
        "familyDyslipidemia",
        "familyKidneyDisease",
        "familyThyroidDisease",
        "familyOtherConditions",
        "familyHistoryNotes",
        "medications",
        "supplements",
        "medicationAllergies",
        "adverseMedicationOrSupplementEffects",
        "supplementDetails",
        "medicationAllergyDetails",
        "dailyMedicationDetails",
        "adverseEffectDetails",
      ],
    },
    {
      title: t("patient.wizard.nutrition_short"),
      description: t("patient.wizard.nutrition_menu_description"),
      cardDescription: t("patient.wizard.nutrition_routine_description"),
      icon: Apple,
      fields: Object.values(NUTRITION_SECTION_FIELDS).flat(),
    },
    {
      title: t("patient.wizard.physical_activity_short"),
      description: t("patient.wizard.physical_activity_menu_description"),
      cardDescription: t("patient.wizard.physical_activity_description"),
      icon: RunningIcon,
      fields: ["physicalActivity"],
    },
    {
      title: t("patient.wizard.notes_short"),
      description: t("patient.wizard.notes_menu_description"),
      cardDescription: t("patient.wizard.notes_menu_description"),
      icon: Tags,
      fields: ["clinicalTags", "generalNotes"],
    },
  ];

  const {
    control,
    register,
    handleSubmit,
    trigger,
    reset,
    getValues,
    setFocus,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<NewPatientWizardValues>({
    resolver: zodResolver(NewPatientWizardSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const {
    fields: diagnosedConditionFields,
    append: appendDiagnosedCondition,
    remove: removeDiagnosedCondition,
  } = useFieldArray({ control, name: "diagnosedConditionDetails" });
  const {
    fields: previousSurgeryFields,
    append: appendPreviousSurgery,
    remove: removePreviousSurgery,
  } = useFieldArray({ control, name: "previousSurgeryDetails" });
  const {
    fields: currentTreatmentFields,
    append: appendCurrentTreatment,
    remove: removeCurrentTreatment,
  } = useFieldArray({ control, name: "currentTreatmentDetails" });
  const {
    fields: intoleranceFields,
    append: appendIntolerance,
    remove: removeIntolerance,
  } = useFieldArray({ control, name: "intoleranceDetails" });
  const {
    fields: supplementFields,
    append: appendSupplement,
    remove: removeSupplement,
  } = useFieldArray({ control, name: "supplementDetails" });
  const {
    fields: allergyFields,
    append: appendAllergy,
    remove: removeAllergy,
  } = useFieldArray({ control, name: "medicationAllergyDetails" });
  const {
    fields: dailyMedicationFields,
    append: appendDailyMedication,
    remove: removeDailyMedication,
  } = useFieldArray({ control, name: "dailyMedicationDetails" });
  const {
    fields: snackTimeFields,
    append: appendSnackTime,
    remove: removeSnackTime,
  } = useFieldArray({ control, name: "snackTimes" });
  const navigationBlocker = useUnsavedChangesGuard(
    isDirty && !submitting,
    t("common.unsaved_changes_warning"),
    { useNativeNavigationConfirm: false },
  );
  const whatsappEnabled = watch("whatsappEnabled");
  const photoUrl = watch("photoUrl");
  const diagnosedConditions = watch("diagnosedConditions");
  const previousSurgeries = watch("previousSurgeries");
  const currentTreatments = watch("currentTreatments");
  const intolerances = watch("intolerances");
  const diagnosedConditionDetailValues = watch("diagnosedConditionDetails");
  const previousSurgeryDetailValues = watch("previousSurgeryDetails");
  const currentTreatmentDetailValues = watch("currentTreatmentDetails");
  const intoleranceDetailValues = watch("intoleranceDetails");
  const familyHistoryMode = watch("familyHistoryMode");
  const supplements = watch("supplements");
  const medicationAllergies = watch("medicationAllergies");
  const medications = watch("medications");
  const adverseMedicationEffects = watch(
    "adverseMedicationOrSupplementEffects",
  );
  const supplementDetailValues = watch("supplementDetails");
  const allergyDetailValues = watch("medicationAllergyDetails");
  const dailyMedicationDetailValues = watch("dailyMedicationDetails");
  const adverseEffectDetailValue = watch("adverseEffectDetails");
  const skipsMeals = watch("skipsMeals");
  const scheduleVaries = watch("scheduleVaries");
  const frequentCravings = watch("frequentCravings");
  const usualDietType = watch("usualDietType");
  const avoidsFoods = watch("avoidsFoods");
  const followsFoodRestrictions = watch("followsFoodRestrictions");
  const hasFoodDiscomfort = watch("hasFoodDiscomfort");
  const hasDigestiveDiscomfort = watch("hasDigestiveDiscomfort");
  const digestiveSymptoms = watch("digestiveSymptoms");
  const diagnosedConditionDetailsComplete =
    diagnosedConditionDetailValues.length > 0 &&
    diagnosedConditionDetailValues.every(
      (detail) =>
        detail.diagnosis.trim() &&
        detail.status &&
        isValidOptionalClinicalYear(detail.diagnosisYear),
    );
  const previousSurgeryDetailsComplete =
    previousSurgeryDetailValues.length > 0 &&
    previousSurgeryDetailValues.every(
      (detail) =>
        detail.procedure.trim() && isValidOptionalClinicalYear(detail.year),
    );
  const currentTreatmentDetailsComplete =
    currentTreatmentDetailValues.length > 0 &&
    currentTreatmentDetailValues.every(
      (detail) =>
        detail.name.trim() && detail.reason.trim() && detail.frequency.trim(),
    );
  const intoleranceDetailsComplete =
    intoleranceDetailValues.length > 0 &&
    intoleranceDetailValues.every(
      (detail) =>
        detail.substance.trim() && detail.reaction.trim() && detail.severity,
    );
  const supplementDetailsComplete =
    supplementDetailValues.length > 0 &&
    supplementDetailValues.every(
      (detail) =>
        detail.name.trim() &&
        detail.dose.trim() &&
        detail.frequency &&
        detail.objective.trim(),
    );
  const allergyDetailsComplete =
    allergyDetailValues.length > 0 &&
    allergyDetailValues.every(
      (detail) =>
        detail.medication.trim() &&
        detail.reaction.trim() &&
        detail.severity &&
        detail.requiredMedicalAttention,
    );
  const dailyMedicationDetailsComplete =
    dailyMedicationDetailValues.length > 0 &&
    dailyMedicationDetailValues.every(
      (detail) =>
        detail.name.trim() &&
        detail.dose.trim() &&
        detail.frequency &&
        detail.schedule.trim() &&
        detail.reason.trim() &&
        detail.prescribedByProfessional,
    );
  const setMedicalDetailCollapsed = (
    field: CollapsibleMedicalField,
    collapsed: boolean,
  ) => {
    setCollapsedMedicalDetails((current) => ({
      ...current,
      [field]: collapsed,
    }));
  };
  const collectMissingOptionalMedicalInfo = (
    values: NewPatientWizardValues,
  ): MissingOptionalMedicalInfo[] => {
    const missing: MissingOptionalMedicalInfo[] = [];
    const add = (
      id: string,
      label: string,
      section: MedicalSection,
      field: Path<NewPatientWizardValues>,
      card?: CollapsibleMedicalField,
    ) => missing.push({ id, label, section, field, card });

    if (values.diagnosedConditions === "yes") {
      values.diagnosedConditionDetails.forEach((detail, index) => {
        if (!detail.diagnosisYear) {
          add(
            `condition-${index}-year`,
            t("patient.wizard.optional_condition_year", { number: index + 1 }),
            "personal",
            `diagnosedConditionDetails.${index}.diagnosisYear`,
            "diagnosedConditions",
          );
        }
        if (!detail.treatment.trim()) {
          add(
            `condition-${index}-treatment`,
            t("patient.wizard.optional_condition_treatment", {
              number: index + 1,
            }),
            "personal",
            `diagnosedConditionDetails.${index}.treatment`,
            "diagnosedConditions",
          );
        }
      });
    }
    if (values.previousSurgeries === "yes") {
      values.previousSurgeryDetails.forEach((detail, index) => {
        if (!detail.year) {
          add(
            `surgery-${index}-year`,
            t("patient.wizard.optional_surgery_year", { number: index + 1 }),
            "personal",
            `previousSurgeryDetails.${index}.year`,
            "previousSurgeries",
          );
        }
        if (!detail.reason.trim()) {
          add(
            `surgery-${index}-reason`,
            t("patient.wizard.optional_surgery_reason", { number: index + 1 }),
            "personal",
            `previousSurgeryDetails.${index}.reason`,
            "previousSurgeries",
          );
        }
      });
    }
    if (values.currentTreatments === "yes") {
      values.currentTreatmentDetails.forEach((detail, index) => {
        if (!detail.professional.trim()) {
          add(
            `treatment-${index}-professional`,
            t("patient.wizard.optional_treatment_professional", {
              number: index + 1,
            }),
            "personal",
            `currentTreatmentDetails.${index}.professional`,
            "currentTreatments",
          );
        }
      });
    }
    if (values.familyHistoryMode === "recorded") {
      if (!values.familyOtherConditions?.trim()) {
        add(
          "family-other",
          t("patient.wizard.family_other_conditions"),
          "family",
          "familyOtherConditions",
        );
      }
      if (!values.familyHistoryNotes?.trim()) {
        add(
          "family-notes",
          t("patient.wizard.family_notes"),
          "family",
          "familyHistoryNotes",
        );
      }
    }
    return missing;
  };

  const goToNextStep = async () => {
    if (step === 3 && !user) {
      toast.error(t("patient.wizard.responsible_unavailable"));
      return;
    }
    if (step === 4) {
      const isSectionValid = await trigger(
        MEDICAL_SECTION_FIELDS[medicalSection],
        { shouldFocus: true },
      );
      if (!isSectionValid) return;
      const sectionIndex = medicalSections.findIndex(
        (section) => section.id === medicalSection,
      );
      if (sectionIndex < medicalSections.length - 1) {
        setMedicalSection(medicalSections[sectionIndex + 1]!.id);
        return;
      }
      for (const section of medicalSections) {
        const isValid = await trigger(MEDICAL_SECTION_FIELDS[section.id]);
        if (!isValid) {
          setMedicalSection(section.id);
          return;
        }
      }
      if (!optionalMedicalInfoSkipped) {
        const missing = collectMissingOptionalMedicalInfo(getValues());
        if (missing.length > 0) {
          setMissingOptionalMedicalInfo(missing);
          setOptionalMedicalInfoOpen(true);
          return;
        }
      }
      setStep(5);
      return;
    }
    if (step === 5) {
      const isSectionValid = await trigger(
        NUTRITION_SECTION_FIELDS[nutritionSection],
        {
          shouldFocus: true,
        },
      );
      if (!isSectionValid) return;
      const sectionIndex = nutritionSections.findIndex(
        (section) => section.id === nutritionSection,
      );
      if (sectionIndex < nutritionSections.length - 1) {
        setNutritionSection(nutritionSections[sectionIndex + 1]!.id);
        return;
      }
      for (const section of nutritionSections) {
        const isValid = await trigger(NUTRITION_SECTION_FIELDS[section.id], {
          shouldFocus: true,
        });
        if (!isValid) {
          setNutritionSection(section.id);
          return;
        }
      }
      setStep(6);
      return;
    }
    const isValid = await trigger(steps[step].fields, { shouldFocus: true });
    if (!isValid) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    if (step === 4) {
      const sectionIndex = medicalSections.findIndex(
        (section) => section.id === medicalSection,
      );
      if (sectionIndex > 0) {
        setMedicalSection(medicalSections[sectionIndex - 1]!.id);
        return;
      }
    }
    if (step === 5) {
      const sectionIndex = nutritionSections.findIndex(
        (section) => section.id === nutritionSection,
      );
      if (sectionIndex > 0) {
        setNutritionSection(nutritionSections[sectionIndex - 1]!.id);
        return;
      }
      setMedicalSection("medications");
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const onSubmit = async (formValues: NewPatientWizardValues) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      if (!user) throw new Error(t("patient.wizard.responsible_unavailable"));
      const created = await patientService.create.execute({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        secondLastName: optionalString(formValues.secondLastName),
        birthDate: birthDateFromAge(Number(formValues.age)),
        sex: formValues.sex as Sex,
        occupation: optionalString(formValues.occupation),
        email: Email.from(formValues.email),
        phone: PhoneVO.from(formValues.phone),
        secondaryPhone: formValues.secondaryPhone
          ? PhoneVO.from(formValues.secondaryPhone)
          : null,
        whatsappEnabled: formValues.whatsappEnabled === "yes",
        emergencyContactName: optionalString(formValues.emergencyContactName),
        emergencyContactRelationship: optionalString(
          formValues.emergencyContactRelationship,
        ),
        emergencyContactPhone: formValues.emergencyContactPhone
          ? PhoneVO.from(formValues.emergencyContactPhone)
          : null,
        responsibleProfessionalId: user.id,
        externalRecordNumber: formValues.externalRecordNumber.trim(),
        admissionReason: formValues.admissionReason.trim(),
        photoUrl: optionalString(formValues.photoUrl),
        medicalIntake: {
          diagnosedConditions: formValues.diagnosedConditions === "yes",
          previousSurgeries: formValues.previousSurgeries === "yes",
          currentTreatments: formValues.currentTreatments === "yes",
          intolerances: formValues.intolerances === "yes",
          diagnosedConditionDetails:
            formValues.diagnosedConditions === "yes"
              ? formValues.diagnosedConditionDetails.map((detail) => ({
                  diagnosis: detail.diagnosis.trim(),
                  diagnosisYear: detail.diagnosisYear
                    ? Number(detail.diagnosisYear)
                    : null,
                  status: detail.status as PatientConditionStatus,
                  treatment: optionalString(detail.treatment),
                }))
              : [],
          previousSurgeryDetails:
            formValues.previousSurgeries === "yes"
              ? formValues.previousSurgeryDetails.map((detail) => ({
                  procedure: detail.procedure.trim(),
                  year: detail.year ? Number(detail.year) : null,
                  reason: optionalString(detail.reason),
                }))
              : [],
          currentTreatmentDetails:
            formValues.currentTreatments === "yes"
              ? formValues.currentTreatmentDetails.map((detail) => ({
                  name: detail.name.trim(),
                  reason: detail.reason.trim(),
                  frequency: detail.frequency.trim(),
                  professional: optionalString(detail.professional),
                }))
              : [],
          intoleranceDetails:
            formValues.intolerances === "yes"
              ? formValues.intoleranceDetails.map((detail) => ({
                  substance: detail.substance.trim(),
                  reaction: detail.reaction.trim(),
                  severity: detail.severity as "mild" | "moderate" | "severe",
                }))
              : [],
          familyHistory:
            formValues.familyHistoryMode === "unknown"
              ? null
              : formValues.familyHistoryMode === "recorded"
                ? hasRecordedFamilyHistory(formValues) ||
                  Boolean(formValues.familyOtherConditions?.trim())
                : false,
          familyHistoryMode: formValues.familyHistoryMode || null,
          familyHistoryDetails:
            formValues.familyHistoryMode === "recorded"
              ? {
                  diabetes: formValues.familyDiabetes,
                  hypertension: formValues.familyHypertension,
                  obesity: formValues.familyObesity,
                  cardiovascularDisease: formValues.familyCardiovascular,
                  dyslipidemia: formValues.familyDyslipidemia,
                  kidneyDisease: formValues.familyKidneyDisease,
                  thyroidDisease: formValues.familyThyroidDisease,
                  otherConditions: optionalString(
                    formValues.familyOtherConditions,
                  ),
                  notes: optionalString(formValues.familyHistoryNotes),
                }
              : null,
          medications: formValues.medications === "yes",
          supplements: formValues.supplements === "yes",
          medicationAllergies: formValues.medicationAllergies === "yes",
          adverseMedicationOrSupplementEffects:
            formValues.adverseMedicationOrSupplementEffects === "yes",
          supplementDetails:
            formValues.supplements === "yes"
              ? formValues.supplementDetails.map((detail) => ({
                  name: detail.name.trim(),
                  dose: detail.dose.trim(),
                  frequency: detail.frequency as PatientMedicationFrequency,
                  objective: detail.objective.trim(),
                }))
              : [],
          medicationAllergyDetails:
            formValues.medicationAllergies === "yes"
              ? formValues.medicationAllergyDetails.map((detail) => ({
                  medication: detail.medication.trim(),
                  reaction: detail.reaction.trim(),
                  severity:
                    detail.severity as PatientMedicationAllergyDetail["severity"],
                  requiredMedicalAttention:
                    detail.requiredMedicalAttention === "yes",
                }))
              : [],
          dailyMedicationDetails:
            formValues.medications === "yes"
              ? formValues.dailyMedicationDetails.map((detail) => ({
                  name: detail.name.trim(),
                  dose: detail.dose.trim(),
                  frequency: detail.frequency as PatientMedicationFrequency,
                  schedule: detail.schedule.trim(),
                  reason: detail.reason.trim(),
                  prescribedByProfessional:
                    detail.prescribedByProfessional === "yes",
                }))
              : [],
          adverseEffectDetails:
            formValues.adverseMedicationOrSupplementEffects === "yes"
              ? optionalString(formValues.adverseEffectDetails)
              : null,
          nutritionIntake: {
            routine: {
              breakfastTime: formValues.breakfastTime,
              mainMealTime: formValues.mainMealTime,
              dinnerTime: formValues.dinnerTime,
              snackTimes: formValues.snackTimes
                .map((snack) => snack.time)
                .filter(Boolean),
              mealsPerDay: Number(formValues.mealsPerDay),
              skipsMeals: formValues.skipsMeals === "yes",
              mostSkippedMeal:
                formValues.skipsMeals === "yes"
                  ? (formValues.mostSkippedMeal as PatientSkippedMeal)
                  : null,
              scheduleVaries: formValues.scheduleVaries === "yes",
              scheduleVariation:
                formValues.scheduleVaries === "yes"
                  ? (formValues.scheduleVariation as PatientMealScheduleVariation)
                  : null,
              mealDuration: formValues.mealDuration as PatientMealDuration,
            },
            patterns: {
              eatingOutFrequency:
                formValues.eatingOutFrequency as PatientEatingOutFrequency,
              snacksBetweenMeals: formValues.snacksBetweenMeals === "yes",
              eatsLateAtNight: formValues.eatsLateAtNight === "yes",
              frequentCravings: formValues.frequentCravings === "yes",
              cravingTime:
                formValues.frequentCravings === "yes"
                  ? (formValues.cravingTime as PatientCravingTime)
                  : null,
              mealPreparer: formValues.mealPreparer as PatientMealPreparer,
              primaryMealLocation: formValues.primaryMealLocation
                ? (formValues.primaryMealLocation as PatientMealLocation)
                : null,
            },
            preferences: {
              usualDietType: formValues.usualDietType as PatientUsualDietType,
              otherDietDescription:
                formValues.usualDietType === "other"
                  ? optionalString(formValues.otherDietDescription)
                  : null,
              avoidsFoods: formValues.avoidsFoods === "yes",
              avoidedFoods:
                formValues.avoidsFoods === "yes"
                  ? optionalString(formValues.avoidedFoods)
                  : null,
              followsFoodRestrictions:
                formValues.followsFoodRestrictions === "yes",
              foodRestrictionDetails:
                formValues.followsFoodRestrictions === "yes"
                  ? optionalString(formValues.foodRestrictionDetails)
                  : null,
              hasFoodDiscomfort: formValues.hasFoodDiscomfort === "yes",
              discomfortFoods:
                formValues.hasFoodDiscomfort === "yes"
                  ? optionalString(formValues.discomfortFoods)
                  : null,
              specialPreference:
                formValues.specialEatingPreference as PatientSpecialEatingPreference,
              notes: optionalString(formValues.foodPreferenceNotes),
            },
            hydration: {
              waterIntake: formValues.waterIntake as PatientWaterIntake,
              drinksWaterThroughoutDay:
                formValues.drinksWaterThroughoutDay === "yes",
              carriesWaterBottle: formValues.carriesWaterBottle === "yes",
              coffeeTeaFrequency:
                formValues.coffeeTeaFrequency as PatientCoffeeTeaFrequency,
              sugaryDrinkFrequency:
                formValues.sugaryDrinkFrequency as PatientSugaryDrinkFrequency,
              consumesEnergyDrinks: formValues.consumesEnergyDrinks === "yes",
              otherBeverage: formValues.otherBeverage as PatientOtherBeverage,
              alcoholFrequency: formValues.alcoholFrequency
                ? (formValues.alcoholFrequency as PatientAlcoholFrequency)
                : null,
              notes: optionalString(formValues.hydrationNotes),
            },
            digestive: {
              appetiteLevel: formValues.appetiteLevel as PatientAppetiteLevel,
              earlySatiety: formValues.earlySatiety === "yes",
              hasDigestiveDiscomfort:
                formValues.hasDigestiveDiscomfort === "yes",
              symptoms:
                formValues.hasDigestiveDiscomfort === "yes"
                  ? (formValues.digestiveSymptoms as PatientDigestiveSymptom[])
                  : [],
              otherSymptomDescription:
                formValues.hasDigestiveDiscomfort === "yes" &&
                formValues.digestiveSymptoms.includes("other")
                  ? optionalString(formValues.otherDigestiveSymptom)
                  : null,
              symptomTiming:
                formValues.hasDigestiveDiscomfort === "yes"
                  ? (formValues.symptomTiming as PatientSymptomTiming)
                  : null,
              notes: optionalString(formValues.digestiveNotes),
            },
          },
          physicalActivity: formValues.physicalActivity === "yes",
        },
        clinicalTags: parseTags(formValues.clinicalTags),
        generalNotes: optionalString(formValues.generalNotes),
      });
      reset(formValues);
      toast.success(t("patient.created_success"), {
        description: created.fullName,
      });
      if (onCreated) onCreated(created);
      else navigate(`/pacientes/${created.id.toString()}`);
    } catch (error) {
      toast.error(t("patient.create_error"), {
        description:
          error instanceof Error ? error.message : t("common.unexpected_error"),
      });
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const currentStep = steps[step];
  const DisplayStepIcon =
    step === 4
      ? activeMedicalSection.icon
      : step === 5
        ? activeNutritionSection.icon
        : currentStep.icon;
  const displayStepTitle =
    step === 4
      ? activeMedicalSection.title
      : step === 5
        ? activeNutritionSection.title
        : (currentStep.cardTitle ?? currentStep.title);
  const displayStepDescription =
    step === 4
      ? activeMedicalSection.cardDescription
      : step === 5
        ? activeNutritionSection.cardDescription
        : currentStep.cardDescription;
  const isLastStep = step === steps.length - 1;
  const responsibleInitials = getInitials(user?.nombreCompleto ?? "");

  const selectPatientPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError(null);
    if (!PATIENT_PHOTO_TYPES.includes(file.type)) {
      setPhotoError(t("patient.wizard.photo_type_error"));
      return;
    }
    if (file.size > MAX_PATIENT_PHOTO_BYTES) {
      setPhotoError(t("patient.wizard.photo_size_error"));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setValue("photoUrl", dataUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch {
      setPhotoError(t("patient.wizard.photo_read_error"));
    }
  };

  return (
    <>
      <PageHeader
        title={t("patient.wizard.registration_title")}
        description={t("patient.wizard.registration_subtitle")}
        className="nc-new-patient__pageHeader"
      />

      <PageContent className="nc-new-patient-page">
        <div
          className="nc-new-patient"
          data-medical-history={step === 4 || undefined}
          data-nutrition={step === 5 || undefined}
        >
          <aside className="nc-new-patient__sidebar">
            <nav aria-label={t("patient.wizard.progress_label")}>
              {steps.map((wizardStep, index) => {
                const StepIcon = wizardStep.icon;
                const current = index === step;
                const completed = index < step;
                return (
                  <button
                    key={wizardStep.title}
                    type="button"
                    className="nc-new-patient__menuStep"
                    data-current={current || undefined}
                    data-completed={completed || undefined}
                    disabled={!allowsPreviewNavigation && index > step}
                    onClick={() =>
                      (allowsPreviewNavigation || index < step) &&
                      setStep(index)
                    }
                    aria-current={current ? "step" : undefined}
                  >
                    <span className="nc-new-patient__stepNumber">
                      {index + 1}
                    </span>
                    <span
                      className="nc-new-patient__menuIcon"
                      aria-hidden="true"
                    >
                      <StepIcon />
                    </span>
                    <span className="nc-new-patient__menuText">
                      <strong>{wizardStep.title}</strong>
                      <small>{wizardStep.description}</small>
                    </span>
                    {completed && (
                      <CircleCheck
                        className="nc-new-patient__completedIcon"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {(step === 4 || step === 5) && (
            <aside className="nc-new-patient__medicalNav">
              <nav
                aria-label={t(
                  step === 4
                    ? "patient.wizard.medical_sections_label"
                    : "patient.wizard.nutrition_sections_label",
                )}
              >
                {(step === 4 ? medicalSections : nutritionSections).map(
                  (section) => {
                    const SectionIcon = section.icon;
                    const current =
                      step === 4
                        ? section.id === medicalSection
                        : section.id === nutritionSection;
                    const disabled =
                      "implemented" in section && !section.implemented;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        data-section={section.id}
                        data-current={current || undefined}
                        aria-current={current ? "page" : undefined}
                        disabled={disabled}
                        onClick={() => {
                          if (step === 4) {
                            setMedicalSection(section.id as MedicalSection);
                          } else {
                            setNutritionSection(section.id as NutritionSection);
                          }
                        }}
                      >
                        <span aria-hidden="true">
                          <SectionIcon />
                        </span>
                        <span>
                          <strong>{section.title}</strong>
                          <small>{section.menuDescription}</small>
                        </span>
                      </button>
                    );
                  },
                )}
              </nav>
            </aside>
          )}

          <main className="nc-new-patient__main">
            <form
              id="new-patient-wizard-form"
              noValidate
              onSubmit={(event) => {
                if (!isLastStep) {
                  event.preventDefault();
                  void goToNextStep();
                  return;
                }
                void handleSubmit(onSubmit)(event);
              }}
            >
              <section
                className="nc-new-patient__formCard"
                data-step={step}
                data-nutrition-section={
                  step === 5 ? nutritionSection : undefined
                }
                aria-labelledby="new-patient-step-title"
              >
                <header className="nc-new-patient__formHeader">
                  <span
                    className="nc-new-patient__formHeaderIcon"
                    aria-hidden="true"
                  >
                    <DisplayStepIcon />
                  </span>
                  <div>
                    <h2 id="new-patient-step-title">{displayStepTitle}</h2>
                    <p>{displayStepDescription}</p>
                  </div>
                </header>

                {step === 0 && <PatientIllustration />}

                <div
                  className="nc-new-patient__formFields"
                  data-has-illustration={step === 0 || undefined}
                  data-contact={step === 1 || undefined}
                  data-emergency={step === 2 || undefined}
                  data-clinical-record={step === 3 || undefined}
                  data-medical-history={step === 4 || undefined}
                  data-medical-section={step === 4 ? medicalSection : undefined}
                  data-nutrition={step === 5 || undefined}
                  data-physical-activity={step === 6 || undefined}
                >
                  {step === 0 && (
                    <>
                      <WizardField
                        label={t("patient.names")}
                        htmlFor="field-new-patient-first-name"
                        error={errors.firstName}
                        required
                      >
                        <IconInput icon={UserRound}>
                          <Input
                            id="field-new-patient-first-name"
                            autoComplete="given-name"
                            placeholder={t("patient.first_name_placeholder")}
                            {...register("firstName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.first_surname")}
                        htmlFor="field-new-patient-last-name"
                        error={errors.lastName}
                        required
                      >
                        <IconInput icon={UsersRound}>
                          <Input
                            id="field-new-patient-last-name"
                            autoComplete="family-name"
                            placeholder={t("patient.last_name_placeholder")}
                            {...register("lastName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.second_surname")}
                        htmlFor="field-new-patient-second-last-name"
                        error={errors.secondLastName}
                      >
                        <IconInput icon={UserRound}>
                          <Input
                            id="field-new-patient-second-last-name"
                            placeholder={t(
                              "patient.second_last_name_placeholder",
                            )}
                            {...register("secondLastName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.age")}
                        htmlFor="field-new-patient-age"
                        error={errors.age}
                        required
                      >
                        <IconInput icon={CalendarDays}>
                          <Input
                            id="field-new-patient-age"
                            type="number"
                            min="0"
                            max="125"
                            inputMode="numeric"
                            placeholder={t(
                              "patient.wizard.age_input_placeholder",
                            )}
                            {...register("age")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.sex")}
                        htmlFor="field-new-patient-sex"
                        error={errors.sex}
                        required
                      >
                        <IconInput icon={UserRound}>
                          <select
                            id="field-new-patient-sex"
                            {...register("sex")}
                          >
                            <option value="" disabled>
                              {t("patient.wizard.select_option")}
                            </option>
                            {(
                              [
                                "female",
                                "male",
                                "intersex",
                                "undisclosed",
                              ] as Sex[]
                            ).map((sex) => (
                              <option key={sex} value={sex}>
                                {t(`patient.sex_${sex}`)}
                              </option>
                            ))}
                          </select>
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.occupation")}
                        htmlFor="field-new-patient-occupation"
                        error={errors.occupation}
                      >
                        <IconInput icon={BriefcaseBusiness}>
                          <Input
                            id="field-new-patient-occupation"
                            placeholder={t("patient.occupation_placeholder")}
                            {...register("occupation")}
                          />
                        </IconInput>
                      </WizardField>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <WizardField
                        label={t("patient.email")}
                        htmlFor="field-new-patient-email"
                        error={errors.email}
                        required
                      >
                        <IconInput icon={Mail}>
                          <Input
                            id="field-new-patient-email"
                            type="email"
                            autoComplete="email"
                            placeholder="ejemplo@correo.com"
                            {...register("email")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.primary_phone")}
                        htmlFor="field-new-patient-phone"
                        error={errors.phone}
                        required
                      >
                        <IconInput icon={Phone}>
                          <Input
                            id="field-new-patient-phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="+52 55 1234 5678"
                            {...register("phone")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.wizard.secondary_phone_optional")}
                        htmlFor="field-new-patient-secondary-phone"
                        error={errors.secondaryPhone}
                        className="nc-new-patient__field--full"
                      >
                        <IconInput icon={Phone}>
                          <Input
                            id="field-new-patient-secondary-phone"
                            type="tel"
                            autoComplete="tel-national"
                            placeholder="+52 55 8765 4321"
                            {...register("secondaryPhone")}
                          />
                        </IconInput>
                      </WizardField>
                      <div
                        className="nc-new-patient__whatsappField"
                        data-enabled={whatsappEnabled === "yes"}
                        role="radiogroup"
                        aria-labelledby="new-patient-whatsapp-label"
                      >
                        <div className="nc-new-patient__whatsappQuestion">
                          <strong>
                            <span id="new-patient-whatsapp-label">
                              {t("patient.wizard.whatsapp_question")}
                            </span>
                          </strong>
                          <small>
                            {t("patient.wizard.whatsapp_description")}
                          </small>
                        </div>
                        <div className="nc-new-patient__whatsappOptions">
                          <label>
                            <input
                              type="radio"
                              value="yes"
                              {...register("whatsappEnabled")}
                            />
                            <span>
                              <MessageCircle aria-hidden="true" />
                              {t("common.yes")}
                            </span>
                          </label>
                          <label>
                            <input
                              type="radio"
                              value="no"
                              {...register("whatsappEnabled")}
                            />
                            <span>
                              <MessageCircleOff aria-hidden="true" />
                              {t("common.no")}
                            </span>
                          </label>
                        </div>
                        {whatsappEnabled === "yes" && (
                          <div className="nc-new-patient__whatsappSame">
                            <MessageCircle aria-hidden="true" />
                            <span>
                              <strong>
                                {t("patient.wizard.whatsapp_same_number")}
                              </strong>
                              <small>
                                {t(
                                  "patient.wizard.whatsapp_same_number_description",
                                )}
                              </small>
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <WizardField
                        label={t("patient.full_name")}
                        htmlFor="field-new-patient-emergency-name"
                        error={errors.emergencyContactName}
                        required
                      >
                        <IconInput icon={UserRound}>
                          <Input
                            id="field-new-patient-emergency-name"
                            placeholder={t(
                              "patient.wizard.emergency_name_placeholder",
                            )}
                            {...register("emergencyContactName")}
                          />
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.relationship")}
                        htmlFor="field-new-patient-emergency-relationship"
                        error={errors.emergencyContactRelationship}
                        required
                      >
                        <IconInput icon={UsersRound}>
                          <select
                            id="field-new-patient-emergency-relationship"
                            {...register("emergencyContactRelationship")}
                          >
                            <option value="" disabled>
                              {t(
                                "patient.wizard.relationship_select_placeholder",
                              )}
                            </option>
                            {EMERGENCY_RELATIONSHIPS.map(([value, key]) => (
                              <option key={key} value={value}>
                                {t(`patient.wizard.relationship_${key}`)}
                              </option>
                            ))}
                          </select>
                        </IconInput>
                      </WizardField>
                      <WizardField
                        label={t("patient.phone")}
                        htmlFor="field-new-patient-emergency-phone"
                        error={errors.emergencyContactPhone}
                        required
                      >
                        <IconInput icon={Phone}>
                          <Input
                            id="field-new-patient-emergency-phone"
                            type="tel"
                            placeholder="+52 55 1234 5678"
                            {...register("emergencyContactPhone")}
                          />
                        </IconInput>
                      </WizardField>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className="nc-new-patient__clinicalTop">
                        <div className="nc-new-patient__clinicalDetails">
                          <WizardField
                            label={t("patient.wizard.clinical_record_number")}
                            htmlFor="field-new-patient-record"
                            error={errors.externalRecordNumber}
                            required
                          >
                            <IconInput icon={FolderOpen}>
                              <Input
                                id="field-new-patient-record"
                                placeholder={t(
                                  "patient.wizard.clinical_record_number_placeholder",
                                )}
                                {...register("externalRecordNumber")}
                              />
                            </IconInput>
                          </WizardField>

                          <div className="nc-new-patient__responsibleField">
                            <Label>
                              {t("patient.wizard.record_responsible")}
                            </Label>
                            {user ? (
                              <div className="nc-new-patient__responsibleCard">
                                <span className="nc-new-patient__responsibleAvatar">
                                  {responsibleInitials}
                                  <i aria-hidden="true" />
                                </span>
                                <span className="nc-new-patient__responsibleIdentity">
                                  <strong>{user.nombreCompleto}</strong>
                                  <small>{t(`auth.role_${user.rol}`)}</small>
                                </span>
                                <span className="nc-new-patient__responsibleAssignment">
                                  <b>
                                    <ShieldCheck aria-hidden="true" />
                                    {t("patient.wizard.assigned_automatically")}
                                  </b>
                                  <small>
                                    {t(
                                      "patient.wizard.assigned_automatically_description",
                                    )}
                                  </small>
                                </span>
                              </div>
                            ) : (
                              <p
                                className="nc-new-patient__responsibleError"
                                role="alert"
                              >
                                {t("patient.wizard.responsible_unavailable")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className="nc-new-patient__clinicalDivider"
                          aria-hidden="true"
                        />

                        <div className="nc-new-patient__photoField">
                          <Label>
                            {t("patient.wizard.patient_photo_optional")}
                          </Label>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="nc-new-patient__photoInput"
                            onChange={(event) => {
                              void selectPatientPhoto(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                          {photoUrl ? (
                            <div className="nc-new-patient__photoPreview">
                              <img
                                src={photoUrl}
                                alt={t("patient.wizard.patient_photo_preview")}
                              />
                              <div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => photoInputRef.current?.click()}
                                >
                                  <CloudUpload aria-hidden="true" />
                                  {t("patient.wizard.replace_photo")}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => {
                                    setValue("photoUrl", "", {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                    setPhotoError(null);
                                  }}
                                >
                                  <Trash2 aria-hidden="true" />
                                  {t("common.delete")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="nc-new-patient__photoDropzone"
                              data-dragging={draggingPhoto || undefined}
                              onClick={() => photoInputRef.current?.click()}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                setDraggingPhoto(true);
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDragLeave={() => setDraggingPhoto(false)}
                              onDrop={(event) => {
                                event.preventDefault();
                                setDraggingPhoto(false);
                                void selectPatientPhoto(
                                  event.dataTransfer.files[0],
                                );
                              }}
                            >
                              <CloudUpload aria-hidden="true" />
                              <strong>
                                {t("patient.wizard.photo_drop_title")}
                              </strong>
                              <span>
                                {t("patient.wizard.photo_drop_action")}
                              </span>
                              <small>
                                {t("patient.wizard.photo_requirements")}
                              </small>
                            </button>
                          )}
                          {photoError && <p role="alert">{photoError}</p>}
                        </div>
                      </div>

                      <WizardField
                        label={t("patient.wizard.admission_reason")}
                        htmlFor="field-new-patient-admission-reason"
                        error={errors.admissionReason}
                        className="nc-new-patient__field--full"
                        required
                      >
                        <Textarea
                          id="field-new-patient-admission-reason"
                          rows={3}
                          placeholder={t(
                            "patient.wizard.admission_reason_placeholder",
                          )}
                          {...register("admissionReason")}
                        />
                      </WizardField>
                    </>
                  )}

                  {step === 4 && medicalSection === "personal" && (
                    <>
                      <BinaryQuestion
                        field="diagnosedConditions"
                        number={1}
                        question={t(
                          "patient.wizard.question_diagnosed_conditions",
                        )}
                        icon={Stethoscope}
                        register={register}
                        error={errors.diagnosedConditions}
                        showDetail={diagnosedConditions === "yes"}
                        detailComplete={Boolean(
                          diagnosedConditionDetailsComplete,
                        )}
                        collapsed={collapsedMedicalDetails.diagnosedConditions}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed(
                            "diagnosedConditions",
                            collapsed,
                          )
                        }
                        collapsedSummary={t(
                          "patient.wizard.conditions_registered",
                          { count: diagnosedConditionFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {diagnosedConditionFields.map((condition, index) => (
                            <section
                              key={condition.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.condition_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {diagnosedConditionFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeDiagnosedCondition(index)
                                    }
                                    aria-label={t(
                                      "patient.wizard.remove_condition",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.condition_diagnosis_label",
                                  )}
                                  htmlFor={`condition-${index}-diagnosis`}
                                  error={
                                    errors.diagnosedConditionDetails?.[index]
                                      ?.diagnosis
                                  }
                                  required
                                >
                                  <Input
                                    id={`condition-${index}-diagnosis`}
                                    placeholder={t(
                                      "patient.wizard.condition_diagnosis_placeholder",
                                    )}
                                    {...register(
                                      `diagnosedConditionDetails.${index}.diagnosis`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.condition_year_label",
                                  )}
                                  htmlFor={`condition-${index}-year`}
                                  error={
                                    errors.diagnosedConditionDetails?.[index]
                                      ?.diagnosisYear
                                  }
                                >
                                  <Input
                                    id={`condition-${index}-year`}
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder={t(
                                      "patient.wizard.clinical_year_placeholder",
                                    )}
                                    {...register(
                                      `diagnosedConditionDetails.${index}.diagnosisYear`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.condition_status_label",
                                  )}
                                  htmlFor={`condition-${index}-status`}
                                  error={
                                    errors.diagnosedConditionDetails?.[index]
                                      ?.status
                                  }
                                  required
                                >
                                  <select
                                    id={`condition-${index}-status`}
                                    {...register(
                                      `diagnosedConditionDetails.${index}.status`,
                                    )}
                                  >
                                    <option value="">
                                      {t("common.select")}
                                    </option>
                                    {(
                                      [
                                        "active",
                                        "controlled",
                                        "resolved",
                                      ] as const
                                    ).map((status) => (
                                      <option key={status} value={status}>
                                        {t(
                                          `patient.wizard.condition_status_${status}`,
                                        )}
                                      </option>
                                    ))}
                                  </select>
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.condition_treatment_label",
                                  )}
                                  htmlFor={`condition-${index}-treatment`}
                                  error={
                                    errors.diagnosedConditionDetails?.[index]
                                      ?.treatment
                                  }
                                >
                                  <Input
                                    id={`condition-${index}-treatment`}
                                    placeholder={t(
                                      "patient.wizard.condition_treatment_placeholder",
                                    )}
                                    {...register(
                                      `diagnosedConditionDetails.${index}.treatment`,
                                    )}
                                  />
                                </ClinicalDetailField>
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendDiagnosedCondition({
                                diagnosis: "",
                                diagnosisYear: "",
                                status: "",
                                treatment: "",
                              })
                            }
                            disabled={diagnosedConditionFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_condition")}
                          </button>
                        </div>
                      </BinaryQuestion>
                      <BinaryQuestion
                        field="previousSurgeries"
                        number={2}
                        question={t(
                          "patient.wizard.question_previous_surgeries",
                        )}
                        icon={Bandage}
                        register={register}
                        error={errors.previousSurgeries}
                        showDetail={previousSurgeries === "yes"}
                        detailComplete={Boolean(previousSurgeryDetailsComplete)}
                        collapsed={collapsedMedicalDetails.previousSurgeries}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed(
                            "previousSurgeries",
                            collapsed,
                          )
                        }
                        collapsedSummary={t(
                          "patient.wizard.surgeries_registered",
                          { count: previousSurgeryFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {previousSurgeryFields.map((surgery, index) => (
                            <section
                              key={surgery.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.surgery_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {previousSurgeryFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removePreviousSurgery(index)}
                                    aria-label={t(
                                      "patient.wizard.remove_surgery",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.surgery_procedure_label",
                                  )}
                                  htmlFor={`surgery-${index}-procedure`}
                                  error={
                                    errors.previousSurgeryDetails?.[index]
                                      ?.procedure
                                  }
                                  required
                                  full
                                >
                                  <Input
                                    id={`surgery-${index}-procedure`}
                                    placeholder={t(
                                      "patient.wizard.surgery_procedure_placeholder",
                                    )}
                                    {...register(
                                      `previousSurgeryDetails.${index}.procedure`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t("patient.wizard.surgery_year_label")}
                                  htmlFor={`surgery-${index}-year`}
                                  error={
                                    errors.previousSurgeryDetails?.[index]?.year
                                  }
                                >
                                  <Input
                                    id={`surgery-${index}-year`}
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder={t(
                                      "patient.wizard.clinical_year_placeholder",
                                    )}
                                    {...register(
                                      `previousSurgeryDetails.${index}.year`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.surgery_reason_label",
                                  )}
                                  htmlFor={`surgery-${index}-reason`}
                                  error={
                                    errors.previousSurgeryDetails?.[index]
                                      ?.reason
                                  }
                                >
                                  <Input
                                    id={`surgery-${index}-reason`}
                                    placeholder={t(
                                      "patient.wizard.surgery_reason_placeholder",
                                    )}
                                    {...register(
                                      `previousSurgeryDetails.${index}.reason`,
                                    )}
                                  />
                                </ClinicalDetailField>
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendPreviousSurgery({
                                procedure: "",
                                year: "",
                                reason: "",
                              })
                            }
                            disabled={previousSurgeryFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_surgery")}
                          </button>
                        </div>
                      </BinaryQuestion>
                      <BinaryQuestion
                        field="currentTreatments"
                        number={3}
                        question={t(
                          "patient.wizard.question_current_treatments",
                        )}
                        icon={PillBottle}
                        register={register}
                        error={errors.currentTreatments}
                        showDetail={currentTreatments === "yes"}
                        detailComplete={Boolean(
                          currentTreatmentDetailsComplete,
                        )}
                        collapsed={collapsedMedicalDetails.currentTreatments}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed(
                            "currentTreatments",
                            collapsed,
                          )
                        }
                        collapsedSummary={t(
                          "patient.wizard.treatments_registered",
                          { count: currentTreatmentFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {currentTreatmentFields.map((treatment, index) => (
                            <section
                              key={treatment.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.treatment_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {currentTreatmentFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeCurrentTreatment(index)
                                    }
                                    aria-label={t(
                                      "patient.wizard.remove_treatment",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.treatment_name_label",
                                  )}
                                  htmlFor={`treatment-${index}-name`}
                                  error={
                                    errors.currentTreatmentDetails?.[index]
                                      ?.name
                                  }
                                  required
                                >
                                  <Input
                                    id={`treatment-${index}-name`}
                                    placeholder={t(
                                      "patient.wizard.treatment_name_placeholder",
                                    )}
                                    {...register(
                                      `currentTreatmentDetails.${index}.name`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.treatment_reason_label",
                                  )}
                                  htmlFor={`treatment-${index}-reason`}
                                  error={
                                    errors.currentTreatmentDetails?.[index]
                                      ?.reason
                                  }
                                  required
                                >
                                  <Input
                                    id={`treatment-${index}-reason`}
                                    placeholder={t(
                                      "patient.wizard.treatment_reason_placeholder",
                                    )}
                                    {...register(
                                      `currentTreatmentDetails.${index}.reason`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.treatment_frequency_label",
                                  )}
                                  htmlFor={`treatment-${index}-frequency`}
                                  error={
                                    errors.currentTreatmentDetails?.[index]
                                      ?.frequency
                                  }
                                  required
                                >
                                  <Input
                                    id={`treatment-${index}-frequency`}
                                    placeholder={t(
                                      "patient.wizard.treatment_frequency_placeholder",
                                    )}
                                    {...register(
                                      `currentTreatmentDetails.${index}.frequency`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.treatment_professional_label",
                                  )}
                                  htmlFor={`treatment-${index}-professional`}
                                  error={
                                    errors.currentTreatmentDetails?.[index]
                                      ?.professional
                                  }
                                >
                                  <Input
                                    id={`treatment-${index}-professional`}
                                    placeholder={t(
                                      "patient.wizard.treatment_professional_placeholder",
                                    )}
                                    {...register(
                                      `currentTreatmentDetails.${index}.professional`,
                                    )}
                                  />
                                </ClinicalDetailField>
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendCurrentTreatment({
                                name: "",
                                reason: "",
                                frequency: "",
                                professional: "",
                              })
                            }
                            disabled={currentTreatmentFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_treatment")}
                          </button>
                        </div>
                      </BinaryQuestion>
                      <BinaryQuestion
                        field="intolerances"
                        number={4}
                        question={t("patient.wizard.question_intolerances")}
                        icon={UserRound}
                        register={register}
                        error={errors.intolerances}
                        showDetail={intolerances === "yes"}
                        detailComplete={Boolean(intoleranceDetailsComplete)}
                        collapsed={collapsedMedicalDetails.intolerances}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed("intolerances", collapsed)
                        }
                        collapsedSummary={t(
                          "patient.wizard.intolerances_registered",
                          { count: intoleranceFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {intoleranceFields.map((intolerance, index) => (
                            <section
                              key={intolerance.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.intolerance_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {intoleranceFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeIntolerance(index)}
                                    aria-label={t(
                                      "patient.wizard.remove_intolerance",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.intolerance_substance_label",
                                  )}
                                  htmlFor={`intolerance-${index}-substance`}
                                  error={
                                    errors.intoleranceDetails?.[index]
                                      ?.substance
                                  }
                                  required
                                >
                                  <Input
                                    id={`intolerance-${index}-substance`}
                                    placeholder={t(
                                      "patient.wizard.intolerance_substance_placeholder",
                                    )}
                                    {...register(
                                      `intoleranceDetails.${index}.substance`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.intolerance_reaction_label",
                                  )}
                                  htmlFor={`intolerance-${index}-reaction`}
                                  error={
                                    errors.intoleranceDetails?.[index]?.reaction
                                  }
                                  required
                                >
                                  <Input
                                    id={`intolerance-${index}-reaction`}
                                    placeholder={t(
                                      "patient.wizard.intolerance_reaction_placeholder",
                                    )}
                                    {...register(
                                      `intoleranceDetails.${index}.reaction`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <div
                                  className="nc-new-patient__clinicalDetailField"
                                  data-full
                                >
                                  <label>
                                    {t(
                                      "patient.wizard.intolerance_severity_label",
                                    )}
                                    <b aria-hidden="true">*</b>
                                  </label>
                                  <div className="nc-new-patient__severityOptions">
                                    {(
                                      ["mild", "moderate", "severe"] as const
                                    ).map((severity) => (
                                      <label key={severity}>
                                        <input
                                          type="radio"
                                          value={severity}
                                          {...register(
                                            `intoleranceDetails.${index}.severity`,
                                          )}
                                        />
                                        <span>
                                          {t(
                                            `patient.wizard.allergy_severity_${severity}`,
                                          )}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  {errors.intoleranceDetails?.[index]?.severity
                                    ?.message && (
                                    <small role="alert">
                                      {
                                        errors.intoleranceDetails[index]
                                          .severity.message
                                      }
                                    </small>
                                  )}
                                </div>
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendIntolerance({
                                substance: "",
                                reaction: "",
                                severity: "",
                              })
                            }
                            disabled={intoleranceFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_intolerance")}
                          </button>
                        </div>
                      </BinaryQuestion>
                    </>
                  )}

                  {step === 4 && medicalSection === "family" && (
                    <section className="nc-new-patient__familyHistory">
                      <fieldset className="nc-new-patient__familyMode">
                        <legend>
                          {t("patient.wizard.family_mode_question")}
                          <b aria-hidden="true">*</b>
                        </legend>
                        <div>
                          {(
                            [
                              {
                                value: "none",
                                icon: ShieldCheck,
                                label: "family_mode_none",
                                description: "family_mode_none_description",
                              },
                              {
                                value: "unknown",
                                icon: CircleEllipsis,
                                label: "family_mode_unknown",
                                description: "family_mode_unknown_description",
                              },
                              {
                                value: "recorded",
                                icon: UsersRound,
                                label: "family_mode_recorded",
                                description: "family_mode_recorded_description",
                              },
                            ] as const
                          ).map((option) => {
                            const ModeIcon = option.icon;
                            return (
                              <label key={option.value}>
                                <input
                                  type="radio"
                                  value={option.value}
                                  {...register("familyHistoryMode")}
                                />
                                <span aria-hidden="true">
                                  <ModeIcon />
                                </span>
                                <span>
                                  <strong>
                                    {t(`patient.wizard.${option.label}`)}
                                  </strong>
                                  <small>
                                    {t(`patient.wizard.${option.description}`)}
                                  </small>
                                </span>
                                <CircleCheck aria-hidden="true" />
                              </label>
                            );
                          })}
                        </div>
                        {errors.familyHistoryMode?.message && (
                          <small role="alert">
                            {errors.familyHistoryMode.message}
                          </small>
                        )}
                      </fieldset>

                      {familyHistoryMode === "recorded" && (
                        <>
                          <h3>{t("patient.wizard.family_conditions_title")}</h3>
                          <div className="nc-new-patient__familyHistoryGrid">
                            <FamilyHistorySelect
                              field="familyDiabetes"
                              label={t("patient.wizard.family_diabetes")}
                              icon={Droplet}
                              control={control}
                            />
                            <FamilyHistorySelect
                              field="familyHypertension"
                              label={t("patient.wizard.family_hypertension")}
                              icon={HeartPulse}
                              control={control}
                            />
                            <FamilyHistorySelect
                              field="familyObesity"
                              label={t("patient.wizard.family_obesity")}
                              icon={UserRound}
                              control={control}
                            />
                            <FamilyHistorySelect
                              field="familyCardiovascular"
                              label={t("patient.wizard.family_cardiovascular")}
                              icon={HeartPulse}
                              control={control}
                            />
                            <FamilyHistorySelect
                              field="familyDyslipidemia"
                              label={t("patient.wizard.family_dyslipidemia")}
                              icon={Droplet}
                              control={control}
                            />
                            <FamilyHistorySelect
                              field="familyKidneyDisease"
                              label={t("patient.wizard.family_kidney_disease")}
                              icon={KidneyIcon}
                              control={control}
                            />
                            <FamilyHistorySelect
                              field="familyThyroidDisease"
                              label={t("patient.wizard.family_thyroid_disease")}
                              icon={ThyroidIcon}
                              control={control}
                            />
                            <div className="nc-new-patient__familyOtherField">
                              <label htmlFor="field-new-patient-family-other">
                                <CircleEllipsis aria-hidden="true" />
                                {t("patient.wizard.family_other_conditions")}
                              </label>
                              <Input
                                id="field-new-patient-family-other"
                                placeholder={t(
                                  "patient.wizard.family_other_conditions_placeholder",
                                )}
                                {...register("familyOtherConditions")}
                              />
                              {errors.familyOtherConditions?.message && (
                                <small role="alert">
                                  {errors.familyOtherConditions.message}
                                </small>
                              )}
                            </div>
                          </div>

                          <div className="nc-new-patient__familyNotes">
                            <label htmlFor="field-new-patient-family-notes">
                              {t("patient.wizard.family_notes")}
                            </label>
                            <Textarea
                              id="field-new-patient-family-notes"
                              rows={3}
                              placeholder={t(
                                "patient.wizard.family_notes_placeholder",
                              )}
                              {...register("familyHistoryNotes")}
                            />
                            {errors.familyHistoryNotes?.message && (
                              <small role="alert">
                                {errors.familyHistoryNotes.message}
                              </small>
                            )}
                          </div>
                        </>
                      )}

                      <div className="nc-new-patient__familyNotice">
                        <Info aria-hidden="true" />
                        <span>{t("patient.wizard.family_notice")}</span>
                      </div>
                    </section>
                  )}

                  {step === 4 && medicalSection === "medications" && (
                    <>
                      <BinaryQuestion
                        field="supplements"
                        number={1}
                        question={t("patient.wizard.question_supplements")}
                        icon={SupplementBottleIcon}
                        register={register}
                        error={errors.supplements}
                        showDetail={supplements === "yes"}
                        detailComplete={Boolean(supplementDetailsComplete)}
                        collapsed={collapsedMedicalDetails.supplements}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed("supplements", collapsed)
                        }
                        collapsedSummary={t(
                          "patient.wizard.supplements_registered",
                          { count: supplementFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {supplementFields.map((supplement, index) => (
                            <section
                              key={supplement.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.supplement_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {supplementFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSupplement(index)}
                                    aria-label={t(
                                      "patient.wizard.remove_supplement",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.supplement_name_label",
                                  )}
                                  htmlFor={`supplement-${index}-name`}
                                  error={
                                    errors.supplementDetails?.[index]?.name
                                  }
                                >
                                  <Input
                                    id={`supplement-${index}-name`}
                                    placeholder={t(
                                      "patient.wizard.supplement_name_placeholder",
                                    )}
                                    {...register(
                                      `supplementDetails.${index}.name`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_dose_label",
                                  )}
                                  htmlFor={`supplement-${index}-dose`}
                                  error={
                                    errors.supplementDetails?.[index]?.dose
                                  }
                                >
                                  <Input
                                    id={`supplement-${index}-dose`}
                                    placeholder={t(
                                      "patient.wizard.supplement_dose_placeholder",
                                    )}
                                    {...register(
                                      `supplementDetails.${index}.dose`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_frequency_label",
                                  )}
                                  htmlFor={`supplement-${index}-frequency`}
                                  error={
                                    errors.supplementDetails?.[index]?.frequency
                                  }
                                >
                                  <select
                                    id={`supplement-${index}-frequency`}
                                    {...register(
                                      `supplementDetails.${index}.frequency`,
                                    )}
                                  >
                                    <option value="">
                                      {t("common.select")}
                                    </option>
                                    {MEDICATION_FREQUENCIES.map((frequency) => (
                                      <option key={frequency} value={frequency}>
                                        {t(
                                          `patient.wizard.medication_frequency_${frequency}`,
                                        )}
                                      </option>
                                    ))}
                                  </select>
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.supplement_objective_label",
                                  )}
                                  htmlFor={`supplement-${index}-objective`}
                                  error={
                                    errors.supplementDetails?.[index]?.objective
                                  }
                                >
                                  <Input
                                    id={`supplement-${index}-objective`}
                                    placeholder={t(
                                      "patient.wizard.supplement_objective_placeholder",
                                    )}
                                    {...register(
                                      `supplementDetails.${index}.objective`,
                                    )}
                                  />
                                </ClinicalDetailField>
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendSupplement({
                                name: "",
                                dose: "",
                                frequency: "",
                                objective: "",
                              })
                            }
                            disabled={supplementFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_supplement")}
                          </button>
                        </div>
                      </BinaryQuestion>
                      <BinaryQuestion
                        field="medicationAllergies"
                        number={2}
                        question={t(
                          "patient.wizard.question_medication_allergies",
                        )}
                        icon={MedicationAllergyIcon}
                        register={register}
                        error={errors.medicationAllergies}
                        showDetail={medicationAllergies === "yes"}
                        detailComplete={Boolean(allergyDetailsComplete)}
                        collapsed={collapsedMedicalDetails.medicationAllergies}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed(
                            "medicationAllergies",
                            collapsed,
                          )
                        }
                        collapsedSummary={t(
                          "patient.wizard.allergies_registered",
                          { count: allergyFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {allergyFields.map((allergy, index) => (
                            <section
                              key={allergy.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.allergy_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {allergyFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeAllergy(index)}
                                    aria-label={t(
                                      "patient.wizard.remove_allergy",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.allergy_medication_label",
                                  )}
                                  htmlFor={`medication-allergy-${index}-medication`}
                                  error={
                                    errors.medicationAllergyDetails?.[index]
                                      ?.medication
                                  }
                                  full
                                >
                                  <Input
                                    id={`medication-allergy-${index}-medication`}
                                    placeholder={t(
                                      "patient.wizard.allergy_medication_placeholder",
                                    )}
                                    {...register(
                                      `medicationAllergyDetails.${index}.medication`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.allergy_reaction_label",
                                  )}
                                  htmlFor={`medication-allergy-${index}-reaction`}
                                  error={
                                    errors.medicationAllergyDetails?.[index]
                                      ?.reaction
                                  }
                                  full
                                >
                                  <Input
                                    id={`medication-allergy-${index}-reaction`}
                                    placeholder={t(
                                      "patient.wizard.allergy_reaction_placeholder",
                                    )}
                                    {...register(
                                      `medicationAllergyDetails.${index}.reaction`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <div
                                  className="nc-new-patient__clinicalDetailField"
                                  data-full
                                >
                                  <label>
                                    {t("patient.wizard.allergy_severity_label")}
                                  </label>
                                  <div className="nc-new-patient__severityOptions">
                                    {(
                                      ["mild", "moderate", "severe"] as const
                                    ).map((severity) => (
                                      <label key={severity}>
                                        <input
                                          type="radio"
                                          value={severity}
                                          {...register(
                                            `medicationAllergyDetails.${index}.severity`,
                                          )}
                                        />
                                        <span>
                                          {t(
                                            `patient.wizard.allergy_severity_${severity}`,
                                          )}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  {errors.medicationAllergyDetails?.[index]
                                    ?.severity?.message && (
                                    <small role="alert">
                                      {
                                        errors.medicationAllergyDetails[index]
                                          .severity.message
                                      }
                                    </small>
                                  )}
                                </div>
                                <ClinicalBinaryDetail
                                  label={t(
                                    "patient.wizard.allergy_attention_label",
                                  )}
                                  field={`medicationAllergyDetails.${index}.requiredMedicalAttention`}
                                  register={register}
                                  error={
                                    errors.medicationAllergyDetails?.[index]
                                      ?.requiredMedicalAttention
                                  }
                                />
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendAllergy({
                                medication: "",
                                reaction: "",
                                severity: "",
                                requiredMedicalAttention: "",
                              })
                            }
                            disabled={allergyFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_allergy")}
                          </button>
                        </div>
                      </BinaryQuestion>
                      <BinaryQuestion
                        field="medications"
                        number={3}
                        question={t("patient.wizard.question_medications")}
                        icon={PrescriptionIcon}
                        register={register}
                        error={errors.medications}
                        showDetail={medications === "yes"}
                        detailComplete={Boolean(dailyMedicationDetailsComplete)}
                        collapsed={collapsedMedicalDetails.medications}
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed("medications", collapsed)
                        }
                        collapsedSummary={t(
                          "patient.wizard.medications_registered",
                          { count: dailyMedicationFields.length },
                        )}
                      >
                        <div className="nc-new-patient__medicalDetailStack">
                          {dailyMedicationFields.map((medication, index) => (
                            <section
                              key={medication.id}
                              className="nc-new-patient__medicalDetailGroup"
                            >
                              <header>
                                <strong>
                                  {t("patient.wizard.medication_number", {
                                    number: index + 1,
                                  })}
                                </strong>
                                {dailyMedicationFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeDailyMedication(index)}
                                    aria-label={t(
                                      "patient.wizard.remove_medication",
                                    )}
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </button>
                                )}
                              </header>
                              <div className="nc-new-patient__medicalDetailGrid">
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_name_label",
                                  )}
                                  htmlFor={`daily-medication-${index}-name`}
                                  error={
                                    errors.dailyMedicationDetails?.[index]?.name
                                  }
                                >
                                  <Input
                                    id={`daily-medication-${index}-name`}
                                    placeholder={t(
                                      "patient.wizard.medication_name_placeholder",
                                    )}
                                    {...register(
                                      `dailyMedicationDetails.${index}.name`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_dose_label",
                                  )}
                                  htmlFor={`daily-medication-${index}-dose`}
                                  error={
                                    errors.dailyMedicationDetails?.[index]?.dose
                                  }
                                >
                                  <Input
                                    id={`daily-medication-${index}-dose`}
                                    placeholder={t(
                                      "patient.wizard.medication_dose_placeholder",
                                    )}
                                    {...register(
                                      `dailyMedicationDetails.${index}.dose`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_frequency_label",
                                  )}
                                  htmlFor={`daily-medication-${index}-frequency`}
                                  error={
                                    errors.dailyMedicationDetails?.[index]
                                      ?.frequency
                                  }
                                >
                                  <select
                                    id={`daily-medication-${index}-frequency`}
                                    {...register(
                                      `dailyMedicationDetails.${index}.frequency`,
                                    )}
                                  >
                                    <option value="">
                                      {t("common.select")}
                                    </option>
                                    {MEDICATION_FREQUENCIES.map((frequency) => (
                                      <option key={frequency} value={frequency}>
                                        {t(
                                          `patient.wizard.medication_frequency_${frequency}`,
                                        )}
                                      </option>
                                    ))}
                                  </select>
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_schedule_label",
                                  )}
                                  htmlFor={`daily-medication-${index}-schedule`}
                                  error={
                                    errors.dailyMedicationDetails?.[index]
                                      ?.schedule
                                  }
                                >
                                  <Input
                                    id={`daily-medication-${index}-schedule`}
                                    type="time"
                                    {...register(
                                      `dailyMedicationDetails.${index}.schedule`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalDetailField
                                  label={t(
                                    "patient.wizard.medication_reason_label",
                                  )}
                                  htmlFor={`daily-medication-${index}-reason`}
                                  error={
                                    errors.dailyMedicationDetails?.[index]
                                      ?.reason
                                  }
                                  full
                                >
                                  <Input
                                    id={`daily-medication-${index}-reason`}
                                    placeholder={t(
                                      "patient.wizard.medication_reason_placeholder",
                                    )}
                                    {...register(
                                      `dailyMedicationDetails.${index}.reason`,
                                    )}
                                  />
                                </ClinicalDetailField>
                                <ClinicalBinaryDetail
                                  label={t(
                                    "patient.wizard.medication_prescribed_label",
                                  )}
                                  field={`dailyMedicationDetails.${index}.prescribedByProfessional`}
                                  register={register}
                                  error={
                                    errors.dailyMedicationDetails?.[index]
                                      ?.prescribedByProfessional
                                  }
                                />
                              </div>
                            </section>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addMedicalDetail"
                            onClick={() =>
                              appendDailyMedication({
                                name: "",
                                dose: "",
                                frequency: "",
                                schedule: "",
                                reason: "",
                                prescribedByProfessional: "",
                              })
                            }
                            disabled={dailyMedicationFields.length >= 12}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.add_medication")}
                          </button>
                        </div>
                      </BinaryQuestion>
                      <BinaryQuestion
                        field="adverseMedicationOrSupplementEffects"
                        number={4}
                        question={t(
                          "patient.wizard.question_adverse_medication_effects",
                        )}
                        icon={AdverseAlertIcon}
                        register={register}
                        error={errors.adverseMedicationOrSupplementEffects}
                        showDetail={adverseMedicationEffects === "yes"}
                        detailComplete={
                          adverseEffectDetailValue.trim().length >= 2
                        }
                        collapsed={
                          collapsedMedicalDetails.adverseMedicationOrSupplementEffects
                        }
                        onCollapsedChange={(collapsed) =>
                          setMedicalDetailCollapsed(
                            "adverseMedicationOrSupplementEffects",
                            collapsed,
                          )
                        }
                        collapsedSummary={t(
                          "patient.wizard.adverse_effect_registered",
                        )}
                      >
                        <ClinicalDetailField
                          label={t("patient.wizard.adverse_effect_label")}
                          htmlFor="adverse-effect-details"
                          error={errors.adverseEffectDetails}
                          full
                        >
                          <Textarea
                            id="adverse-effect-details"
                            rows={4}
                            maxLength={1000}
                            placeholder={t(
                              "patient.wizard.adverse_effect_details_placeholder",
                            )}
                            {...register("adverseEffectDetails")}
                          />
                        </ClinicalDetailField>
                      </BinaryQuestion>
                    </>
                  )}

                  {step === 5 && nutritionSection === "routine" && (
                    <section className="nc-new-patient__nutritionRoutine nc-new-patient__nutritionSchedule">
                      <fieldset className="nc-new-patient__nutritionPanel">
                        <legend>
                          {t("patient.wizard.nutrition_usual_meal_times")}
                        </legend>
                        <div className="nc-new-patient__nutritionScheduleGrid">
                          <NutritionField
                            label={t("patient.wizard.nutrition_breakfast")}
                            htmlFor="field-new-patient-breakfast-time"
                            error={errors.breakfastTime}
                          >
                            <div className="nc-new-patient__nutritionTimeControl">
                              <Clock3 aria-hidden="true" />
                              <input
                                id="field-new-patient-breakfast-time"
                                type="time"
                                {...register("breakfastTime")}
                              />
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionField
                            label={t("patient.wizard.nutrition_main_meal")}
                            htmlFor="field-new-patient-main-meal-time"
                            error={errors.mainMealTime}
                          >
                            <div className="nc-new-patient__nutritionTimeControl">
                              <Clock3 aria-hidden="true" />
                              <input
                                id="field-new-patient-main-meal-time"
                                type="time"
                                {...register("mainMealTime")}
                              />
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionField
                            label={t("patient.wizard.nutrition_dinner")}
                            htmlFor="field-new-patient-dinner-time"
                            error={errors.dinnerTime}
                          >
                            <div className="nc-new-patient__nutritionTimeControl">
                              <Clock3 aria-hidden="true" />
                              <input
                                id="field-new-patient-dinner-time"
                                type="time"
                                {...register("dinnerTime")}
                              />
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          {snackTimeFields.map((snack, index) => (
                            <NutritionField
                              key={snack.id}
                              label={
                                index === 0
                                  ? t("patient.wizard.nutrition_snacks")
                                  : t("patient.wizard.nutrition_snack_number", {
                                      number: index + 1,
                                    })
                              }
                              htmlFor={`field-new-patient-snack-time-${index}`}
                              error={errors.snackTimes?.[index]?.time}
                            >
                              <div className="nc-new-patient__nutritionTimeControl">
                                <Clock3 aria-hidden="true" />
                                <input
                                  id={`field-new-patient-snack-time-${index}`}
                                  type="time"
                                  {...register(`snackTimes.${index}.time`)}
                                />
                                {snackTimeFields.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeSnackTime(index)}
                                    aria-label={t(
                                      "patient.wizard.nutrition_remove_snack",
                                    )}
                                  >
                                    <X aria-hidden="true" />
                                  </button>
                                ) : (
                                  <ChevronDown aria-hidden="true" />
                                )}
                              </div>
                            </NutritionField>
                          ))}
                          <button
                            type="button"
                            className="nc-new-patient__addSnack"
                            onClick={() => appendSnackTime({ time: "" })}
                            disabled={snackTimeFields.length >= 4}
                          >
                            <Plus aria-hidden="true" />
                            {t("patient.wizard.nutrition_add_snack")}
                          </button>
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel">
                        <legend>
                          {t("patient.wizard.nutrition_frequency_omission")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <NutritionField
                            label={t("patient.wizard.nutrition_meals_per_day")}
                            htmlFor="field-new-patient-meals-per-day"
                            error={errors.mealsPerDay}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-meals-per-day"
                                {...register("mealsPerDay")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {Array.from({ length: 8 }, (_, index) => {
                                  const value = String(index + 1);
                                  return (
                                    <option key={value} value={value}>
                                      {t(
                                        "patient.wizard.nutrition_meal_count",
                                        {
                                          count: index + 1,
                                        },
                                      )}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionBinaryField
                            label={t("patient.wizard.nutrition_skips_meals")}
                            field="skipsMeals"
                            register={register}
                            error={errors.skipsMeals}
                          />
                          {skipsMeals === "yes" && (
                            <NutritionField
                              label={t(
                                "patient.wizard.nutrition_most_skipped_meal",
                              )}
                              htmlFor="field-new-patient-most-skipped-meal"
                              error={errors.mostSkippedMeal}
                              className="nc-new-patient__nutritionField--full nc-new-patient__nutritionField--conditional"
                            >
                              <div className="nc-new-patient__nutritionSelectControl">
                                <select
                                  id="field-new-patient-most-skipped-meal"
                                  {...register("mostSkippedMeal")}
                                >
                                  <option value="">
                                    {t(
                                      "patient.wizard.nutrition_select_skipped_meal",
                                    )}
                                  </option>
                                  {(
                                    [
                                      "breakfast",
                                      "mainMeal",
                                      "dinner",
                                      "snack",
                                    ] as const
                                  ).map((meal) => (
                                    <option key={meal} value={meal}>
                                      {t(
                                        `patient.wizard.nutrition_meal_${meal}`,
                                      )}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown aria-hidden="true" />
                              </div>
                            </NutritionField>
                          )}
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel">
                        <legend>
                          {t(
                            "patient.wizard.nutrition_variations_availability",
                          )}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <NutritionBinaryField
                            label={t(
                              "patient.wizard.nutrition_schedule_varies",
                            )}
                            field="scheduleVaries"
                            register={register}
                            error={errors.scheduleVaries}
                          />
                          <NutritionField
                            label={t("patient.wizard.nutrition_meal_duration")}
                            htmlFor="field-new-patient-meal-duration"
                            error={errors.mealDuration}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-meal-duration"
                                {...register("mealDuration")}
                              >
                                <option value="" disabled>
                                  {t(
                                    "patient.wizard.nutrition_select_meal_duration",
                                  )}
                                </option>
                                {(
                                  [
                                    "lessThan15",
                                    "15To20",
                                    "20To30",
                                    "30To45",
                                    "moreThan45",
                                  ] as const
                                ).map((duration) => (
                                  <option key={duration} value={duration}>
                                    {t(
                                      `patient.wizard.nutrition_duration_${duration}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          {scheduleVaries === "yes" && (
                            <NutritionField
                              label={t(
                                "patient.wizard.nutrition_schedule_variation",
                              )}
                              htmlFor="field-new-patient-schedule-variation"
                              error={errors.scheduleVariation}
                              className="nc-new-patient__nutritionField--full nc-new-patient__nutritionField--conditional"
                            >
                              <div className="nc-new-patient__nutritionSelectControl">
                                <select
                                  id="field-new-patient-schedule-variation"
                                  {...register("scheduleVariation")}
                                >
                                  <option value="">
                                    {t(
                                      "patient.wizard.nutrition_select_schedule_variation",
                                    )}
                                  </option>
                                  {(
                                    [
                                      "weekendsLater",
                                      "weekendsEarlier",
                                      "workdays",
                                      "rotatingShifts",
                                      "irregular",
                                    ] as const
                                  ).map((variation) => (
                                    <option key={variation} value={variation}>
                                      {t(
                                        `patient.wizard.nutrition_schedule_${variation}`,
                                      )}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown aria-hidden="true" />
                              </div>
                            </NutritionField>
                          )}
                        </div>
                      </fieldset>
                    </section>
                  )}

                  {step === 5 && nutritionSection === "patterns" && (
                    <section className="nc-new-patient__nutritionRoutine nc-new-patient__nutritionPatterns">
                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--patterns">
                        <legend>
                          {t("patient.wizard.nutrition_consumption_patterns")}
                        </legend>
                        <div className="nc-new-patient__nutritionThreeColumns">
                          <NutritionField
                            label={t("patient.wizard.nutrition_eating_out")}
                            htmlFor="field-new-patient-eating-out"
                            error={errors.eatingOutFrequency}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-eating-out"
                                {...register("eatingOutFrequency")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "never",
                                    "rarely",
                                    "oneToTwoPerWeek",
                                    "threeToFourPerWeek",
                                    "daily",
                                  ] as const
                                ).map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {t(
                                      `patient.wizard.nutrition_eating_out_${frequency}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionBinaryField
                            label={t(
                              "patient.wizard.nutrition_snacks_between_meals",
                            )}
                            field="snacksBetweenMeals"
                            register={register}
                            error={errors.snacksBetweenMeals}
                          />
                          <NutritionBinaryField
                            label={t(
                              "patient.wizard.nutrition_eats_late_at_night",
                            )}
                            field="eatsLateAtNight"
                            register={register}
                            error={errors.eatsLateAtNight}
                          />
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--patterns">
                        <legend>
                          {t("patient.wizard.nutrition_cravings_behavior")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <div className="nc-new-patient__nutritionConditionalGroup nc-new-patient__nutritionConditionalGroup--full">
                            <NutritionBinaryField
                              label={t(
                                "patient.wizard.nutrition_frequent_cravings",
                              )}
                              field="frequentCravings"
                              register={register}
                              error={errors.frequentCravings}
                            />
                            {frequentCravings === "yes" && (
                              <NutritionField
                                label={t(
                                  "patient.wizard.nutrition_craving_time",
                                )}
                                htmlFor="field-new-patient-craving-time"
                                error={errors.cravingTime}
                              >
                                <div className="nc-new-patient__nutritionSelectControl">
                                  <select
                                    id="field-new-patient-craving-time"
                                    {...register("cravingTime")}
                                  >
                                    <option value="">
                                      {t("patient.wizard.select_option")}
                                    </option>
                                    {(
                                      [
                                        "morning",
                                        "afternoon",
                                        "evening",
                                        "night",
                                        "variable",
                                      ] as const
                                    ).map((time) => (
                                      <option key={time} value={time}>
                                        {t(
                                          `patient.wizard.nutrition_craving_time_${time}`,
                                        )}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown aria-hidden="true" />
                                </div>
                              </NutritionField>
                            )}
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--patterns">
                        <legend>
                          {t("patient.wizard.nutrition_food_environment")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <NutritionField
                            label={t("patient.wizard.nutrition_meal_preparer")}
                            htmlFor="field-new-patient-meal-preparer"
                            error={errors.mealPreparer}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-meal-preparer"
                                {...register("mealPreparer")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "self",
                                    "partner",
                                    "family",
                                    "householdHelp",
                                    "preparedFood",
                                    "varies",
                                  ] as const
                                ).map((preparer) => (
                                  <option key={preparer} value={preparer}>
                                    {t(
                                      `patient.wizard.nutrition_preparer_${preparer}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionField
                            label={t("patient.wizard.nutrition_meal_location")}
                            optionalLabel={t("common.optional")}
                            htmlFor="field-new-patient-meal-location"
                            error={errors.primaryMealLocation}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-meal-location"
                                {...register("primaryMealLocation")}
                              >
                                <option value="">
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "home",
                                    "work",
                                    "school",
                                    "restaurant",
                                    "street",
                                    "varies",
                                  ] as const
                                ).map((location) => (
                                  <option key={location} value={location}>
                                    {t(
                                      `patient.wizard.nutrition_location_${location}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                        </div>
                      </fieldset>
                    </section>
                  )}

                  {step === 5 && nutritionSection === "preferences" && (
                    <section className="nc-new-patient__nutritionRoutine nc-new-patient__nutritionPreferences">
                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--plain">
                        <legend>
                          {t("patient.wizard.nutrition_preferences_general")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <div className="nc-new-patient__nutritionConditionalGroup">
                            <NutritionField
                              label={t(
                                "patient.wizard.nutrition_usual_diet_type",
                              )}
                              htmlFor="field-new-patient-usual-diet-type"
                              error={errors.usualDietType}
                            >
                              <div className="nc-new-patient__nutritionSelectControl">
                                <select
                                  id="field-new-patient-usual-diet-type"
                                  {...register("usualDietType")}
                                >
                                  <option value="" disabled>
                                    {t("patient.wizard.select_option")}
                                  </option>
                                  {(
                                    [
                                      "omnivore",
                                      "vegetarian",
                                      "vegan",
                                      "pescatarian",
                                      "mediterranean",
                                      "lowCarb",
                                      "other",
                                    ] as const
                                  ).map((dietType) => (
                                    <option key={dietType} value={dietType}>
                                      {t(
                                        `patient.wizard.nutrition_diet_${dietType}`,
                                      )}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown aria-hidden="true" />
                              </div>
                            </NutritionField>
                            {usualDietType === "other" && (
                              <NutritionField
                                label={t(
                                  "patient.wizard.nutrition_other_diet_label",
                                )}
                                htmlFor="field-new-patient-other-diet-description"
                                error={errors.otherDietDescription}
                              >
                                <Input
                                  id="field-new-patient-other-diet-description"
                                  placeholder={t(
                                    "patient.wizard.nutrition_other_diet_placeholder",
                                  )}
                                  {...register("otherDietDescription")}
                                />
                              </NutritionField>
                            )}
                          </div>
                          <div className="nc-new-patient__nutritionConditionalGroup">
                            <NutritionBinaryField
                              label={t("patient.wizard.nutrition_avoids_foods")}
                              field="avoidsFoods"
                              register={register}
                              error={errors.avoidsFoods}
                            />
                            {avoidsFoods === "yes" && (
                              <NutritionField
                                label={t(
                                  "patient.wizard.nutrition_avoided_foods_label",
                                )}
                                htmlFor="field-new-patient-avoided-foods"
                                error={errors.avoidedFoods}
                              >
                                <Textarea
                                  id="field-new-patient-avoided-foods"
                                  rows={2}
                                  placeholder={t(
                                    "patient.wizard.nutrition_avoided_foods_placeholder",
                                  )}
                                  {...register("avoidedFoods")}
                                />
                              </NutritionField>
                            )}
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--plain">
                        <legend>
                          {t("patient.wizard.nutrition_restrictions_tolerance")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <div className="nc-new-patient__nutritionConditionalGroup">
                            <NutritionBinaryField
                              label={t(
                                "patient.wizard.nutrition_food_restrictions",
                              )}
                              field="followsFoodRestrictions"
                              register={register}
                              error={errors.followsFoodRestrictions}
                            />
                            {followsFoodRestrictions === "yes" && (
                              <NutritionField
                                label={t(
                                  "patient.wizard.nutrition_food_restriction_details_label",
                                )}
                                htmlFor="field-new-patient-food-restriction-details"
                                error={errors.foodRestrictionDetails}
                              >
                                <Textarea
                                  id="field-new-patient-food-restriction-details"
                                  rows={2}
                                  placeholder={t(
                                    "patient.wizard.nutrition_food_restriction_details_placeholder",
                                  )}
                                  {...register("foodRestrictionDetails")}
                                />
                              </NutritionField>
                            )}
                          </div>
                          <div className="nc-new-patient__nutritionConditionalGroup">
                            <NutritionBinaryField
                              label={t(
                                "patient.wizard.nutrition_food_discomfort",
                              )}
                              field="hasFoodDiscomfort"
                              register={register}
                              error={errors.hasFoodDiscomfort}
                            />
                            {hasFoodDiscomfort === "yes" && (
                              <NutritionField
                                label={t(
                                  "patient.wizard.nutrition_discomfort_foods_label",
                                )}
                                htmlFor="field-new-patient-discomfort-foods"
                                error={errors.discomfortFoods}
                              >
                                <Textarea
                                  id="field-new-patient-discomfort-foods"
                                  rows={2}
                                  placeholder={t(
                                    "patient.wizard.nutrition_discomfort_foods_placeholder",
                                  )}
                                  {...register("discomfortFoods")}
                                />
                              </NutritionField>
                            )}
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--plain">
                        <legend>
                          {t("patient.wizard.nutrition_special_preferences")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_special_preference",
                            )}
                            htmlFor="field-new-patient-special-preference"
                            error={errors.specialEatingPreference}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-special-preference"
                                {...register("specialEatingPreference")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "none",
                                    "lowSodium",
                                    "lowSugar",
                                    "lowFat",
                                    "softTextures",
                                    "temperatureSensitive",
                                    "other",
                                  ] as const
                                ).map((preference) => (
                                  <option key={preference} value={preference}>
                                    {t(
                                      `patient.wizard.nutrition_special_${preference}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_preference_notes",
                            )}
                            optionalLabel={t("common.optional")}
                            htmlFor="field-new-patient-preference-notes"
                            error={errors.foodPreferenceNotes}
                            className="nc-new-patient__nutritionField--notes"
                          >
                            <Textarea
                              id="field-new-patient-preference-notes"
                              rows={2}
                              placeholder={t(
                                "patient.wizard.nutrition_preference_notes_placeholder",
                              )}
                              {...register("foodPreferenceNotes")}
                            />
                          </NutritionField>
                        </div>
                      </fieldset>
                    </section>
                  )}

                  {step === 5 && nutritionSection === "hydration" && (
                    <section className="nc-new-patient__nutritionRoutine nc-new-patient__nutritionHydration">
                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--patterns">
                        <legend>
                          {t("patient.wizard.nutrition_daily_hydration")}
                        </legend>
                        <div className="nc-new-patient__nutritionThreeColumns">
                          <NutritionField
                            label={t("patient.wizard.nutrition_water_intake")}
                            htmlFor="field-new-patient-water-intake"
                            error={errors.waterIntake}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-water-intake"
                                {...register("waterIntake")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "lessThanOneLiter",
                                    "oneToOneAndHalfLiters",
                                    "oneAndHalfToTwoLiters",
                                    "twoToThreeLiters",
                                    "moreThanThreeLiters",
                                  ] as const
                                ).map((intake) => (
                                  <option key={intake} value={intake}>
                                    {t(
                                      `patient.wizard.nutrition_water_${intake}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionBinaryField
                            label={t(
                              "patient.wizard.nutrition_water_throughout_day",
                            )}
                            field="drinksWaterThroughoutDay"
                            register={register}
                            error={errors.drinksWaterThroughoutDay}
                          />
                          <NutritionBinaryField
                            label={t("patient.wizard.nutrition_carries_bottle")}
                            field="carriesWaterBottle"
                            register={register}
                            error={errors.carriesWaterBottle}
                          />
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--patterns">
                        <legend>
                          {t("patient.wizard.nutrition_frequent_beverages")}
                        </legend>
                        <div className="nc-new-patient__nutritionThreeColumns">
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_coffee_tea_frequency",
                            )}
                            htmlFor="field-new-patient-coffee-tea"
                            error={errors.coffeeTeaFrequency}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-coffee-tea"
                                {...register("coffeeTeaFrequency")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "never",
                                    "occasional",
                                    "onePerDay",
                                    "oneToTwoPerDay",
                                    "threeOrMorePerDay",
                                  ] as const
                                ).map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {t(
                                      `patient.wizard.nutrition_coffee_${frequency}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_sugary_drink_frequency",
                            )}
                            htmlFor="field-new-patient-sugary-drinks"
                            error={errors.sugaryDrinkFrequency}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-sugary-drinks"
                                {...register("sugaryDrinkFrequency")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "never",
                                    "oneToTwoPerWeek",
                                    "threeToFourPerWeek",
                                    "daily",
                                    "multiplePerDay",
                                  ] as const
                                ).map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {t(
                                      `patient.wizard.nutrition_sugary_${frequency}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionBinaryField
                            label={t("patient.wizard.nutrition_energy_drinks")}
                            field="consumesEnergyDrinks"
                            register={register}
                            error={errors.consumesEnergyDrinks}
                          />
                          <NutritionField
                            label={t("patient.wizard.nutrition_other_beverage")}
                            htmlFor="field-new-patient-other-beverage"
                            error={errors.otherBeverage}
                            className="nc-new-patient__nutritionField--full"
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-other-beverage"
                                {...register("otherBeverage")}
                              >
                                <option value="" disabled>
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "none",
                                    "infusions",
                                    "flavoredWater",
                                    "juice",
                                    "sportsDrinks",
                                    "other",
                                  ] as const
                                ).map((beverage) => (
                                  <option key={beverage} value={beverage}>
                                    {t(
                                      `patient.wizard.nutrition_beverage_${beverage}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel nc-new-patient__nutritionPanel--patterns">
                        <legend>
                          {t("patient.wizard.nutrition_alcohol_observations")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_alcohol_frequency",
                            )}
                            optionalLabel={t("common.optional")}
                            htmlFor="field-new-patient-alcohol-frequency"
                            error={errors.alcoholFrequency}
                          >
                            <div className="nc-new-patient__nutritionSelectControl">
                              <select
                                id="field-new-patient-alcohol-frequency"
                                {...register("alcoholFrequency")}
                              >
                                <option value="">
                                  {t("patient.wizard.select_option")}
                                </option>
                                {(
                                  [
                                    "never",
                                    "monthlyOrLess",
                                    "twoToFourPerMonth",
                                    "twoToThreePerWeek",
                                    "fourOrMorePerWeek",
                                  ] as const
                                ).map((frequency) => (
                                  <option key={frequency} value={frequency}>
                                    {t(
                                      `patient.wizard.nutrition_alcohol_${frequency}`,
                                    )}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown aria-hidden="true" />
                            </div>
                          </NutritionField>
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_hydration_notes",
                            )}
                            optionalLabel={t("common.optional")}
                            htmlFor="field-new-patient-hydration-notes"
                            error={errors.hydrationNotes}
                            className="nc-new-patient__nutritionField--notes"
                          >
                            <Textarea
                              id="field-new-patient-hydration-notes"
                              rows={2}
                              placeholder={t(
                                "patient.wizard.nutrition_hydration_notes_placeholder",
                              )}
                              {...register("hydrationNotes")}
                            />
                          </NutritionField>
                        </div>
                      </fieldset>
                    </section>
                  )}

                  {step === 5 && nutritionSection === "digestive" && (
                    <section className="nc-new-patient__nutritionRoutine nc-new-patient__nutritionDigestive">
                      <fieldset className="nc-new-patient__nutritionPanel">
                        <legend>
                          {t("patient.wizard.nutrition_appetite")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          <div className="nc-new-patient__nutritionField">
                            <span>
                              {t("patient.wizard.nutrition_appetite_level")}
                            </span>
                            <div
                              className="nc-new-patient__nutritionChoice"
                              role="radiogroup"
                              aria-label={t(
                                "patient.wizard.nutrition_appetite_level",
                              )}
                            >
                              {(
                                ["low", "normal", "high", "variable"] as const
                              ).map((level) => (
                                <label key={level}>
                                  <input
                                    type="radio"
                                    value={level}
                                    {...register("appetiteLevel")}
                                  />
                                  <span>
                                    {t(
                                      `patient.wizard.nutrition_appetite_${level}`,
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                            {errors.appetiteLevel?.message && (
                              <small role="alert">
                                {errors.appetiteLevel.message}
                              </small>
                            )}
                          </div>
                          <NutritionBinaryField
                            label={t("patient.wizard.nutrition_early_satiety")}
                            field="earlySatiety"
                            register={register}
                            error={errors.earlySatiety}
                          />
                        </div>
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel">
                        <legend>
                          {t("patient.wizard.nutrition_digestive_discomfort")}
                        </legend>
                        <div className="nc-new-patient__digestiveQuestion">
                          <NutritionBinaryField
                            label={t(
                              "patient.wizard.nutrition_has_digestive_discomfort",
                            )}
                            field="hasDigestiveDiscomfort"
                            register={register}
                            error={errors.hasDigestiveDiscomfort}
                          />
                        </div>
                        {hasDigestiveDiscomfort === "yes" && (
                          <div className="nc-new-patient__digestiveSymptoms">
                            <span>
                              {t("patient.wizard.nutrition_select_symptoms")}
                            </span>
                            <div className="nc-new-patient__digestiveSymptomOptions">
                              {(
                                [
                                  {
                                    value: "reflux",
                                    icon: DigestiveStomachIcon,
                                  },
                                  {
                                    value: "bloating",
                                    icon: BloatingSymptomIcon,
                                  },
                                  { value: "gas", icon: GasSymptomIcon },
                                  { value: "nausea", icon: Frown },
                                  {
                                    value: "constipation",
                                    icon: Toilet,
                                  },
                                  { value: "diarrhea", icon: Waves },
                                  {
                                    value: "abdominalPain",
                                    icon: AbdominalPainSymptomIcon,
                                  },
                                  { value: "heartburn", icon: Flame },
                                  {
                                    value: "vomiting",
                                    icon: VomitingSymptomIcon,
                                  },
                                  { value: "belching", icon: Wind },
                                  {
                                    value: "abdominalCramps",
                                    icon: Zap,
                                  },
                                  { value: "other", icon: CircleEllipsis },
                                ] as const
                              ).map((symptom) => {
                                const SymptomIcon = symptom.icon;
                                return (
                                  <label key={symptom.value}>
                                    <input
                                      type="checkbox"
                                      value={symptom.value}
                                      {...register("digestiveSymptoms")}
                                    />
                                    <SymptomIcon aria-hidden="true" />
                                    <span>
                                      {t(
                                        `patient.wizard.nutrition_symptom_${symptom.value}`,
                                      )}
                                    </span>
                                    <CircleCheck aria-hidden="true" />
                                  </label>
                                );
                              })}
                            </div>
                            {digestiveSymptoms.includes("other") && (
                              <NutritionField
                                label={t(
                                  "patient.wizard.nutrition_other_symptom_label",
                                )}
                                htmlFor="field-new-patient-other-digestive-symptom"
                                error={errors.otherDigestiveSymptom}
                                className="nc-new-patient__digestiveOtherField"
                              >
                                <Input
                                  id="field-new-patient-other-digestive-symptom"
                                  placeholder={t(
                                    "patient.wizard.nutrition_other_symptom_placeholder",
                                  )}
                                  {...register("otherDigestiveSymptom")}
                                />
                              </NutritionField>
                            )}
                            {errors.digestiveSymptoms?.message && (
                              <small role="alert">
                                {errors.digestiveSymptoms.message}
                              </small>
                            )}
                          </div>
                        )}
                      </fieldset>

                      <fieldset className="nc-new-patient__nutritionPanel">
                        <legend>
                          {t("patient.wizard.nutrition_symptom_context")}
                        </legend>
                        <div className="nc-new-patient__nutritionTwoColumns">
                          {hasDigestiveDiscomfort === "yes" && (
                            <NutritionField
                              label={t(
                                "patient.wizard.nutrition_symptom_timing",
                              )}
                              htmlFor="field-new-patient-symptom-timing"
                              error={errors.symptomTiming}
                            >
                              <div className="nc-new-patient__nutritionSelectControl">
                                <select
                                  id="field-new-patient-symptom-timing"
                                  {...register("symptomTiming")}
                                >
                                  <option value="">
                                    {t("patient.wizard.select_option")}
                                  </option>
                                  {(
                                    [
                                      "duringMeals",
                                      "afterMeals",
                                      "morning",
                                      "night",
                                      "variable",
                                    ] as const
                                  ).map((timing) => (
                                    <option key={timing} value={timing}>
                                      {t(
                                        `patient.wizard.nutrition_timing_${timing}`,
                                      )}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown aria-hidden="true" />
                              </div>
                            </NutritionField>
                          )}
                          <NutritionField
                            label={t(
                              "patient.wizard.nutrition_digestive_notes",
                            )}
                            optionalLabel={t("common.optional")}
                            htmlFor="field-new-patient-digestive-notes"
                            error={errors.digestiveNotes}
                            className="nc-new-patient__nutritionField--notes"
                          >
                            <Textarea
                              id="field-new-patient-digestive-notes"
                              rows={2}
                              placeholder={t(
                                "patient.wizard.nutrition_digestive_notes_placeholder",
                              )}
                              {...register("digestiveNotes")}
                            />
                          </NutritionField>
                        </div>
                      </fieldset>
                    </section>
                  )}

                  {step === 6 && (
                    <BinaryQuestion
                      field="physicalActivity"
                      question={t("patient.wizard.question_physical_activity")}
                      icon={RunningIcon}
                      register={register}
                      error={errors.physicalActivity}
                      wide
                    />
                  )}

                  {step === 7 && (
                    <>
                      <WizardField
                        label={t("patient.clinical_tags")}
                        htmlFor="field-new-patient-tags"
                        error={errors.clinicalTags}
                        className="nc-new-patient__field--full"
                      >
                        <IconInput icon={Tags}>
                          <Input
                            id="field-new-patient-tags"
                            placeholder={t("patient.clinical_tags_placeholder")}
                            {...register("clinicalTags")}
                          />
                        </IconInput>
                        <small className="nc-new-patient__fieldHint">
                          {t("patient.comma_separated")}
                        </small>
                      </WizardField>
                      <WizardField
                        label={t("patient.general_notes")}
                        htmlFor="field-new-patient-notes"
                        error={errors.generalNotes}
                        className="nc-new-patient__field--full"
                      >
                        <Textarea
                          id="field-new-patient-notes"
                          rows={7}
                          placeholder={t("patient.wizard.notes_placeholder")}
                          {...register("generalNotes")}
                        />
                      </WizardField>
                    </>
                  )}
                </div>

                {step === 0 && (
                  <div className="nc-new-patient__requiredCallout">
                    <Info aria-hidden="true" />
                    <span>
                      {t("patient.wizard.required_prefix")} <b>*</b>{" "}
                      {t("patient.wizard.required_suffix")}
                    </span>
                  </div>
                )}

                {step === 1 && showContactNotice && (
                  <div className="nc-new-patient__contactNotice" role="note">
                    <span
                      className="nc-new-patient__contactNoticeIcon"
                      aria-hidden="true"
                    >
                      <Info />
                    </span>
                    <div>
                      <strong>
                        {t("patient.wizard.contact_notice_title")}
                      </strong>
                      <p>{t("patient.wizard.contact_notice_description")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContactNotice(false)}
                      aria-label={t("common.close")}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div
                    className="nc-new-patient__contactNotice nc-new-patient__contactNotice--emergency"
                    role="note"
                  >
                    <span
                      className="nc-new-patient__contactNoticeIcon"
                      aria-hidden="true"
                    >
                      <Info />
                    </span>
                    <div>
                      <strong>
                        {t("patient.wizard.emergency_notice_title")}
                      </strong>
                      <p>{t("patient.wizard.emergency_notice_description")}</p>
                    </div>
                  </div>
                )}

                {step === 3 && showClinicalNotice && (
                  <div className="nc-new-patient__contactNotice" role="note">
                    <span
                      className="nc-new-patient__contactNoticeIcon"
                      aria-hidden="true"
                    >
                      <Info />
                    </span>
                    <div>
                      <strong>
                        {t("patient.wizard.clinical_notice_title")}
                      </strong>
                      <p>{t("patient.wizard.clinical_notice_description")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowClinicalNotice(false)}
                      aria-label={t("common.close")}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                )}

                <footer className="nc-new-patient__navigationCard">
                  <div className="nc-new-patient__progressBlock">
                    <strong>
                      {t("patient.wizard.step_count", {
                        current: step + 1,
                        total: steps.length,
                      })}
                    </strong>
                    <div
                      className="nc-new-patient__progressTrack"
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={steps.length}
                      aria-valuenow={step + 1}
                    >
                      <span
                        style={{
                          width: `${((step + 1) / steps.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="nc-new-patient__navigationActions">
                    {step > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goToPreviousStep}
                        disabled={submitting}
                      >
                        <ArrowLeft aria-hidden="true" />
                        {t("common.previous")}
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="nc-new-patient__primaryButton"
                      disabled={submitting}
                    >
                      {isLastStep
                        ? submitting
                          ? t("common.saving")
                          : t("patient.wizard.create_action")
                        : t("common.next")}
                      {isLastStep ? (
                        <Save aria-hidden="true" />
                      ) : (
                        <ArrowRight aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </footer>
              </section>
            </form>
          </main>
        </div>

        <ConfirmDialog
          open={navigationBlocker.state === "blocked"}
          onOpenChange={(open) => {
            if (!open && navigationBlocker.state === "blocked")
              navigationBlocker.reset();
          }}
          title={t("patient.wizard.cancel_title")}
          description={t("patient.wizard.cancel_description")}
          confirmLabel={t("patient.wizard.cancel_confirm")}
          cancelLabel={t("patient.wizard.continue_editing")}
          tone="warning"
          onConfirm={() => {
            if (navigationBlocker.state === "blocked")
              navigationBlocker.proceed();
          }}
        />
        <Dialog
          open={optionalMedicalInfoOpen}
          onOpenChange={setOptionalMedicalInfoOpen}
        >
          <DialogContent
            className="sm:max-w-lg"
            data-testid="optional-medical-info-dialog"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle
                  className="h-5 w-5 text-amber-500"
                  aria-hidden="true"
                />
                {t("patient.wizard.optional_medical_info_title")}
              </DialogTitle>
              <DialogDescription>
                {t("patient.wizard.optional_medical_info_description")}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <ul className="grid gap-1.5">
                {missingOptionalMedicalInfo.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span aria-hidden="true">&bull;</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("patient.wizard.optional_medical_info_later")}
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOptionalMedicalInfoSkipped(true);
                  setOptionalMedicalInfoOpen(false);
                  setStep(5);
                }}
              >
                {t("patient.wizard.optional_medical_info_skip")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const firstMissing = missingOptionalMedicalInfo[0];
                  if (!firstMissing) return;
                  setOptionalMedicalInfoOpen(false);
                  setStep(4);
                  setMedicalSection(firstMissing.section);
                  if (firstMissing.card) {
                    setMedicalDetailCollapsed(firstMissing.card, false);
                  }
                  window.setTimeout(() => setFocus(firstMissing.field), 0);
                }}
              >
                {t("patient.wizard.optional_medical_info_fill")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </>
  );
}

function PatientIllustration() {
  return (
    <div className="nc-new-patient__illustration" aria-hidden="true">
      <span className="nc-new-patient__illustrationDots" />
      <span className="nc-new-patient__illustrationShape" />
    </div>
  );
}

function WizardField({
  label,
  htmlFor,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className={`nc-new-patient__field ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <b aria-hidden="true">*</b>}
      </Label>
      {children}
      {error?.message && (
        <p id={errorId} role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

function NutritionField({
  label,
  optionalLabel,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  optionalLabel?: string;
  htmlFor: string;
  error?: FieldError;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`nc-new-patient__nutritionField ${className ?? ""}`.trim()}>
      <label htmlFor={htmlFor}>
        <span>{label}</span>
        {optionalLabel && <small>{optionalLabel}</small>}
      </label>
      {children}
      {error?.message && <small role="alert">{error.message}</small>}
    </div>
  );
}

function NutritionBinaryField({
  label,
  field,
  register,
  error,
}: {
  label: string;
  field:
    | "skipsMeals"
    | "scheduleVaries"
    | "snacksBetweenMeals"
    | "eatsLateAtNight"
    | "frequentCravings"
    | "avoidsFoods"
    | "followsFoodRestrictions"
    | "hasFoodDiscomfort"
    | "drinksWaterThroughoutDay"
    | "carriesWaterBottle"
    | "consumesEnergyDrinks"
    | "earlySatiety"
    | "hasDigestiveDiscomfort";
  register: UseFormRegister<NewPatientWizardValues>;
  error?: FieldError;
}) {
  const { t } = useTranslation();
  const labelId = `new-patient-${field}-label`;
  return (
    <div className="nc-new-patient__nutritionField">
      <span id={labelId}>{label}</span>
      <div
        className="nc-new-patient__nutritionBinary"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        <label>
          <input type="radio" value="yes" {...register(field)} />
          <span>{t("common.yes")}</span>
        </label>
        <label>
          <input type="radio" value="no" {...register(field)} />
          <span>{t("common.no")}</span>
        </label>
      </div>
      {error?.message && <small role="alert">{error.message}</small>}
    </div>
  );
}

function BinaryQuestion({
  field,
  question,
  icon: Icon,
  register,
  error,
  number,
  showDetail = false,
  detailComplete = false,
  collapsed = false,
  onCollapsedChange,
  collapsedSummary,
  children,
  wide = false,
}: {
  field: BinaryQuestionField;
  question: string;
  icon: LucideIcon;
  register: UseFormRegister<NewPatientWizardValues>;
  error?: FieldError;
  number?: number;
  showDetail?: boolean;
  detailComplete?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapsedSummary?: string;
  children?: React.ReactNode;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const noRegistration = register(field);

  return (
    <fieldset
      className="nc-new-patient__binaryQuestion"
      data-field={field}
      data-wide={wide || undefined}
      data-expanded={(showDetail && !collapsed) || undefined}
      data-collapsed={(showDetail && collapsed) || undefined}
      data-complete={detailComplete || undefined}
    >
      <legend className="sr-only">{question}</legend>
      <span className="nc-new-patient__binaryQuestionIcon" aria-hidden="true">
        <Icon />
        {showDetail && collapsed && detailComplete && (
          <CircleCheck className="nc-new-patient__medicalCompleteBadge" />
        )}
      </span>
      <strong>
        {number && <b>{number}.</b>}
        <span>{question}</span>
      </strong>
      <div className="nc-new-patient__binaryActions">
        <div className="nc-new-patient__binaryOptions">
          <label>
            <input type="radio" value="yes" {...register(field)} />
            <span>{t("common.yes")}</span>
          </label>
          <label>
            <input
              type="radio"
              value="no"
              {...noRegistration}
              onChange={(event) => {
                void noRegistration.onChange(event);
                onCollapsedChange?.(false);
              }}
            />
            <span>{t("common.no")}</span>
          </label>
        </div>
        {showDetail && (
          <button
            type="button"
            className="nc-new-patient__medicalDetailToggle"
            aria-expanded={!collapsed}
            aria-label={t(
              collapsed
                ? "patient.wizard.show_medical_details"
                : "patient.wizard.hide_medical_details",
            )}
            onClick={() => onCollapsedChange?.(!collapsed)}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        )}
      </div>
      {error?.message && <small role="alert">{error.message}</small>}
      {showDetail && collapsed && (
        <span className="nc-new-patient__medicalCollapsedSummary">
          {detailComplete ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <CircleEllipsis aria-hidden="true" />
          )}
          {detailComplete && collapsedSummary
            ? collapsedSummary
            : t("patient.wizard.medical_details_pending")}
        </span>
      )}
      {showDetail && !collapsed && children && (
        <div className="nc-new-patient__medicalDetail">{children}</div>
      )}
    </fieldset>
  );
}

function ClinicalDetailField({
  label,
  htmlFor,
  error,
  required = false,
  full = false,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="nc-new-patient__clinicalDetailField"
      data-full={full || undefined}
    >
      <label htmlFor={htmlFor}>
        {label}
        {required && <b aria-hidden="true">*</b>}
      </label>
      {children}
      {error?.message && <small role="alert">{error.message}</small>}
    </div>
  );
}

function ClinicalBinaryDetail({
  label,
  field,
  register,
  error,
}: {
  label: string;
  field: Path<NewPatientWizardValues>;
  register: UseFormRegister<NewPatientWizardValues>;
  error?: FieldError;
}) {
  const { t } = useTranslation();
  return (
    <div className="nc-new-patient__clinicalBinaryDetail">
      <span>{label}</span>
      <div>
        <label>
          <input type="radio" value="yes" {...register(field)} />
          <span>{t("common.yes")}</span>
        </label>
        <label>
          <input type="radio" value="no" {...register(field)} />
          <span>{t("common.no")}</span>
        </label>
      </div>
      {error?.message && <small role="alert">{error.message}</small>}
    </div>
  );
}

function FamilyHistorySelect({
  field,
  label,
  icon: Icon,
  control,
}: {
  field: FamilyHistoryField;
  label: string;
  icon: LucideIcon;
  control: Control<NewPatientWizardValues>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const selectRef = React.useRef<HTMLDivElement>(null);
  const optionsId = React.useId();
  const options: Array<{ value: FamilyRelationship; label: string }> =
    FAMILY_RELATIONSHIP_VALUES.map((value) => ({
      value,
      label: t(`patient.wizard.family_member_${value}`),
    }));

  React.useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const select = selectRef.current;
      if (select && !event.composedPath().includes(select)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [open]);

  return (
    <Controller
      name={field}
      control={control}
      render={({ field: controlledField, fieldState }) => {
        const selected = Array.isArray(controlledField.value)
          ? (controlledField.value as FamilyRelationship[])
          : [];
        const displayValue = getFamilySelectionLabel(selected, options, t);

        const toggleOption = (value: FamilyRelationship) => {
          if (value === "none") {
            controlledField.onChange(["none"]);
            setOpen(false);
            return;
          }

          const current = selected.filter((item) => item !== "none");
          controlledField.onChange(
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          );
        };

        return (
          <div
            className="nc-new-patient__familyField"
            data-family-field={field}
          >
            <label>
              <Icon aria-hidden="true" />
              {label}
            </label>
            <div
              ref={selectRef}
              className="nc-new-patient__familySelect"
              data-open={open || undefined}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            >
              <button
                type="button"
                className="nc-new-patient__familySelectTrigger"
                aria-label={`${label}: ${displayValue}`}
                aria-expanded={open}
                aria-controls={optionsId}
                onClick={() => setOpen((current) => !current)}
              >
                <span data-placeholder={selected.length === 0 || undefined}>
                  {displayValue}
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {open && (
                <div
                  id={optionsId}
                  className="nc-new-patient__familySelectOptions"
                  role="group"
                  aria-label={label}
                >
                  {options.map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={selected.includes(option.value)}
                        onChange={() => toggleOption(option.value)}
                        onBlur={controlledField.onBlur}
                      />
                      <span aria-hidden="true">
                        <CircleCheck />
                      </span>
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
              <input
                type="hidden"
                name={field}
                value={selected.join(",")}
                readOnly
              />
            </div>
            {fieldState.error?.message && (
              <small role="alert">{fieldState.error.message}</small>
            )}
          </div>
        );
      }}
    />
  );
}

function IconInput({
  icon: Icon,
  alignTop = false,
  children,
}: {
  icon: LucideIcon;
  alignTop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="nc-new-patient__iconInput"
      data-align-top={alignTop || undefined}
    >
      <Icon aria-hidden="true" />
      {children}
    </div>
  );
}

function optionalContact(schema: z.ZodTypeAny, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => !value || schema.safeParse(value).success, message);
}

function requiredContact(schema: z.ZodTypeAny, message: string) {
  return z
    .string()
    .trim()
    .min(1, "Requerido")
    .refine((value) => schema.safeParse(value).success, message);
}

const MAX_PATIENT_PHOTO_BYTES = 5 * 1024 * 1024;
const PATIENT_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error());
    reader.onerror = () => reject(reader.error ?? new Error());
    reader.readAsDataURL(file);
  });
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function optionalString(value?: string): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function getFamilySelectionLabel(
  selected: FamilyRelationship[],
  options: Array<{ value: FamilyRelationship; label: string }>,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (selected.length === 0) {
    return t("patient.wizard.family_select_placeholder");
  }
  const labels = selected.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  );
  if (labels.length <= 2) return labels.join(", ");
  return t("patient.wizard.family_selected_count", { count: labels.length });
}

function hasRecordedFamilyHistory(values: NewPatientWizardValues): boolean {
  return [
    values.familyDiabetes,
    values.familyHypertension,
    values.familyObesity,
    values.familyCardiovascular,
    values.familyDyslipidemia,
    values.familyKidneyDisease,
    values.familyThyroidDisease,
  ].some((selection) => selection.some((member) => member !== "none"));
}

function parseTags(value?: string): string[] {
  return value
    ? value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];
}

function birthDateFromAge(age: number, today: Date = new Date()): Date {
  return new Date(
    today.getFullYear() - age,
    today.getMonth(),
    today.getDate(),
    12,
  );
}
