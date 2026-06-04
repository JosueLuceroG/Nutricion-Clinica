import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Plus } from "lucide-react";
import { allergyFormSchema, medicationFormSchema, clinicalEventFormSchema, familyHistoryFormSchema, personalHistoryFormSchema, habitFormSchema, physicalActivityFormSchema, dietHistoryFormSchema, intoleranceFormSchema, surgeryFormSchema, hospitalizationFormSchema, supplementFormSchema, foodFrequencyFormSchema, giSymptomFormSchema, type AllergyFormData, type MedicationFormData, type ClinicalEventFormData, type FamilyHistoryFormData, type PersonalHistoryFormData, type HabitFormData, type PhysicalActivityFormData, type DietHistoryFormData, type IntoleranceFormData, type SurgeryFormData, type HospitalizationFormData, type SupplementFormData, type FoodFrequencyFormData, type GiSymptomFormData } from "../application/clinicalRecordSchemas";
import { SeverityLabel, AllergyDiagnosisLabel } from "../domain/Allergy";
import { MedicationFreqLabel } from "../domain/Medication";
import { EventTypeLabel } from "../domain/ClinicalEvent";
import { FamilyRelationshipLabel, ConditionLabel } from "../domain/FamilyHistory";
import { PersonalConditionLabel } from "../domain/PersonalHistory";
import { HabitCategoryLabel } from "../domain/Habit";
import { ActivityTypeLabel, BorgIntensityLabel } from "../domain/PhysicalActivity";
import { DietTypeLabel, MealPlaceLabel } from "../domain/DietHistory";
import { MechanismLabel, IntoleranceSeverityLabel } from "../domain/Intolerance";
import { SurgeryTypeLabel } from "../domain/Surgery";
import { SupplementCategoryLabel } from "../domain/Supplement";
import { GiSymptomTypeLabel } from "../domain/GiSymptom";

