import * as React from "react";
import { X, Pill, AlertTriangle, CalendarDays, Users, Heart, Activity, Dumbbell, Apple, ChevronDown, ChevronRight, Stethoscope, Syringe, TestTube, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
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
import type { AllergyFormData, MedicationFormData, ClinicalEventFormData, FamilyHistoryFormData, PersonalHistoryFormData, HabitFormData, PhysicalActivityFormData, DietHistoryFormData, IntoleranceFormData, SurgeryFormData, HospitalizationFormData, SupplementFormData, FoodFrequencyFormData, GiSymptomFormData } from "../application/clinicalRecordSchemas";

export function ClinicalRecordCards({ patientId }: { patientId: string }) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AllergyCard patientId={patientId} />
      <MedicationCard patientId={patientId} />
      <ClinicalEventCard patientId={patientId} />
      <FamilyHistoryCard patientId={patientId} />
      <PersonalHistoryCard patientId={patientId} />
      <HabitCard patientId={patientId} />
      <PhysicalActivityCard patientId={patientId} />
      <DietHistoryCard patientId={patientId} />
      <IntoleranceCard patientId={patientId} />
      <SurgeryCard patientId={patientId} />
      <HospitalizationCard patientId={patientId} />
      <SupplementCard patientId={patientId} />
      <FoodFrequencyCard patientId={patientId} />
      <GiSymptomCard patientId={patientId} />
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
          Alergias ({data.length})
          {blocked.length > 0 && (
            <Badge variant="destructive" className="ml-1 text-xs">{blocked.length} bloqueados</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddAllergyDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alergias registradas</p>
          ) : (
            <>
              {data.map((a) => (
                <div key={a.id.toString()} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.allergen}</span>
                    <div className="flex items-center gap-1">
                      <SeverityBadge severity={a.severity} />
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(a.id.toString()); }}>
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
                    Alimentos bloqueados ({blocked.length})
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
          Medicamentos ({active.length} activos)
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddMedicationDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin medicamentos registrados</p>
          ) : (
            data.map((m) => (
              <div key={m.id.toString()} className={`rounded-md border p-2 text-sm ${!m.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.name}</span>
                  <div className="flex items-center gap-1">
                    {!m.isActive && <Badge variant="outline">Inactivo</Badge>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(m.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {m.dose} · {MedicationFreqLabel[m.frequency]} · {m.route}
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
          Eventos clínicos ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddClinicalEventDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos registrados</p>
          ) : (
            data.map((e) => (
              <div key={e.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{e.name}</span>
                  <div className="flex items-center gap-1">
                    <EventTypeBadge type={e.type} />
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(e.id.toString()); }}>
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
  return <Badge variant={map[severity]}>{SeverityLabel[severity]}</Badge>;
}

function EventTypeBadge({ type }: { type: EventType }) {
  return <Badge variant="outline">{EventTypeLabel[type]}</Badge>;
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
          Antecedentes familiares ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddFamilyHistoryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin antecedentes registrados</p>
          ) : (
            data.map((f) => (
              <div key={f.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{FamilyRelationshipLabel[f.relationship]}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{ConditionLabel[f.condition]}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(f.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {f.diagnosisAge !== null && (
                  <p className="text-xs text-muted-foreground mt-1">Edad diagnóstico: {f.diagnosisAge} años</p>
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
          Antecedentes personales ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddPersonalHistoryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin antecedentes registrados</p>
          ) : (
            data.map((p) => (
              <div key={p.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{PersonalConditionLabel[p.condition]}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={p.status === "activo" ? "default" : "secondary"}>{p.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(p.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {p.diagnosisDate && (
                  <p className="text-xs text-muted-foreground mt-1">Diagnóstico: {new Date(p.diagnosisDate).toLocaleDateString("es-MX")}</p>
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
          Hábitos ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddHabitDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin hábitos registrados</p>
          ) : (
            data.map((h) => (
              <div key={h.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{HabitCategoryLabel[h.category]}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{h.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(h.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {h.frequency && (
                  <p className="text-xs text-muted-foreground mt-1">Frecuencia: {h.frequency}{h.quantity ? ` · ${h.quantity}` : ""}</p>
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
          Actividad física ({active.length} activas)
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddPhysicalActivityDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividad registrada</p>
          ) : (
            data.map((a) => (
              <div key={a.id.toString()} className={`rounded-md border p-2 text-sm ${!a.isActive ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{ActivityTypeLabel[a.type]}</span>
                  <div className="flex items-center gap-1">
                    {!a.isActive && <Badge variant="outline">Inactiva</Badge>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(a.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.frequencyPerWeek}x/sem · {a.durationMinutes} min · {BorgIntensityLabel[a.intensity]}
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
          Historia dietética
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddDietHistoryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : !data ? (
            <p className="text-sm text-muted-foreground">Sin historia dietética registrada</p>
          ) : (
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Tipo de dieta:</span> {DietTypeLabel[data.dietType]}</p>
              <p><span className="font-medium">Comidas al día:</span> {data.mealsPerDay}</p>
              <p><span className="font-medium">Horarios:</span> {data.mealSchedule || "—"}</p>
              <p><span className="font-medium">Lugar de comida:</span> {MealPlaceLabel[data.mealPlace]}</p>
              <p><span className="font-medium">Quien prepara:</span> {data.mealPreparer || "—"}</p>
              <p><span className="font-medium">Presupuesto:</span> {data.budget || "—"}</p>
              <p><span className="font-medium">Personas en hogar:</span> {data.householdPeople}</p>
              {data.labelReading && (
                <p><span className="font-medium">Lectura de etiquetas:</span> Sí</p>
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
          Intolerancias ({data.length})
          {warnings.length > 0 && (
            <Badge variant="warning" className="ml-1 text-xs">{warnings.length} alimentos alerta</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddIntoleranceDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin intolerancias registradas</p>
          ) : (
            <>
              {data.map((i) => (
                <div key={i.id.toString()} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{i.food}</span>
                    <div className="flex items-center gap-1">
                      <IntoleranceSeverityBadge severity={i.severity} />
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(i.id.toString()); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{i.symptom}</p>
                  <p className="text-xs text-muted-foreground">
                    {MechanismLabel[i.mechanism]}
                    {i.thresholdDose ? ` · Dosis umbral: ${i.thresholdDose}` : ""}
                  </p>
                </div>
              ))}
              {warnings.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    Alimentos con advertencia ({warnings.length})
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
  return <Badge variant={map[severity]}>{IntoleranceSeverityLabel[severity]}</Badge>;
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
          Cirugías ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddSurgeryDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin cirugías registradas</p>
          ) : (
            data.map((s) => (
              <div key={s.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{SurgeryTypeLabel[s.type]}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{new Date(s.date).toLocaleDateString("es-MX")}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(s.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.hospital}{s.complications ? ` · Complicaciones: ${s.complications}` : ""}</p>
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
          Hospitalizaciones ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddHospitalizationDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin hospitalizaciones registradas</p>
          ) : (
            data.map((h) => (
              <div key={h.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.reason}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(h.id.toString()); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ingreso: {new Date(h.admissionDate).toLocaleDateString("es-MX")}
                  {h.dischargeDate ? ` · Egreso: ${new Date(h.dischargeDate).toLocaleDateString("es-MX")}` : ""}
                  {h.stayDays > 0 ? ` · ${h.stayDays} días` : ""}
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
          Suplementos ({active.length} activos)
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddSupplementDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin suplementos registrados</p>
          ) : (
            data.map((s) => (
              <div key={s.id.toString()} className={`rounded-md border p-2 text-sm ${s.endDate && new Date(s.endDate) <= new Date() ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{SupplementCategoryLabel[s.category]}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(s.id.toString()); }}>
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
          Frecuencia de consumo ({data.length})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddFoodFrequencyDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin frecuencias registradas</p>
          ) : (
            data.map((f) => (
              <div key={f.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.foodGroupName || f.foodGroupId}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline">{FrequencyValueLabel[f.frequency]}</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(f.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {f.quantity ? `Cantidad: ${f.quantity}` : ""}
                  {f.preparation ? ` · Preparación: ${f.preparation}` : ""}
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
          Síntomas GI ({data.length}{severe.length > 0 ? ` · ${severe.length} severos` : ""})
        </CardTitle>
        <div className="flex items-center gap-1">
          <AddGiSymptomDialog onSave={onSave} />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          {loading ? <Skeleton className="h-16 w-full" /> : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin síntomas registrados</p>
          ) : (
            data.map((s) => (
              <div key={s.id.toString()} className="rounded-md border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{GiSymptomTypeLabel[s.symptomType]}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant={s.severity >= 7 ? "destructive" : s.severity >= 4 ? "default" : "secondary"}>{s.severity}/10</Badge>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={async () => { await remove(s.id.toString()); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.frequency}{s.description ? ` · ${s.description}` : ""}
                </p>
                {s.foodRelation && (
                  <p className="text-xs text-muted-foreground">Relación: {s.foodRelation}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
