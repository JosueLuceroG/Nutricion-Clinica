import * as React from "react";
import { ChefHat, ClipboardList, FileText, FlaskConical, UserRound } from "lucide-react";
import { db } from "@services/db";
import { recipeService } from "@services/recipeService";
import type { Recipe } from "@modules/recipes/domain/Recipe";
import { LAB_TEST_DEFINITIONS } from "@modules/laboratory/domain/LabTest";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";
import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { MealPlanRow } from "@modules/mealplan/infrastructure/mealPlanMapper";
import type { LabPanelRow } from "@modules/laboratory/infrastructure/labPanelMapper";
import type { AppointmentRow } from "@modules/agenda/infrastructure/agendaMapper";
import {
  AppointmentStatusLabel,
  AppointmentStatusSchema,
} from "@modules/agenda/domain/AppointmentStatus";
import {
  AppointmentTypeLabel,
  AppointmentTypeSchema,
} from "@modules/agenda/domain/AppointmentType";
import { normalizeSearchPhone, toCalendarDateKey } from "./globalSearchEngine";
import type {
  GlobalSearchAccess,
  GlobalSearchResult,
} from "./globalSearchTypes";

interface GlobalSearchDataState {
  results: GlobalSearchResult[];
  loading: boolean;
  error: string | null;
  scope: string | null;
}

interface SearchRecipeRecord {
  recipe: Recipe;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  derivedAllergens: string[];
}

interface RecipeSearchLoad {
  items: SearchRecipeRecord[];
  nutritionAvailable: boolean;
}

const SEARCH_SOURCE_IDS = [
  "patients",
  "consultations",
  "plans",
  "laboratory",
  "agenda",
  "recipes",
] as const;

const EMPTY_STATE: GlobalSearchDataState = {
  results: [],
  loading: false,
  error: null,
  scope: null,
};

function fullName(row: {
  first_name: string;
  last_name: string;
  second_last_name: string | null;
}): string {
  return [row.first_name, row.last_name, row.second_last_name]
    .filter(Boolean)
    .join(" ");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dateParts(
  value: string,
  locale: string,
): { key: string; display: string; searchable: string } {
  const key = toCalendarDateKey(value);
  if (!key) {
    const noDate = locale.startsWith("en") ? "No date" : "Sin fecha";
    return { key: "", display: noDate, searchable: String(value ?? "") };
  }
  const [year, month, day] = key.split("-").map(Number);
  const calendarDate = new Date(year!, month! - 1, day!, 12);
  const display = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(calendarDate)
    .replace(".", "");
  return { key, display, searchable: `${key} ${display}` };
}

function labelFor(
  value: string,
  locale: string,
  labels: Record<string, string>,
  spanishLabels: Record<string, string>,
): string {
  if (locale.startsWith("en")) return labels[value] ?? value;
  return spanishLabels[value] ?? value;
}

const PATIENT_STATUS_EN: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
  deceased: "Deceased",
};
const PATIENT_STATUS_ES: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  archived: "Archivado",
  deceased: "Fallecido",
};
const CONSULTATION_STATUS_EN: Record<string, string> = {
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
const CONSULTATION_STATUS_ES: Record<string, string> = {
  scheduled: "Agendada",
  "in-progress": "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};
const PLAN_STATUS_EN: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};
const PLAN_STATUS_ES: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  completed: "Completado",
  cancelled: "Cancelado",
};
const APPOINTMENT_STATUS_EN: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  rescheduled: "Rescheduled",
};
const APPOINTMENT_TYPE_EN: Record<string, string> = {
  primera_vez: "First visit",
  seguimiento: "Follow-up",
  urgencia: "Urgent",
  control: "Check-up",
  cierre: "Closing visit",
};