function InputField({ id, label, value, onChange, placeholder, error, type }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function SelectField({ id, label, value, options, labels, onValueChange, error }: {
  id: string; label: string; value: string; options: readonly string[];
  labels?: Record<string, string>; onValueChange: (v: string) => void; error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{labels?.[o] ?? o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function AddAllergyDialog({ onSave }: { onSave: (data: AllergyFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [allergen, setAllergen] = React.useState("");
  const [reaction, setReaction] = React.useState("");
  const [severity, setSeverity] = React.useState("leve");
  const [diagnosis, setDiagnosis] = React.useState("clinico");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = allergyFormSchema.safeParse({ allergen, reaction, severity, diagnosis, notes: notes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setAllergen(""); setReaction(""); setSeverity("leve"); setDiagnosis("clinico"); setNotes("");
    } catch {
      setErrors({ allergen: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar alergia</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="allergen" label="Alérgeno" value={allergen} onChange={setAllergen} placeholder="Ej: maní, mariscos, gluten" error={errors.allergen} />
          <InputField id="reaction" label="Reacción" value={reaction} onChange={setReaction} placeholder="Ej: urticaria" error={errors.reaction} />
          <SelectField id="severity" label="Severidad" value={severity} options={["leve", "moderada", "severa", "anafilaxia"]} labels={SeverityLabel} onValueChange={setSeverity} error={errors.severity} />
          <SelectField id="diagnosis" label="Diagnóstico" value={diagnosis} options={["clinico", "prick", "rast", "desafio"]} labels={AllergyDiagnosisLabel} onValueChange={setDiagnosis} error={errors.diagnosis} />
          <InputField id="notes" label="Notas" value={notes} onChange={setNotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddMedicationDialog({ onSave }: { onSave: (data: MedicationFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [activeIngredient, setActiveIngredient] = React.useState("");
  const [dose, setDose] = React.useState("");
  const [frequency, setFrequency] = React.useState("cada-24h");
  const [route, setRoute] = React.useState("oral");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [prescribedBy, setPrescribedBy] = React.useState("");
  const [mnotes, setMnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = medicationFormSchema.safeParse({ name, activeIngredient, dose, frequency, route, startDate, endDate: endDate || undefined, prescribedBy: prescribedBy || undefined, notes: mnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setName(""); setActiveIngredient(""); setDose(""); setFrequency("cada-24h"); setRoute("oral");
      setStartDate(""); setEndDate(""); setPrescribedBy(""); setMnotes("");
    } catch {
      setErrors({ name: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar medicamento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="med-name" label="Nombre" value={name} onChange={setName} error={errors.name} />
          <InputField id="med-ing" label="Ingrediente activo" value={activeIngredient} onChange={setActiveIngredient} error={errors.activeIngredient} />
          <InputField id="med-dose" label="Dosis" value={dose} onChange={setDose} error={errors.dose} />
          <SelectField id="med-freq" label="Frecuencia" value={frequency} options={["cada-24h", "cada-12h", "cada-8h", "cada-6h", "cada-4h", "desayuno", "comida", "cena", "noches", "cuando-requiera"]} labels={MedicationFreqLabel} onValueChange={setFrequency} error={errors.frequency} />
          <InputField id="med-route" label="Vía" value={route} onChange={setRoute} error={errors.route} />
          <InputField id="med-start" label="Fecha inicio" type="date" value={startDate} onChange={setStartDate} error={errors.startDate} />
          <InputField id="med-end" label="Fecha fin" type="date" value={endDate} onChange={setEndDate} />
          <InputField id="med-by" label="Prescrito por" value={prescribedBy} onChange={setPrescribedBy} />
          <InputField id="med-notes" label="Notas" value={mnotes} onChange={setMnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddClinicalEventDialog({ onSave }: { onSave: (data: ClinicalEventFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState("evento-clinico");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [evnotes, setEvnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = clinicalEventFormSchema.safeParse({ type, name, description: description || undefined, date, endDate: endDate || undefined, notes: evnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setType("evento-clinico"); setName(""); setDescription(""); setDate(""); setEndDate(""); setEvnotes("");
    } catch {
      setErrors({ name: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar evento clínico</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="ev-type" label="Tipo" value={type} options={["antecedente-heredofamiliar", "antecedente-personal-patologico", "cirugia", "hospitalizacion", "sintoma-gastrointestinal", "evento-clinico"]} labels={EventTypeLabel} onValueChange={setType} error={errors.type} />
          <InputField id="ev-name" label="Nombre" value={name} onChange={setName} error={errors.name} />
          <InputField id="ev-desc" label="Descripción" value={description} onChange={setDescription} />
          <InputField id="ev-date" label="Fecha" type="date" value={date} onChange={setDate} error={errors.date} />
          <InputField id="ev-end" label="Fecha fin" type="date" value={endDate} onChange={setEndDate} />
          <InputField id="ev-notes" label="Notas" value={evnotes} onChange={setEvnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddFamilyHistoryDialog({ onSave }: { onSave: (data: FamilyHistoryFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [relationship, setRelationship] = React.useState("padre");
  const [condition, setCondition] = React.useState("obesidad");
  const [diagnosisAge, setDiagnosisAge] = React.useState("");
  const [fhnotes, setFhnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = familyHistoryFormSchema.safeParse({ relationship, condition, diagnosisAge: diagnosisAge === "" ? null : Number(diagnosisAge), notes: fhnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setRelationship("padre"); setCondition("obesidad"); setDiagnosisAge(""); setFhnotes("");
    } catch {
      setErrors({ relationship: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar antecedente familiar</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="fh-rel" label="Parentesco" value={relationship} options={["padre", "madre", "hermano", "hermana", "abuelo_paterno", "abuela_paterna", "abuelo_materno", "abuela_materna", "tio", "tia", "hijo", "hija", "otro"]} labels={FamilyRelationshipLabel} onValueChange={setRelationship} error={errors.relationship} />
          <SelectField id="fh-cond" label="Condición" value={condition} options={["diabetes", "hta", "obesidad", "cancer", "ecv", "erc", "tiroidea", "autoinmune", "osteoporosis", "dislipidemia", "otro"]} labels={ConditionLabel} onValueChange={setCondition} error={errors.condition} />
          <InputField id="fh-age" label="Edad diagnóstico" value={diagnosisAge} onChange={setDiagnosisAge} />
          <InputField id="fh-notes" label="Notas" value={fhnotes} onChange={setFhnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddPersonalHistoryDialog({ onSave }: { onSave: (data: PersonalHistoryFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [condition, setCondition] = React.useState("otro");
  const [diagnosisDate, setDiagnosisDate] = React.useState("");
  const [status, setStatus] = React.useState("activo");
  const [treatingPhysician, setTreatingPhysician] = React.useState("");
  const [treatment, setTreatment] = React.useState("");
  const [phnotes, setPhnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = personalHistoryFormSchema.safeParse({ condition, diagnosisDate: diagnosisDate || undefined, status, treatingPhysician: treatingPhysician || undefined, treatment: treatment || undefined, notes: phnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setCondition("otro"); setDiagnosisDate(""); setStatus("activo"); setTreatingPhysician(""); setTreatment(""); setPhnotes("");
    } catch {
      setErrors({ condition: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar antecedente personal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="ph-cond" label="Condición" value={condition} options={["diabetes_tipo_1", "diabetes_tipo_2", "hta", "dislipidemia", "obesidad", "erc", "higado_graso", "sindrome_metabolico", "tiroidea", "anemia", "gastrointestinal", "autoinmune", "cancer", "cardiopatia", "depresion", "trastorno_alimentario", "covid", "otro"]} labels={PersonalConditionLabel} onValueChange={setCondition} error={errors.condition} />
          <InputField id="ph-date" label="Fecha diagnóstico" type="date" value={diagnosisDate} onChange={setDiagnosisDate} />
          <InputField id="ph-status" label="Estado" value={status} onChange={setStatus} error={errors.status} />
          <InputField id="ph-phys" label="Médico tratante" value={treatingPhysician} onChange={setTreatingPhysician} />
          <InputField id="ph-treat" label="Tratamiento" value={treatment} onChange={setTreatment} />
          <InputField id="ph-notes" label="Notas" value={phnotes} onChange={setPhnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddHabitDialog({ onSave }: { onSave: (data: HabitFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState("smoking");
  const [status, setStatus] = React.useState("nunca");
  const [frequency, setFrequency] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [hnotes, setHnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = habitFormSchema.safeParse({ category, status, frequency: frequency || undefined, quantity: quantity || undefined, notes: hnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setCategory("smoking"); setStatus("nunca"); setFrequency(""); setQuantity(""); setHnotes("");
    } catch {
      setErrors({ category: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar hábito</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="hab-cat" label="Categoría" value={category} options={["smoking", "alcohol", "sleep", "stress", "hydration", "coffee", "ultraprocessed"]} labels={HabitCategoryLabel} onValueChange={setCategory} error={errors.category} />
          <InputField id="hab-status" label="Estado" value={status} onChange={setStatus} error={errors.status} />
          <InputField id="hab-freq" label="Frecuencia" value={frequency} onChange={setFrequency} />
          <InputField id="hab-qty" label="Cantidad" value={quantity} onChange={setQuantity} />
          <InputField id="hab-notes" label="Notas" value={hnotes} onChange={setHnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddPhysicalActivityDialog({ onSave }: { onSave: (data: PhysicalActivityFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [atype, setAtype] = React.useState("caminata");
  const [frequencyPerWeek, setFrequencyPerWeek] = React.useState(3);
  const [durationMinutes, setDurationMinutes] = React.useState(30);
  const [intensity, setIntensity] = React.useState("moderate");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [panotes, setPanotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = physicalActivityFormSchema.safeParse({ type: atype, frequencyPerWeek, durationMinutes, intensity, startDate: startDate || undefined, endDate: endDate || undefined, notes: panotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setAtype("caminata"); setFrequencyPerWeek(3); setDurationMinutes(30); setIntensity("moderate");
      setStartDate(""); setEndDate(""); setPanotes("");
    } catch {
      setErrors({ type: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar actividad física</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="pa-type" label="Tipo" value={atype} options={["caminata", "running", "natacion", "ciclismo", "pesas", "yoga", "pilates", "crossfit", "futbol", "basquetbol", "tenis", "baile", "artes_marciales", "otro"]} labels={ActivityTypeLabel} onValueChange={setAtype} error={errors.type} />
          <div className="space-y-2">
            <Label htmlFor="pa-freq">Veces por semana</Label>
            <Input id="pa-freq" type="number" value={frequencyPerWeek} onChange={(e) => setFrequencyPerWeek(Number(e.target.value))} />
            {errors.frequencyPerWeek && <p className="text-sm text-destructive">{errors.frequencyPerWeek}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-dur">Minutos por sesión</Label>
            <Input id="pa-dur" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            {errors.durationMinutes && <p className="text-sm text-destructive">{errors.durationMinutes}</p>}
          </div>
          <SelectField id="pa-int" label="Intensidad" value={intensity} options={["light", "moderate", "vigorous", "maximal"]} labels={BorgIntensityLabel} onValueChange={setIntensity} error={errors.intensity} />
          <InputField id="pa-start" label="Fecha inicio" type="date" value={startDate} onChange={setStartDate} />
          <InputField id="pa-end" label="Fecha fin" type="date" value={endDate} onChange={setEndDate} />
          <InputField id="pa-notes" label="Notas" value={panotes} onChange={setPanotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddDietHistoryDialog({ onSave }: { onSave: (data: DietHistoryFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [dietType, setDietType] = React.useState("omnivoro");
  const [mealsPerDay, setMealsPerDay] = React.useState(3);
  const [mealSchedule, setMealSchedule] = React.useState("");
  const [mealPlace, setMealPlace] = React.useState("hogar");
  const [mealPreparer, setMealPreparer] = React.useState("");
  const [timeAvailable, setTimeAvailable] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [kitchenEquipment, setKitchenEquipment] = React.useState("");
  const [previousDiets, setPreviousDiets] = React.useState("");
  const [labelReading, setLabelReading] = React.useState(false);
  const [nutritionalKnowledge, setNutritionalKnowledge] = React.useState("");
  const [preferences, setPreferences] = React.useState("");
  const [aversions, setAversions] = React.useState("");
  const [chewing, setChewing] = React.useState("");
  const [workSchedule, setWorkSchedule] = React.useState("");
  const [householdPeople, setHouseholdPeople] = React.useState(1);
  const [dhnotes, setDhnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { dietType, mealsPerDay, mealSchedule: mealSchedule || undefined, mealPlace: mealPlace || undefined, mealPreparer: mealPreparer || undefined, timeAvailable: timeAvailable || undefined, budget: budget || undefined, kitchenEquipment: kitchenEquipment || undefined, previousDiets: previousDiets || undefined, labelReading, nutritionalKnowledge: nutritionalKnowledge || undefined, preferences: preferences || undefined, aversions: aversions || undefined, chewing: chewing || undefined, workSchedule: workSchedule || undefined, householdPeople, notes: dhnotes || undefined };
    const result = dietHistoryFormSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setDietType("omnivoro"); setMealsPerDay(3); setMealSchedule(""); setMealPlace("hogar");
      setMealPreparer(""); setTimeAvailable(""); setBudget(""); setKitchenEquipment("");
      setPreviousDiets(""); setLabelReading(false); setNutritionalKnowledge(""); setPreferences("");
      setAversions(""); setChewing(""); setWorkSchedule(""); setHouseholdPeople(1); setDhnotes("");
    } catch {
      setErrors({ dietType: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar historia dietética</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto">
          <SelectField id="dh-type" label="Tipo de dieta" value={dietType} options={["omnivoro", "vegetariano", "vegano", "pescetariano", "keto", "paleo", "mediterraneo", "dash", "ayuno_intermitente", "otro"]} labels={DietTypeLabel} onValueChange={setDietType} error={errors.dietType} />
          <div className="space-y-2">
            <Label htmlFor="dh-meals">Comidas al día</Label>
            <Input id="dh-meals" type="number" value={mealsPerDay} onChange={(e) => setMealsPerDay(Number(e.target.value))} />
            {errors.mealsPerDay && <p className="text-sm text-destructive">{errors.mealsPerDay}</p>}
          </div>
          <InputField id="dh-sched" label="Horario" value={mealSchedule} onChange={setMealSchedule} />
          <SelectField id="dh-place" label="Lugar de comida" value={mealPlace} options={["hogar", "trabajo", "escuela", "restaurante", "calle", "otro"]} labels={MealPlaceLabel} onValueChange={setMealPlace} />
          <InputField id="dh-prep" label="Quién prepara" value={mealPreparer} onChange={setMealPreparer} />
          <InputField id="dh-time" label="Tiempo disponible" value={timeAvailable} onChange={setTimeAvailable} />
          <InputField id="dh-budget" label="Presupuesto" value={budget} onChange={setBudget} />
          <InputField id="dh-equip" label="Equipo de cocina" value={kitchenEquipment} onChange={setKitchenEquipment} />
          <InputField id="dh-diets" label="Dietas previas" value={previousDiets} onChange={setPreviousDiets} />
          <InputField id="dh-know" label="Conocimiento nutricional" value={nutritionalKnowledge} onChange={setNutritionalKnowledge} />
          <InputField id="dh-prefs" label="Preferencias" value={preferences} onChange={setPreferences} />
          <InputField id="dh-avers" label="Aversiones" value={aversions} onChange={setAversions} />
          <InputField id="dh-chew" label="Masticación" value={chewing} onChange={setChewing} />
          <InputField id="dh-work" label="Horario laboral" value={workSchedule} onChange={setWorkSchedule} />
          <div className="space-y-2">
            <Label htmlFor="dh-ppl">Personas en casa</Label>
            <Input id="dh-ppl" type="number" value={householdPeople} onChange={(e) => setHouseholdPeople(Number(e.target.value))} />
          </div>
          <InputField id="dh-notes" label="Notas" value={dhnotes} onChange={setDhnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddIntoleranceDialog({ onSave }: { onSave: (data: IntoleranceFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [food, setFood] = React.useState("");
  const [symptom, setSymptom] = React.useState("");
  const [severity, setSeverity] = React.useState("leve");
  const [thresholdDose, setThresholdDose] = React.useState("");
  const [mechanism, setMechanism] = React.useState("lactosa");
  const [inotes, setInotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = intoleranceFormSchema.safeParse({ food, symptom, severity, thresholdDose: thresholdDose || undefined, mechanism, notes: inotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setFood(""); setSymptom(""); setSeverity("leve"); setThresholdDose(""); setMechanism("lactosa"); setInotes("");
    } catch {
      setErrors({ food: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar intolerancia</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="int-food" label="Alimento" value={food} onChange={setFood} error={errors.food} />
          <InputField id="int-symp" label="Síntoma" value={symptom} onChange={setSymptom} error={errors.symptom} />
          <SelectField id="int-sev" label="Severidad" value={severity} options={["leve", "moderada", "severa"]} labels={IntoleranceSeverityLabel} onValueChange={setSeverity} error={errors.severity} />
          <InputField id="int-dose" label="Dosis umbral" value={thresholdDose} onChange={setThresholdDose} />
          <SelectField id="int-mech" label="Mecanismo" value={mechanism} options={["lactosa", "fructosa", "sorbitol", "histamina", "gluten", "otro"]} labels={MechanismLabel} onValueChange={setMechanism} error={errors.mechanism} />
          <InputField id="int-notes" label="Notas" value={inotes} onChange={setInotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSurgeryDialog({ onSave }: { onSave: (data: SurgeryFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [stype, setStype] = React.useState("laparoscopica");
  const [date, setDate] = React.useState("");
  const [hospital, setHospital] = React.useState("");
  const [complications, setComplications] = React.useState("");
  const [snotes, setSnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = surgeryFormSchema.safeParse({ type: stype, date, hospital: hospital || undefined, complications: complications || undefined, notes: snotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setStype("laparoscopica"); setDate(""); setHospital(""); setComplications(""); setSnotes("");
    } catch {
      setErrors({ type: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar cirugía</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="surg-type" label="Tipo" value={stype} options={["laparoscopica", "abierta", "endoscopica", "bariatrica", "cesarea", "apendicectomia", "colecistectomia", "hernioplastia", "otro"]} labels={SurgeryTypeLabel} onValueChange={setStype} error={errors.type} />
          <InputField id="surg-date" label="Fecha" type="date" value={date} onChange={setDate} error={errors.date} />
          <InputField id="surg-hosp" label="Hospital" value={hospital} onChange={setHospital} />
          <InputField id="surg-comp" label="Complicaciones" value={complications} onChange={setComplications} />
          <InputField id="surg-notes" label="Notas" value={snotes} onChange={setSnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddHospitalizationDialog({ onSave }: { onSave: (data: HospitalizationFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [admissionDate, setAdmissionDate] = React.useState("");
  const [dischargeDate, setDischargeDate] = React.useState("");
  const [stayDays, setStayDays] = React.useState(0);
  const [hospital, setHospital] = React.useState("");
  const [hnotes, setHnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = hospitalizationFormSchema.safeParse({ reason, admissionDate, dischargeDate: dischargeDate || undefined, stayDays: stayDays || undefined, hospital: hospital || undefined, notes: hnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setReason(""); setAdmissionDate(""); setDischargeDate(""); setStayDays(0); setHospital(""); setHnotes("");
    } catch {
      setErrors({ reason: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar hospitalización</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="hosp-reason" label="Motivo" value={reason} onChange={setReason} error={errors.reason} />
          <InputField id="hosp-adm" label="Fecha ingreso" type="date" value={admissionDate} onChange={setAdmissionDate} error={errors.admissionDate} />
          <InputField id="hosp-dis" label="Fecha egreso" type="date" value={dischargeDate} onChange={setDischargeDate} />
          <div className="space-y-2">
            <Label htmlFor="hosp-stay">Días estancia</Label>
            <Input id="hosp-stay" type="number" value={stayDays} onChange={(e) => setStayDays(Number(e.target.value))} />
          </div>
          <InputField id="hosp-hosp" label="Hospital" value={hospital} onChange={setHospital} />
          <InputField id="hosp-notes" label="Notas" value={hnotes} onChange={setHnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSupplementDialog({ onSave }: { onSave: (data: SupplementFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [supname, setSupname] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [composition, setComposition] = React.useState("");
  const [dose, setDose] = React.useState("");
  const [frequency, setFrequency] = React.useState("");
  const [prescribedBy, setPrescribedBy] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [sunotes, setSunotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = supplementFormSchema.safeParse({ name: supname, brand: brand || undefined, category: category || undefined, composition: composition || undefined, dose: dose || undefined, frequency: frequency || undefined, prescribedBy: prescribedBy || undefined, startDate: startDate || undefined, endDate: endDate || undefined, notes: sunotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setSupname(""); setBrand(""); setCategory(""); setComposition(""); setDose(""); setFrequency("");
      setPrescribedBy(""); setStartDate(""); setEndDate(""); setSunotes("");
    } catch {
      setErrors({ name: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar suplemento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="sup-name" label="Nombre" value={supname} onChange={setSupname} error={errors.name} />
          <InputField id="sup-brand" label="Marca" value={brand} onChange={setBrand} />
          <SelectField id="sup-cat" label="Categoría" value={category} options={["multivitaminico", "vitamina_d", "hierro", "calcio", "omega_3", "proteina", "creatina", "probiotico", "herbolario", "homeopatico", "otro"]} labels={SupplementCategoryLabel} onValueChange={setCategory} />
          <InputField id="sup-comp" label="Composición" value={composition} onChange={setComposition} />
          <InputField id="sup-dose" label="Dosis" value={dose} onChange={setDose} />
          <InputField id="sup-freq" label="Frecuencia" value={frequency} onChange={setFrequency} />
          <InputField id="sup-by" label="Prescrito por" value={prescribedBy} onChange={setPrescribedBy} />
          <InputField id="sup-start" label="Fecha inicio" type="date" value={startDate} onChange={setStartDate} />
          <InputField id="sup-end" label="Fecha fin" type="date" value={endDate} onChange={setEndDate} />
          <InputField id="sup-notes" label="Notas" value={sunotes} onChange={setSunotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddFoodFrequencyDialog({ onSave }: { onSave: (data: FoodFrequencyFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [foodGroupId, setFoodGroupId] = React.useState("");
  const [foodGroupName, setFoodGroupName] = React.useState("");
  const [frequency, setFrequency] = React.useState("diario");
  const [quantity, setQuantity] = React.useState("");
  const [preparation, setPreparation] = React.useState("");
  const [ffnotes, setFfnotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = foodFrequencyFormSchema.safeParse({ foodGroupId, foodGroupName: foodGroupName || undefined, frequency, quantity: quantity || undefined, preparation: preparation || undefined, notes: ffnotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setFoodGroupId(""); setFoodGroupName(""); setFrequency("diario"); setQuantity(""); setPreparation(""); setFfnotes("");
    } catch {
      setErrors({ foodGroupId: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar frecuencia de consumo</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="ff-group" label="Grupo de alimento" value={foodGroupId} onChange={setFoodGroupId} error={errors.foodGroupId} />
          <InputField id="ff-gname" label="Nombre del grupo" value={foodGroupName} onChange={setFoodGroupName} />
          <SelectField id="ff-freq" label="Frecuencia" value={frequency} options={["diario", "3-5_sem", "1-2_sem", "1-3_mes", "ocasional", "nunca"]} labels={undefined} onValueChange={setFrequency} error={errors.frequency} />
          <InputField id="ff-qty" label="Cantidad" value={quantity} onChange={setQuantity} />
          <InputField id="ff-prep" label="Preparación" value={preparation} onChange={setPreparation} />
          <InputField id="ff-notes" label="Notas" value={ffnotes} onChange={setFfnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddGiSymptomDialog({ onSave }: { onSave: (data: GiSymptomFormData) => Promise<unknown> }) {
  const [open, setOpen] = React.useState(false);
  const [symptomType, setSymptomType] = React.useState("otro");
  const [description, setDescription] = React.useState("");
  const [frequency, setFrequency] = React.useState("");
  const [severity, setSeverity] = React.useState(5);
  const [foodRelation, setFoodRelation] = React.useState("");
  const [onsetDate, setOnsetDate] = React.useState("");
  const [triggers, setTriggers] = React.useState("");
  const [ginotes, setGinotes] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = giSymptomFormSchema.safeParse({ symptomType, description: description || undefined, frequency: frequency || undefined, severity: severity || undefined, foodRelation: foodRelation || undefined, onsetDate: onsetDate || undefined, triggers: triggers || undefined, notes: ginotes || undefined });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setSymptomType("otro"); setDescription(""); setFrequency(""); setSeverity(5); setFoodRelation(""); setOnsetDate(""); setTriggers(""); setGinotes("");
    } catch {
      setErrors({ symptomType: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> Agregar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Agregar síntoma gastrointestinal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="gi-type" label="Tipo" value={symptomType} options={["estrenimiento", "diarrea", "distension", "reflujo", "nausea", "vomito", "dolor_abdominal", "acidez", "eructos", "flatulencia", "saciedad_temprana", "disfagia", "otro"]} labels={GiSymptomTypeLabel} onValueChange={setSymptomType} error={errors.symptomType} />
          <InputField id="gi-desc" label="Descripción" value={description} onChange={setDescription} />
          <InputField id="gi-freq" label="Frecuencia" value={frequency} onChange={setFrequency} />
          <div className="space-y-2">
            <Label htmlFor="gi-sev">Severidad (1-10)</Label>
            <Input id="gi-sev" type="number" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} />
          </div>
          <InputField id="gi-food" label="Relación con alimentos" value={foodRelation} onChange={setFoodRelation} />
          <InputField id="gi-onset" label="Fecha inicio" type="date" value={onsetDate} onChange={setOnsetDate} />
          <InputField id="gi-trig" label="Desencadenantes" value={triggers} onChange={setTriggers} />
          <InputField id="gi-notes" label="Notas" value={ginotes} onChange={setGinotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
