import * as React from "react";
import { X, Pill, AlertTriangle, CalendarDays, Users, Heart, Activity, Dumbbell, Apple, ChevronDown, ChevronRight, Stethoscope, Syringe, TestTube, UtensilsCrossed, Sparkles, Check, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@i18n/config";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@components/ui/dialog";
import { toast } from "sonner";
import { ConsentService, type PatientConsent } from "@modules/auth/PatientConsentService";
import { SeverityLabel, type Severity } from "../domain/Allergy";
import { EventTypeLabel, type EventType } from "../domain/ClinicalEvent";
import { MedicationFreqLabel } from "../domain/Medication";
import { FamilyRelationshipLabel, ConditionLabel } from "../domain/FamilyHistory";
import { PersonalConditionLabel } from "../domain/PersonalHistory";
import { HabitCategoryLabel } from "../domain/Habit";
import { ActivityTypeLabel, BorgIntensityLabel } from "../domain/PhysicalActivity";
import { DietTypeLabel, MealPlaceLabel } from "../domain/DietHistory";
import { MechanismLabel, IntoleranceSeverityLabel, type IntoleranceSeverity } from "../domain/Intolerance";
import { useAllergies, useMedications, useClinicalEvents, useFamilyHistories, usePersonalHistories, useHabits, usePhysicalActivities, useDietHistory, useIntolerances, useSurgeries, useHospitalizations, useSupplements, useFoodFrequencies, useGiSymptoms } from "./useClinicalRecordHooks";
import { SurgeryTypeLabel } from "../domain/Surgery";
import { FrequencyValueLabel } from "../domain/FoodFrequency";
import { GiSymptomTypeLabel } from "../domain/GiSymptom";
import { SupplementCategoryLabel } from "../domain/Supplement";
import { useBlockedFoods, useFoodWarnings } from "./useClinicalRuleHooks";
import { AddAllergyDialog, AddMedicationDialog, AddClinicalEventDialog, AddFamilyHistoryDialog, AddPersonalHistoryDialog, AddHabitDialog, AddPhysicalActivityDialog, AddDietHistoryDialog, AddIntoleranceDialog, AddSurgeryDialog, AddHospitalizationDialog, AddSupplementDialog, AddFoodFrequencyDialog, AddGiSymptomDialog } from "./ClinicalRecordDialogs";
import { PatientId } from "@modules/patient/domain/PatientId";
import { usePreferencesStore, DEFAULT_CLINICAL_SECTION_IDS, type ClinicalSectionId } from "@store/preferencesStore";
import type { AllergyFormData, MedicationFormData, ClinicalEventFormData, FamilyHistoryFormData, PersonalHistoryFormData, HabitFormData, PhysicalActivityFormData, DietHistoryFormData, IntoleranceFormData, SurgeryFormData, HospitalizationFormData, SupplementFormData, FoodFrequencyFormData, GiSymptomFormData } from "../application/clinicalRecordSchemas";

const SECTION_COMPONENT: Record<ClinicalSectionId, React.ComponentType<{ patientId: string }>> = {
  allergies: AllergyCard,
  medications: MedicationCard,
  clinicalEvents: ClinicalEventCard,
  familyHistory: FamilyHistoryCard,
  personalHistory: PersonalHistoryCard,
  habits: HabitCard,
  physicalActivity: PhysicalActivityCard,
  dietHistory: DietHistoryCard,
  intolerances: IntoleranceCard,
  surgeries: SurgeryCard,
  hospitalizations: HospitalizationCard,
  supplements: SupplementCard,
  foodFrequency: FoodFrequencyCard,
  giSymptoms: GiSymptomCard,
  aiConsent: AiConsentCard,
};

export function ClinicalRecordCards({ patientId }: { patientId: string }) {
  useTranslation();
  const sectionIds = usePreferencesStore((s) => s.clinicalSectionIds);
  const activeIds = sectionIds.length > 0 ? sectionIds : DEFAULT_CLINICAL_SECTION_IDS;

  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {activeIds.map((id) => {
        const CardComponent = SECTION_COMPONENT[id];
        return CardComponent ? <CardComponent key={id} patientId={patientId} /> : null;
      })}
    </div>
  );
}

function AllergyCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useAllergies(patientId);
  const { data: blocked } = useBlockedFoods(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: AllergyFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {i18n.t("clinical_record.allergies")} ({data.length})
          {blocked.length > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs">{blocked.length} {i18n.t("clinical_record.blocked")}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddAllergyDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_allergies")}</p>
          ) : (
            <>
              {data.map((a) => (
                <div key={a.id.toString()} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.allergen}</span>
                    <div className="flex items-center gap-1">
                      <SeverityBadge severity={a.severity} />
                      <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(a.id.toString()); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.reaction}</p>
                </div>
              ))}
              {blocked.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    {i18n.t("clinical_record.blocked_foods")} ({blocked.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                    {blocked.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function MedicationCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useMedications(patientId);
  const [open, setOpen] = React.useState(false);
  const active = data.filter((m) => m.isActive);
  const onSave = (form: MedicationFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Pill className="h-4 w-4 text-blue-500" />
          {i18n.t("clinical_record.medications")} ({i18n.t("clinical_record.active_count", { count: active.length })})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddMedicationDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_medications")}</p>
          ) : (
            data.map((m) => (
              <div key={m.id.toString()} className={`rounded-md border p-2 text-sm ${!m.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.name}</span>
                  <div className="flex items-center gap-1">
                    {!m.isActive && <Badge variant="outline">{i18n.t("common.inactive")}</Badge>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(m.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {m.dose} · {i18n.t("clinical_record.options.medication_frequency." + m.frequency, { defaultValue: MedicationFreqLabel[m.frequency] })} · {m.route}
                </p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ClinicalEventCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useClinicalEvents(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: ClinicalEventFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-purple-500" />
          {i18n.t("clinical_record.clinical_events")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddClinicalEventDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_events")}</p>
          ) : (
            data.map((e) => (
              <div key={e.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{e.name}</span>
                  <div className="flex items-center gap-1">
                    <EventTypeBadge type={e.type} />
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(e.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(e.date).toLocaleDateString("es-MX")}
                  {e.description ? ` — ${e.description}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, "default" | "secondary" | "destructive" | "outline"> = {
    leve: "secondary",
    moderada: "default",
    severa: "destructive",
    anafilaxia: "destructive",
  };
  return <Badge variant={map[severity]}>{i18n.t("clinical_record.options.severity." + severity, { defaultValue: SeverityLabel[severity] })}</Badge>;
}

function EventTypeBadge({ type }: { type: EventType }) {
  return <Badge variant="outline">{i18n.t("clinical_record.options.event_type." + type, { defaultValue: EventTypeLabel[type] })}</Badge>;
}

function FamilyHistoryCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useFamilyHistories(patientId);
  const [open, setOpen] = React.useState(false);

  const onSave = (form: FamilyHistoryFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-emerald-500" />
          {i18n.t("clinical_record.family_history")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddFamilyHistoryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_histories")}</p>
          ) : (
            data.map((f) => (
              <div key={f.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i18n.t("clinical_record.options.family_relationship." + f.relationship, { defaultValue: FamilyRelationshipLabel[f.relationship] })}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{i18n.t("clinical_record.options.family_condition." + f.condition, { defaultValue: ConditionLabel[f.condition] })}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(f.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {f.diagnosisAge !== null && (
                  <p className="text-xs text-muted-foreground mt-1">{i18n.t("clinical_record.diagnosis_age")}: {f.diagnosisAge} {i18n.t("clinical_record.years")}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PersonalHistoryCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = usePersonalHistories(patientId);
  const [open, setOpen] = React.useState(false);

  const onSave = (form: PersonalHistoryFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Heart className="h-4 w-4 text-rose-500" />
          {i18n.t("clinical_record.personal_history")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddPersonalHistoryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_histories")}</p>
          ) : (
            data.map((p) => (
              <div key={p.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i18n.t("clinical_record.options.personal_condition." + p.condition, { defaultValue: PersonalConditionLabel[p.condition] })}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={p.status === "activo" ? "default" : "secondary"}>{p.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(p.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {p.diagnosisDate && (
                  <p className="text-xs text-muted-foreground mt-1">{i18n.t("clinical_record.diagnosis")}: {new Date(p.diagnosisDate).toLocaleDateString("es-MX")}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function HabitCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useHabits(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: HabitFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-orange-500" />
          {i18n.t("clinical_record.habits")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddHabitDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_habits")}</p>
          ) : (
            data.map((h) => (
              <div key={h.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i18n.t("clinical_record.options.habit_category." + h.category, { defaultValue: HabitCategoryLabel[h.category] })}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{h.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(h.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {h.frequency && (
                  <p className="text-xs text-muted-foreground mt-1">{i18n.t("clinical_record.frequency")}: {h.frequency}{h.quantity ? ` · ${h.quantity}` : ""}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PhysicalActivityCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = usePhysicalActivities(patientId);
  const [open, setOpen] = React.useState(false);
  const active = data.filter((a) => a.isActive);
  const onSave = (form: PhysicalActivityFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Dumbbell className="h-4 w-4 text-indigo-500" />
          {i18n.t("clinical_record.physical_activity")} ({i18n.t("clinical_record.active_count_f", { count: active.length })})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddPhysicalActivityDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_activity")}</p>
          ) : (
            data.map((a) => (
              <div key={a.id.toString()} className={`rounded-md border p-2 text-sm ${!a.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i18n.t("clinical_record.options.activity_type." + a.type, { defaultValue: ActivityTypeLabel[a.type] })}</span>
                  <div className="flex items-center gap-1">
                    {!a.isActive && <Badge variant="outline">{i18n.t("common.inactive")}</Badge>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(a.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.frequencyPerWeek}x/sem · {a.durationMinutes} min · {i18n.t("clinical_record.options.borg_intensity." + a.intensity, { defaultValue: BorgIntensityLabel[a.intensity] })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DietHistoryCard({ patientId }: { patientId: string }) {
  const { data, loading, save } = useDietHistory(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: DietHistoryFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Apple className="h-4 w-4 text-green-500" />
          {i18n.t("clinical_record.diet_history")}
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddDietHistoryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : !data ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_diet_history")}</p>
          ) : (
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">{i18n.t("clinical_record.diet_type")}:</span> {i18n.t("clinical_record.options.diet_type." + data.dietType, { defaultValue: DietTypeLabel[data.dietType] })}</p>
              <p><span className="font-medium">{i18n.t("clinical_record.meals_per_day")}:</span> {data.mealsPerDay}</p>
              <p><span className="font-medium">{i18n.t("clinical_record.meal_schedule")}:</span> {data.mealSchedule || "—"}</p>
              <p><span className="font-medium">{i18n.t("clinical_record.meal_place")}:</span> {i18n.t("clinical_record.options.meal_place." + data.mealPlace, { defaultValue: MealPlaceLabel[data.mealPlace] })}</p>
              <p><span className="font-medium">{i18n.t("clinical_record.meal_preparer")}:</span> {data.mealPreparer || "—"}</p>
              <p><span className="font-medium">{i18n.t("clinical_record.budget")}:</span> {data.budget || "—"}</p>
              <p><span className="font-medium">{i18n.t("clinical_record.household_people")}:</span> {data.householdPeople}</p>
              {data.labelReading && (
                <p><span className="font-medium">{i18n.t("clinical_record.label_reading")}:</span> {i18n.t("clinical_record.yes")}</p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function IntoleranceCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useIntolerances(patientId);
  const { data: warnings } = useFoodWarnings(patientId);
  const [open, setOpen] = React.useState(false);

  const onSave = (form: IntoleranceFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          {i18n.t("clinical_record.intolerances")} ({data.length})
          {warnings.length > 0 && (
            <Badge variant="warning" className="ml-1 text-xs">{warnings.length} {i18n.t("clinical_record.cards.food_alerts")}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddIntoleranceDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_intolerances")}</p>
          ) : (
            <>
              {data.map((i) => (
                <div key={i.id.toString()} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{i.food}</span>
                    <div className="flex items-center gap-1">
                      <IntoleranceSeverityBadge severity={i.severity} />
                      <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(i.id.toString()); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{i.symptom}</p>
                  <p className="text-xs text-muted-foreground">
                    {i18n.t("clinical_record.options.mechanism." + i.mechanism, { defaultValue: MechanismLabel[i.mechanism] })}
                    {i.thresholdDose ? ` · ${i18n.t("clinical_record.threshold_dose")}: ${i.thresholdDose}` : ""}
                  </p>
                </div>
              ))}
              {warnings.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    {i18n.t("clinical_record.cards.food_warnings")} ({warnings.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                    {warnings.map((w, i) => (
                      <li key={i}>{w.intoleranceFood} ({w.severity})</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function IntoleranceSeverityBadge({ severity }: { severity: IntoleranceSeverity }) {
  const map: Record<IntoleranceSeverity, "default" | "secondary" | "destructive"> = {
    leve: "secondary", moderada: "default", severa: "destructive",
  };
  return <Badge variant={map[severity]}>{i18n.t("clinical_record.options.intolerance_severity." + severity, { defaultValue: IntoleranceSeverityLabel[severity] })}</Badge>;
}

function SurgeryCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useSurgeries(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: SurgeryFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Stethoscope className="h-4 w-4 text-sky-500" />
          {i18n.t("clinical_record.surgeries")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddSurgeryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_surgeries")}</p>
          ) : (
            data.map((s) => (
              <div key={s.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i18n.t("clinical_record.options.surgery_type." + s.type, { defaultValue: SurgeryTypeLabel[s.type] })}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{new Date(s.date).toLocaleDateString("es-MX")}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(s.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.hospital}{s.complications ? ` · ${i18n.t("clinical_record.complications")}: ${s.complications}` : ""}</p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function HospitalizationCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useHospitalizations(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: HospitalizationFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Syringe className="h-4 w-4 text-violet-500" />
          {i18n.t("clinical_record.hospitalizations")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddHospitalizationDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_hospitalizations")}</p>
          ) : (
            data.map((h) => (
              <div key={h.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.reason}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(h.id.toString()); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {i18n.t("clinical_record.cards.admission_label")}: {new Date(h.admissionDate).toLocaleDateString("es-MX")}
                  {h.dischargeDate ? ` · ${i18n.t("clinical_record.cards.discharge_label")}: ${new Date(h.dischargeDate).toLocaleDateString("es-MX")}` : ""}
                  {h.stayDays > 0 ? ` · ${i18n.t("clinical_record.stay_days", { count: h.stayDays })}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{h.hospital}</p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SupplementCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useSupplements(patientId);
  const [open, setOpen] = React.useState(false);
  const active = data.filter((s) => !s.endDate || new Date(s.endDate) > new Date());
  const onSave = (form: SupplementFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TestTube className="h-4 w-4 text-teal-500" />
          {i18n.t("clinical_record.supplements")} ({i18n.t("clinical_record.active_count", { count: active.length })})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddSupplementDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_supplements")}</p>
          ) : (
            data.map((s) => (
              <div key={s.id.toString()} className={`rounded-md border p-2 text-sm ${s.endDate && new Date(s.endDate) <= new Date() ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{i18n.t("clinical_record.options.supplement_category." + s.category, { defaultValue: SupplementCategoryLabel[s.category] })}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(s.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.dose}{s.dose && s.frequency ? " · " : ""}{s.frequency}{s.brand ? ` · ${s.brand}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function FoodFrequencyCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useFoodFrequencies(patientId);
  const [open, setOpen] = React.useState(false);
  const onSave = (form: FoodFrequencyFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <UtensilsCrossed className="h-4 w-4 text-yellow-500" />
          {i18n.t("clinical_record.consumption_frequency")} ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddFoodFrequencyDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_frequencies")}</p>
          ) : (
            data.map((f) => (
              <div key={f.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.foodGroupName || f.foodGroupId}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{i18n.t("clinical_record.options.food_frequency." + f.frequency, { defaultValue: FrequencyValueLabel[f.frequency] })}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(f.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.quantity ? `${i18n.t("clinical_record.quantity")}: ${f.quantity}` : ""}
                  {f.preparation ? ` · ${i18n.t("clinical_record.preparation")}: ${f.preparation}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function GiSymptomCard({ patientId }: { patientId: string }) {
  const { data, loading, save, remove } = useGiSymptoms(patientId);
  const [open, setOpen] = React.useState(false);
  const severe = data.filter((s) => s.severity >= 7);
  const onSave = (form: GiSymptomFormData) => save({ ...form, patientId: PatientId.fromUnsafe(patientId) });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          {i18n.t("clinical_record.gi_symptoms_short")} ({data.length}{severe.length > 0 ? ` · ${i18n.t("clinical_record.severe_count", { count: severe.length })}` : ""})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddGiSymptomDialog onSave={onSave} />
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.no_symptoms")}</p>
          ) : (
            data.map((s) => (
              <div key={s.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{i18n.t("clinical_record.options.gi_symptom_type." + s.symptomType, { defaultValue: GiSymptomTypeLabel[s.symptomType] })}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={s.severity >= 7 ? "destructive" : s.severity >= 4 ? "default" : "secondary"}>{s.severity}/10</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={i18n.t("common.delete")} onClick={async () => { await remove(s.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.frequency}{s.description ? ` · ${s.description}` : ""}
                </p>
                {s.foodRelation && (
                  <p className="text-xs text-muted-foreground">{i18n.t("clinical_record.relationship")}: {s.foodRelation}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AiConsentCard({ patientId }: { patientId: string }) {
  const [open, setOpen] = React.useState(false);
  const [showDialog, setShowDialog] = React.useState(false);
  const [consents, setConsents] = React.useState<PatientConsent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await ConsentService.listByPatient(patientId);
      setConsents(list);
      setActive(await ConsentService.isConsentActive(patientId, "ai_opt_in"));
    } catch {
      setConsents([]);
      setActive(false);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { load(); }, [load]);

  const handleRecord = async () => {
    setSubmitting(true);
    try {
      await ConsentService.recordConsent({
        id: crypto.randomUUID(),
        patient_id: patientId,
        type: "ai_opt_in",
        signed_at: new Date().toISOString(),
        expires_at: null,
        revoked_at: null,
      });
      toast.success(i18n.t("clinical_record.ai_consent_recorded"));
      setShowDialog(false);
      await load();
    } catch {
      toast.error(i18n.t("clinical_record.ai_consent_error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    const activeConsent = consents.find((c) => c.type === "ai_opt_in" && !c.revoked_at);
    if (!activeConsent) return;
    setSubmitting(true);
    try {
      await ConsentService.revokeConsent(activeConsent.id);
      toast.success(i18n.t("clinical_record.ai_consent_revoked"));
      await load();
    } catch {
      toast.error(i18n.t("clinical_record.ai_consent_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-purple-500" />
          {i18n.t("clinical_record.ai_assist")}
          {!loading && (
            active
              ? <Badge variant="default" className="text-xs">{i18n.t("clinical_record.ai_consent_active")}</Badge>
              : <Badge variant="secondary" className="text-xs">{i18n.t("clinical_record.ai_consent_inactive")}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowDialog(true)}>
            {active ? <XCircle className="mr-1 h-3 w-3" /> : <Check className="mr-1 h-3 w-3" />}
            {active ? i18n.t("clinical_record.revoke") : i18n.t("clinical_record.record")}
          </Button>
          <Button variant="ghost" size="icon" aria-label={open ? i18n.t("clinical_record.collapse_section") : i18n.t("clinical_record.expand_section")} onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{i18n.t("clinical_record.ai_no_consents")}</p>
          ) : (
            consents.map((c) => {
              const isActive = !c.revoked_at && (!c.expires_at || new Date(c.expires_at) > new Date());
              return (
                <div key={c.id} className={`rounded-md border p-2 text-sm ${isActive ? "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{i18n.t("clinical_record.ai_consent")}</span>
                    <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                      {isActive ? i18n.t("clinical_record.active") : i18n.t("clinical_record.revoked")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {i18n.t("clinical_record.signed_at")}: {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(c.signed_at))}
                  </p>
                  {c.revoked_at && (
                    <p className="text-xs text-muted-foreground">
                      {i18n.t("clinical_record.revoked_at")}: {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(c.revoked_at))}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{i18n.t("clinical_record.ai_consent_dialog_title")}</DialogTitle>
            <DialogDescription>
              {active
                ? i18n.t("clinical_record.ai_consent_dialog_revoke_desc")
                : i18n.t("clinical_record.ai_consent_dialog_record_desc")
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
              {i18n.t("common.cancel")}
            </Button>
            {active ? (
              <Button type="button" variant="destructive" disabled={submitting} onClick={handleRevoke}>
                {submitting ? i18n.t("common.loading") : i18n.t("clinical_record.revoke")}
              </Button>
            ) : (
              <Button type="button" disabled={submitting} onClick={handleRecord}>
                {submitting ? i18n.t("common.loading") : i18n.t("clinical_record.record")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