async function loadRecipesForSearch(): Promise<RecipeSearchLoad> {
  try {
    const recipes = await recipeService.listWithNutrition();
    return {
      items: recipes.map((recipe) => ({
        recipe,
        kcal: recipe.kcal,
        proteinG: recipe.proteinG,
        carbsG: recipe.carbsG,
        fatG: recipe.fatG,
        derivedAllergens: recipe.derivedAllergens,
      })),
      nutritionAvailable: true,
    };
  } catch (error) {
    console.warn(
      "[global-search] Recipe nutrition unavailable; loading recipes without calories.",
      error,
    );
    const recipes = await recipeService.list();
    return {
      items: recipes.map((recipe) => ({
        recipe,
        kcal: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        derivedAllergens: [],
      })),
      nutritionAvailable: false,
    };
  }
}
const RECIPE_STATUS_ES: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};
const RECIPE_STATUS_EN: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};
const RECIPE_CATEGORY_ES: Record<string, string> = {
  entrada: "Entrada",
  plato_fuerte: "Plato fuerte",
  postre: "Postre",
  bebida: "Bebida",
  snack: "Snack",
};
const RECIPE_CATEGORY_EN: Record<string, string> = {
  entrada: "Starter",
  plato_fuerte: "Main dish",
  postre: "Dessert",
  bebida: "Drink",
  snack: "Snack",
};

function scopeKey(
  sucursalId: string,
  locale: string,
  access: GlobalSearchAccess,
): string {
  return [
    sucursalId,
    locale,
    access.patients,
    access.consultations,
    access.plans,
    access.laboratory,
    access.agenda,
    access.recipes,
  ].join(":");
}

export function useGlobalSearchData(
  open: boolean,
  activeSucursalId: string | null,
  locale: string,
  access: GlobalSearchAccess,
): Omit<GlobalSearchDataState, "scope"> {
  const [state, setState] = React.useState<GlobalSearchDataState>(EMPTY_STATE);
  const expectedScope = activeSucursalId
    ? scopeKey(activeSucursalId, locale, access)
    : null;

  React.useEffect(() => {
    if (!open || !activeSucursalId || !expectedScope) return;
    let cancelled = false;
    const shouldLoadPatients =
      access.patients ||
      access.consultations ||
      access.plans ||
      access.laboratory ||
      access.agenda;

    setState({ results: [], loading: true, error: null, scope: expectedScope });

    void Promise.allSettled([
      shouldLoadPatients
        ? db.patients
            .where("sucursal_id")
            .equals(activeSucursalId)
            .filter((row) => row.deleted_at === null)
            .toArray()
        : Promise.resolve([]),
      access.consultations
        ? db.consultations
            .where("sucursal_id")
            .equals(activeSucursalId)
            .filter((row) => row.deleted_at === null)
            .toArray()
        : Promise.resolve([]),
      access.plans
        ? db.meal_plans
            .where("sucursal_id")
            .equals(activeSucursalId)
            .filter((row) => row.deleted_at === null)
            .toArray()
        : Promise.resolve([]),
      access.laboratory
        ? db.lab_panels.filter((row) => row.deleted_at === null).toArray()
        : Promise.resolve([]),
      access.agenda
        ? db.appointments
            .filter((row) => row.office_id === activeSucursalId)
            .toArray()
        : Promise.resolve([]),
      access.recipes
        ? loadRecipesForSearch()
        : Promise.resolve({ items: [], nutritionAvailable: true }),
    ]).then((outcomes) => {
      if (cancelled) return;

      const patients = (outcomes[0]?.status === "fulfilled"
        ? outcomes[0].value
        : []) as PatientRow[];
      const consultations = (outcomes[1]?.status === "fulfilled"
        ? outcomes[1].value
        : []) as ConsultationRow[];
      const plans = (outcomes[2]?.status === "fulfilled"
        ? outcomes[2].value
        : []) as MealPlanRow[];
      const labPanels = (outcomes[3]?.status === "fulfilled"
        ? outcomes[3].value
        : []) as LabPanelRow[];
      const appointments = (outcomes[4]?.status === "fulfilled"
        ? outcomes[4].value
        : []) as AppointmentRow[];
      const recipeLoad = (outcomes[5]?.status === "fulfilled"
        ? outcomes[5].value
        : { items: [], nutritionAvailable: true }) as RecipeSearchLoad;
      const patientIds = new Set(patients.map((patient) => patient.id));
      const patientNames = new Map(
        patients.map((patient) => [patient.id, fullName(patient)]),
      );
      const genericPatient = locale.startsWith("en") ? "Patient" : "Paciente";

      const patientResults: GlobalSearchResult[] = access.patients
        ? patients
            .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
            .map((patient) => {
              const name = fullName(patient);
              const status = labelFor(
                patient.status,
                locale,
                PATIENT_STATUS_EN,
                PATIENT_STATUS_ES,
              );
              const contact = patient.phone || patient.email;
              const subtitle = [...new Set([contact, status].filter(Boolean))].join(" · ");
              return {
                id: `patient-${patient.id}`,
                kind: "patient",
                category: "patients",
                title: name,
                subtitle,
                searchableText: [
                  name,
                  patient.phone,
                  patient.secondary_phone,
                  normalizeSearchPhone(`${patient.phone ?? ""}${patient.secondary_phone ?? ""}`),
                  patient.email,
                  patient.status,
                  status,
                  patient.clave_interna,
                  patient.external_record_number,
                ]
                  .filter(Boolean)
                  .join(" "),
                icon: UserRound,
                tone: "green",
                path: `/pacientes/${patient.id}`,
                patientId: patient.id,
                canCreateForPatient: patient.status === "active",
                avatar: initials(name),
                avatarUrl: patient.photo_url,
                fields: {
                  phone: `${patient.phone ?? ""} ${patient.secondary_phone ?? ""}`,
                  email: patient.email ?? "",
                  status: patient.status,
                  patient: name,
                },
              } satisfies GlobalSearchResult;
            })
        : [];

      const consultationResults: GlobalSearchResult[] = consultations
        .filter((consultation) => patientIds.has(consultation.patient_id))
        .sort((a, b) => String(b.consultation_date).localeCompare(String(a.consultation_date)))
        .map((consultation) => {
          const patientName = patientNames.get(consultation.patient_id) ?? genericPatient;
          const date = dateParts(consultation.consultation_date, locale);
          const status = labelFor(
            consultation.status,
            locale,
            CONSULTATION_STATUS_EN,
            CONSULTATION_STATUS_ES,
          );
          const defaultReason = locale.startsWith("en")
            ? "Nutrition consultation"
            : "Consulta nutricional";
          const titlePrefix = locale.startsWith("en") ? "Consultation" : "Consulta";
          return {
            id: `consultation-${consultation.id}`,
            kind: "consultation",
            category: "consultations",
            title: `${titlePrefix} #${consultation.consultation_number} · ${patientName}`,
            subtitle: `${consultation.reason || defaultReason} · ${date.display} · ${status}`,
            searchableText: [
              patientName,
              consultation.reason,
              consultation.assessment,
              consultation.consultation_number,
              consultation.status,
              status,
              date.searchable,
            ]
              .filter(Boolean)
              .join(" "),
            icon: ClipboardList,
            tone: "purple",
            path: `/consultas/${consultation.id}`,
            patientId: consultation.patient_id,
            date: date.key,
            fields: { date: date.key, status: consultation.status, patient: patientName },
          };
        });

      const planResults: GlobalSearchResult[] = plans
        .filter((plan) => patientIds.has(plan.patient_id))
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .map((plan) => {
          const patientName = patientNames.get(plan.patient_id) ?? genericPatient;
          const startDate = dateParts(plan.start_date, locale);
          const endDate = plan.end_date ? dateParts(plan.end_date, locale) : null;
          const status = labelFor(
            plan.status,
            locale,
            PLAN_STATUS_EN,
            PLAN_STATUS_ES,
          );
          const dateRange = endDate
            ? `${startDate.display} - ${endDate.display}`
            : startDate.display;
          return {
            id: `plan-${plan.id}`,
            kind: "plan",
            category: "plans",
            title: plan.name,
            subtitle: `${patientName} · ${status} · ${dateRange} · ${plan.kcal_target} kcal`,
            searchableText: [
              plan.name,
              plan.description,
              plan.notes,
              patientName,
              plan.status,
              status,
              startDate.searchable,
              endDate?.searchable,
            ]
              .filter(Boolean)
              .join(" "),
            icon: FileText,
            tone: "green",
            path: `/planes/${plan.id}`,
            patientId: plan.patient_id,
            date: startDate.key,
            fields: {
              date: [startDate.key, endDate?.key].filter(Boolean).join(" "),
              status: plan.status,
              patient: patientName,
            },
          };
        });

      const laboratoryResults: GlobalSearchResult[] = labPanels
        .filter((panel) => patientIds.has(panel.patient_id))
        .sort((a, b) => String(b.taken_at).localeCompare(String(a.taken_at)))
        .map((panel) => {
          const patientName = patientNames.get(panel.patient_id) ?? genericPatient;
          const date = dateParts(panel.taken_at, locale);
          const testDefinitions = (Array.isArray(panel.results) ? panel.results : [])
            .map((result) => LAB_TEST_DEFINITIONS[result.test])
            .filter(Boolean);
          const testSummary = testDefinitions
            .slice(0, 3)
            .map((definition) => definition.shortName)
            .join(", ");
          const labResults = locale.startsWith("en")
            ? "Laboratory results"
            : "Resultados de laboratorio";
          return {
            id: `laboratory-${panel.id}`,
            kind: "laboratory",
            category: "laboratory",
            title: panel.lab_name || labResults,
            subtitle: [patientName, date.display, testSummary].filter(Boolean).join(" · "),
            searchableText: [
              patientName,
              panel.lab_name,
              panel.notes,
              ...testDefinitions.flatMap((definition) => [
                definition.code,
                definition.name,
                definition.shortName,
                definition.category,
              ]),
              date.searchable,
            ]
              .filter(Boolean)
              .join(" "),
            icon: FlaskConical,
            tone: "cyan",
            path: `/pacientes/${panel.patient_id}/laboratorio?panelId=${encodeURIComponent(panel.id)}`,
            patientId: panel.patient_id,
            date: date.key,
            fields: { date: date.key, patient: patientName },
          };
        });

      const appointmentResults: GlobalSearchResult[] = appointments
        .filter((appointment) => patientIds.has(appointment.patient_id))
        .sort((a, b) =>
          `${b.date}T${b.start_time}`.localeCompare(`${a.date}T${a.start_time}`),
        )
        .map((appointment) => {
          const patientName = patientNames.get(appointment.patient_id) ?? genericPatient;
          const date = dateParts(appointment.date, locale);
          const parsedStatus = AppointmentStatusSchema.safeParse(appointment.status);
          const parsedType = AppointmentTypeSchema.safeParse(appointment.type);
          const status = parsedStatus.success
            ? locale.startsWith("en")
              ? APPOINTMENT_STATUS_EN[parsedStatus.data]
              : AppointmentStatusLabel[parsedStatus.data]
            : appointment.status;
          const type = parsedType.success
            ? locale.startsWith("en")
              ? APPOINTMENT_TYPE_EN[parsedType.data]
              : AppointmentTypeLabel[parsedType.data]
            : appointment.type;
          const appointmentTitle = locale.startsWith("en") ? "Appointment" : "Cita";
          return {
            id: `appointment-${appointment.id}`,
            kind: "appointment",
            category: "consultations",
            title: `${appointmentTitle} · ${patientName}`,
            subtitle: `${appointment.reason || type} · ${date.display} ${appointment.start_time} · ${status}`,
            searchableText: [
              patientName,
              appointment.reason,
              appointment.notes,
              appointment.date,
              appointment.start_time,
              appointment.type,
              type,
              appointment.status,
              status,
            ]
              .filter(Boolean)
              .join(" "),
            icon: ClipboardList,
            tone: "purple",
            path: `/agenda?date=${encodeURIComponent(appointment.date)}&appointmentId=${encodeURIComponent(appointment.id)}`,
            patientId: appointment.patient_id,
            date: date.key,
            fields: { date: date.key, status: appointment.status, patient: patientName },
          };
        });

      const recipeResults: GlobalSearchResult[] = recipeLoad.items
        .sort((a, b) => b.recipe.updatedAt - a.recipe.updatedAt)
        .map((record) => {
          const { recipe } = record;
          const status = labelFor(
            recipe.status,
            locale,
            RECIPE_STATUS_EN,
            RECIPE_STATUS_ES,
          );
          const category = labelFor(
            recipe.category,
            locale,
            RECIPE_CATEGORY_EN,
            RECIPE_CATEGORY_ES,
          );
          const kcalTotal = record.kcal;
          const kcalPerServing = kcalTotal !== null && recipe.servings > 0
            ? kcalTotal / recipe.servings
            : null;
          const totalLabel = locale.startsWith("en")
            ? "total kcal"
            : "kcal totales";
          const servingLabel = locale.startsWith("en")
            ? "kcal/serving"
            : "kcal/porción";
          return {
            id: `recipe-${recipe.id}`,
            kind: "recipe",
            category: "recipes",
            title: recipe.name,
            subtitle: kcalTotal !== null && kcalPerServing !== null
              ? `${category} · ${status} · ${Math.round(kcalTotal)} ${totalLabel} · ${Math.round(kcalPerServing)} ${servingLabel}`
              : `${category} · ${status}`,
            searchableText: [
              recipe.name,
              recipe.description,
              recipe.cuisine,
              recipe.category,
              category,
              recipe.difficulty,
              recipe.status,
              status,
              ...recipe.tags,
              ...recipe.allergens,
              ...record.derivedAllergens,
              ...recipe.ingredients.map((ingredient) => ingredient.name),
            ]
              .filter(Boolean)
              .join(" "),
            icon: ChefHat,
            tone: "cyan",
            path: `/recetas?recipeId=${encodeURIComponent(recipe.id)}`,
            fields: {
              status: recipe.status,
              ...(kcalTotal !== null
                ? { kcalTotal: String(kcalTotal) }
                : {}),
              ...(kcalPerServing !== null
                ? { kcalPerServing: String(kcalPerServing) }
                : {}),
            },
          };
        });

      const failedSources: string[] = outcomes.flatMap((outcome, index) => {
        if (outcome.status !== "rejected") return [];
        const source = SEARCH_SOURCE_IDS[index];
        console.warn(`[global-search] Failed to load ${source}.`, outcome.reason);
        return source ? [source] : [];
      });
      if (access.recipes && !recipeLoad.nutritionAvailable) {
        failedSources.push("recipeNutrition");
      }

      setState({
        results: [
          ...patientResults,
          ...consultationResults,
          ...appointmentResults,
          ...planResults,
          ...laboratoryResults,
          ...recipeResults,
        ],
        loading: false,
        error: failedSources.length > 0 ? failedSources.join(",") : null,
        scope: expectedScope,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    access,
    access.agenda,
    access.consultations,
    access.laboratory,
    access.patients,
    access.plans,
    access.recipes,
    activeSucursalId,
    expectedScope,
    locale,
    open,
  ]);

  if (!open || !activeSucursalId || !expectedScope) {
    return { results: [], loading: false, error: null };
  }
  if (state.scope !== expectedScope) {
    return { results: [], loading: true, error: null };
  }
  return { results: state.results, loading: state.loading, error: state.error };
}
