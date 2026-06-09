import * as React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
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
import { FrequencyValueLabel } from "../domain/FoodFrequency";
import { GiSymptomTypeLabel } from "../domain/GiSymptom";

function translatedLabels(t: TFunction, prefix: string, labels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(labels).map((value) => [value, t(`${prefix}.${value}`)])) as Record<string, string>;
}

type FieldIssue = {
  path: readonly unknown[];
  message: string;
  code?: string;
  minimum?: unknown;
  maximum?: unknown;
  type?: unknown;
  origin?: unknown;
};

function translateValidationError(issue: FieldIssue, t: TFunction): string {
  const isStringIssue = issue.type === "string" || issue.origin === "string";
  if (isStringIssue && issue.code === "too_small" && typeof issue.minimum === "number") {
    return issue.minimum <= 1 ? t("errors.required") : t("errors.min_chars", { n: issue.minimum });
  }
  if (isStringIssue && issue.code === "too_big" && typeof issue.maximum === "number") {
    return t("errors.max_chars", { n: issue.maximum });
  }
  return issue.message;
}

function toFieldErrors(issues: readonly FieldIssue[], t: TFunction): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    if (issue.path[0]) fieldErrors[String(issue.path[0])] = translateValidationError(issue, t);
  }
  return fieldErrors;
}

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
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}><SelectValue placeholder={t("common.select")} /></SelectTrigger>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = allergyFormSchema.safeParse({ allergen, reaction, severity, diagnosis, notes: notes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setAllergen(""); setReaction(""); setSeverity("leve"); setDiagnosis("clinico"); setNotes("");
    } catch {
      setErrors({ allergen: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_allergy")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="allergen" label={t("clinical_record.allergen")} value={allergen} onChange={setAllergen} placeholder={t("clinical_record.allergen_placeholder")} error={errors.allergen} />
          <InputField id="reaction" label={t("clinical_record.reaction")} value={reaction} onChange={setReaction} placeholder={t("clinical_record.reaction_placeholder")} error={errors.reaction} />
          <SelectField id="severity" label={t("clinical_record.severity")} value={severity} options={["leve", "moderada", "severa", "anafilaxia"]} labels={translatedLabels(t, "clinical_record.options.severity", SeverityLabel)} onValueChange={setSeverity} error={errors.severity} />
          <SelectField id="diagnosis" label={t("clinical_record.diagnosis")} value={diagnosis} options={["clinico", "prick", "rast", "desafio"]} labels={translatedLabels(t, "clinical_record.options.allergy_diagnosis", AllergyDiagnosisLabel)} onValueChange={setDiagnosis} error={errors.diagnosis} />
          <InputField id="notes" label={t("common.notes")} value={notes} onChange={setNotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = medicationFormSchema.safeParse({ name, activeIngredient, dose, frequency, route, startDate, endDate: endDate || undefined, prescribedBy: prescribedBy || undefined, notes: mnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
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
      setErrors({ name: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_medication")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="med-name" label={t("common.name")} value={name} onChange={setName} error={errors.name} />
          <InputField id="med-ing" label={t("clinical_record.active_ingredient")} value={activeIngredient} onChange={setActiveIngredient} error={errors.activeIngredient} />
          <InputField id="med-dose" label={t("clinical_record.dose")} value={dose} onChange={setDose} error={errors.dose} />
          <SelectField id="med-freq" label={t("clinical_record.frequency")} value={frequency} options={["cada-24h", "cada-12h", "cada-8h", "cada-6h", "cada-4h", "desayuno", "comida", "cena", "noches", "cuando-requiera"]} labels={translatedLabels(t, "clinical_record.options.medication_frequency", MedicationFreqLabel)} onValueChange={setFrequency} error={errors.frequency} />
          <InputField id="med-route" label={t("clinical_record.route")} value={route} onChange={setRoute} error={errors.route} />
          <InputField id="med-start" label={t("clinical_record.start_date")} type="date" value={startDate} onChange={setStartDate} error={errors.startDate} />
          <InputField id="med-end" label={t("clinical_record.end_date")} type="date" value={endDate} onChange={setEndDate} />
          <InputField id="med-by" label={t("clinical_record.prescribed_by")} value={prescribedBy} onChange={setPrescribedBy} />
          <InputField id="med-notes" label={t("common.notes")} value={mnotes} onChange={setMnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = clinicalEventFormSchema.safeParse({ type, name, description: description || undefined, date, endDate: endDate || undefined, notes: evnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setType("evento-clinico"); setName(""); setDescription(""); setDate(""); setEndDate(""); setEvnotes("");
    } catch {
      setErrors({ name: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_clinical_event")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="ev-type" label={t("common.type")} value={type} options={["antecedente-heredofamiliar", "antecedente-personal-patologico", "cirugia", "hospitalizacion", "sintoma-gastrointestinal", "evento-clinico"]} labels={translatedLabels(t, "clinical_record.options.event_type", EventTypeLabel)} onValueChange={setType} error={errors.type} />
          <InputField id="ev-name" label={t("common.name")} value={name} onChange={setName} error={errors.name} />
          <InputField id="ev-desc" label={t("common.description")} value={description} onChange={setDescription} />
          <InputField id="ev-date" label={t("common.date")} type="date" value={date} onChange={setDate} error={errors.date} />
          <InputField id="ev-end" label={t("clinical_record.end_date")} type="date" value={endDate} onChange={setEndDate} />
          <InputField id="ev-notes" label={t("common.notes")} value={evnotes} onChange={setEvnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = familyHistoryFormSchema.safeParse({ relationship, condition, diagnosisAge: diagnosisAge === "" ? null : Number(diagnosisAge), notes: fhnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setRelationship("padre"); setCondition("obesidad"); setDiagnosisAge(""); setFhnotes("");
    } catch {
      setErrors({ relationship: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_family_history")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="fh-rel" label={t("clinical_record.family_relationship")} value={relationship} options={["padre", "madre", "hermano", "hermana", "abuelo_paterno", "abuela_paterna", "abuelo_materno", "abuela_materna", "tio", "tia", "hijo", "hija", "otro"]} labels={translatedLabels(t, "clinical_record.options.family_relationship", FamilyRelationshipLabel)} onValueChange={setRelationship} error={errors.relationship} />
          <SelectField id="fh-cond" label={t("clinical_record.condition_field")} value={condition} options={["diabetes", "hta", "obesidad", "cancer", "ecv", "erc", "tiroidea", "autoinmune", "osteoporosis", "dislipidemia", "otro"]} labels={translatedLabels(t, "clinical_record.options.family_condition", ConditionLabel)} onValueChange={setCondition} error={errors.condition} />
          <InputField id="fh-age" label={t("clinical_record.diagnosis_age")} value={diagnosisAge} onChange={setDiagnosisAge} />
          <InputField id="fh-notes" label={t("common.notes")} value={fhnotes} onChange={setFhnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = personalHistoryFormSchema.safeParse({ condition, diagnosisDate: diagnosisDate || undefined, status, treatingPhysician: treatingPhysician || undefined, treatment: treatment || undefined, notes: phnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setCondition("otro"); setDiagnosisDate(""); setStatus("activo"); setTreatingPhysician(""); setTreatment(""); setPhnotes("");
    } catch {
      setErrors({ condition: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_personal_history")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="ph-cond" label={t("clinical_record.condition_field")} value={condition} options={["diabetes_tipo_1", "diabetes_tipo_2", "hta", "dislipidemia", "obesidad", "erc", "higado_graso", "sindrome_metabolico", "tiroidea", "anemia", "gastrointestinal", "autoinmune", "cancer", "cardiopatia", "depresion", "trastorno_alimentario", "covid", "otro"]} labels={translatedLabels(t, "clinical_record.options.personal_condition", PersonalConditionLabel)} onValueChange={setCondition} error={errors.condition} />
          <InputField id="ph-date" label={t("clinical_record.diagnosis_date")} type="date" value={diagnosisDate} onChange={setDiagnosisDate} />
          <InputField id="ph-status" label={t("common.status")} value={status} onChange={setStatus} error={errors.status} />
          <InputField id="ph-phys" label={t("clinical_record.treating_physician")} value={treatingPhysician} onChange={setTreatingPhysician} />
          <InputField id="ph-treat" label={t("clinical_record.treatment")} value={treatment} onChange={setTreatment} />
          <InputField id="ph-notes" label={t("common.notes")} value={phnotes} onChange={setPhnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = habitFormSchema.safeParse({ category, status, frequency: frequency || undefined, quantity: quantity || undefined, notes: hnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setCategory("smoking"); setStatus("nunca"); setFrequency(""); setQuantity(""); setHnotes("");
    } catch {
      setErrors({ category: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_habit")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="hab-cat" label={t("clinical_record.category")} value={category} options={["smoking", "alcohol", "sleep", "stress", "hydration", "coffee", "ultraprocessed"]} labels={translatedLabels(t, "clinical_record.options.habit_category", HabitCategoryLabel)} onValueChange={setCategory} error={errors.category} />
          <InputField id="hab-status" label={t("common.status")} value={status} onChange={setStatus} error={errors.status} />
          <InputField id="hab-freq" label={t("clinical_record.frequency")} value={frequency} onChange={setFrequency} />
          <InputField id="hab-qty" label={t("clinical_record.quantity")} value={quantity} onChange={setQuantity} />
          <InputField id="hab-notes" label={t("common.notes")} value={hnotes} onChange={setHnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = physicalActivityFormSchema.safeParse({ type: atype, frequencyPerWeek, durationMinutes, intensity, startDate: startDate || undefined, endDate: endDate || undefined, notes: panotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
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
      setErrors({ type: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_activity")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="pa-type" label={t("common.type")} value={atype} options={["caminata", "running", "natacion", "ciclismo", "pesas", "yoga", "pilates", "crossfit", "futbol", "basquetbol", "tenis", "baile", "artes_marciales", "otro"]} labels={translatedLabels(t, "clinical_record.options.activity_type", ActivityTypeLabel)} onValueChange={setAtype} error={errors.type} />
          <div className="space-y-2">
            <Label htmlFor="pa-freq">{t("clinical_record.times_per_week")}</Label>
            <Input id="pa-freq" type="number" value={frequencyPerWeek} onChange={(e) => setFrequencyPerWeek(Number(e.target.value))} />
            {errors.frequencyPerWeek && <p className="text-sm text-destructive">{errors.frequencyPerWeek}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-dur">{t("clinical_record.minutes_per_session")}</Label>
            <Input id="pa-dur" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            {errors.durationMinutes && <p className="text-sm text-destructive">{errors.durationMinutes}</p>}
          </div>
          <SelectField id="pa-int" label={t("clinical_record.intensity")} value={intensity} options={["light", "moderate", "vigorous", "maximal"]} labels={translatedLabels(t, "clinical_record.options.borg_intensity", BorgIntensityLabel)} onValueChange={setIntensity} error={errors.intensity} />
          <InputField id="pa-start" label={t("clinical_record.start_date")} type="date" value={startDate} onChange={setStartDate} />
          <InputField id="pa-end" label={t("clinical_record.end_date")} type="date" value={endDate} onChange={setEndDate} />
          <InputField id="pa-notes" label={t("common.notes")} value={panotes} onChange={setPanotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { dietType, mealsPerDay, mealSchedule: mealSchedule || undefined, mealPlace: mealPlace || undefined, mealPreparer: mealPreparer || undefined, timeAvailable: timeAvailable || undefined, budget: budget || undefined, kitchenEquipment: kitchenEquipment || undefined, previousDiets: previousDiets || undefined, labelReading, nutritionalKnowledge: nutritionalKnowledge || undefined, preferences: preferences || undefined, aversions: aversions || undefined, chewing: chewing || undefined, workSchedule: workSchedule || undefined, householdPeople, notes: dhnotes || undefined };
    const result = dietHistoryFormSchema.safeParse(data);
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
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
      setErrors({ dietType: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_diet_history")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto">
          <SelectField id="dh-type" label={t("clinical_record.diet_type")} value={dietType} options={["omnivoro", "vegetariano", "vegano", "pescetariano", "keto", "paleo", "mediterraneo", "dash", "ayuno_intermitente", "otro"]} labels={translatedLabels(t, "clinical_record.options.diet_type", DietTypeLabel)} onValueChange={setDietType} error={errors.dietType} />
          <div className="space-y-2">
            <Label htmlFor="dh-meals">{t("clinical_record.meals_per_day")}</Label>
            <Input id="dh-meals" type="number" value={mealsPerDay} onChange={(e) => setMealsPerDay(Number(e.target.value))} />
            {errors.mealsPerDay && <p className="text-sm text-destructive">{errors.mealsPerDay}</p>}
          </div>
          <InputField id="dh-sched" label={t("clinical_record.meal_schedule")} value={mealSchedule} onChange={setMealSchedule} />
          <SelectField id="dh-place" label={t("clinical_record.meal_place")} value={mealPlace} options={["hogar", "trabajo", "escuela", "restaurante", "calle", "otro"]} labels={translatedLabels(t, "clinical_record.options.meal_place", MealPlaceLabel)} onValueChange={setMealPlace} />
          <InputField id="dh-prep" label={t("clinical_record.meal_preparer")} value={mealPreparer} onChange={setMealPreparer} />
          <InputField id="dh-time" label={t("clinical_record.time_available")} value={timeAvailable} onChange={setTimeAvailable} />
          <InputField id="dh-budget" label={t("clinical_record.budget")} value={budget} onChange={setBudget} />
          <InputField id="dh-equip" label={t("clinical_record.kitchen_equipment")} value={kitchenEquipment} onChange={setKitchenEquipment} />
          <InputField id="dh-diets" label={t("clinical_record.previous_diets")} value={previousDiets} onChange={setPreviousDiets} />
          <InputField id="dh-know" label={t("clinical_record.nutritional_knowledge")} value={nutritionalKnowledge} onChange={setNutritionalKnowledge} />
          <InputField id="dh-prefs" label={t("clinical_record.preferences")} value={preferences} onChange={setPreferences} />
          <InputField id="dh-avers" label={t("clinical_record.aversions")} value={aversions} onChange={setAversions} />
          <InputField id="dh-chew" label={t("clinical_record.chewing")} value={chewing} onChange={setChewing} />
          <InputField id="dh-work" label={t("clinical_record.work_schedule")} value={workSchedule} onChange={setWorkSchedule} />
          <div className="space-y-2">
            <Label htmlFor="dh-ppl">{t("clinical_record.household_people")}</Label>
            <Input id="dh-ppl" type="number" value={householdPeople} onChange={(e) => setHouseholdPeople(Number(e.target.value))} />
          </div>
          <InputField id="dh-notes" label={t("common.notes")} value={dhnotes} onChange={setDhnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = intoleranceFormSchema.safeParse({ food, symptom, severity, thresholdDose: thresholdDose || undefined, mechanism, notes: inotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setFood(""); setSymptom(""); setSeverity("leve"); setThresholdDose(""); setMechanism("lactosa"); setInotes("");
    } catch {
      setErrors({ food: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_intolerance")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="int-food" label={t("clinical_record.food")} value={food} onChange={setFood} error={errors.food} />
          <InputField id="int-symp" label={t("clinical_record.symptom")} value={symptom} onChange={setSymptom} error={errors.symptom} />
          <SelectField id="int-sev" label={t("clinical_record.severity")} value={severity} options={["leve", "moderada", "severa"]} labels={translatedLabels(t, "clinical_record.options.intolerance_severity", IntoleranceSeverityLabel)} onValueChange={setSeverity} error={errors.severity} />
          <InputField id="int-dose" label={t("clinical_record.threshold_dose")} value={thresholdDose} onChange={setThresholdDose} />
          <SelectField id="int-mech" label={t("clinical_record.mechanism")} value={mechanism} options={["lactosa", "fructosa", "sorbitol", "histamina", "gluten", "otro"]} labels={translatedLabels(t, "clinical_record.options.mechanism", MechanismLabel)} onValueChange={setMechanism} error={errors.mechanism} />
          <InputField id="int-notes" label={t("common.notes")} value={inotes} onChange={setInotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = surgeryFormSchema.safeParse({ type: stype, date, hospital: hospital || undefined, complications: complications || undefined, notes: snotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setStype("laparoscopica"); setDate(""); setHospital(""); setComplications(""); setSnotes("");
    } catch {
      setErrors({ type: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_surgery")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="surg-type" label={t("common.type")} value={stype} options={["laparoscopica", "abierta", "endoscopica", "bariatrica", "cesarea", "apendicectomia", "colecistectomia", "hernioplastia", "otro"]} labels={translatedLabels(t, "clinical_record.options.surgery_type", SurgeryTypeLabel)} onValueChange={setStype} error={errors.type} />
          <InputField id="surg-date" label={t("common.date")} type="date" value={date} onChange={setDate} error={errors.date} />
          <InputField id="surg-hosp" label={t("clinical_record.hospital")} value={hospital} onChange={setHospital} />
          <InputField id="surg-comp" label={t("clinical_record.complications")} value={complications} onChange={setComplications} />
          <InputField id="surg-notes" label={t("common.notes")} value={snotes} onChange={setSnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = hospitalizationFormSchema.safeParse({ reason, admissionDate, dischargeDate: dischargeDate || undefined, stayDays: stayDays || undefined, hospital: hospital || undefined, notes: hnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setReason(""); setAdmissionDate(""); setDischargeDate(""); setStayDays(0); setHospital(""); setHnotes("");
    } catch {
      setErrors({ reason: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_hospitalization")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="hosp-reason" label={t("clinical_record.reason")} value={reason} onChange={setReason} error={errors.reason} />
          <InputField id="hosp-adm" label={t("clinical_record.admission_date")} type="date" value={admissionDate} onChange={setAdmissionDate} error={errors.admissionDate} />
          <InputField id="hosp-dis" label={t("clinical_record.discharge_date")} type="date" value={dischargeDate} onChange={setDischargeDate} />
          <div className="space-y-2">
            <Label htmlFor="hosp-stay">{t("clinical_record.stay_days_label")}</Label>
            <Input id="hosp-stay" type="number" value={stayDays} onChange={(e) => setStayDays(Number(e.target.value))} />
          </div>
          <InputField id="hosp-hosp" label={t("clinical_record.hospital")} value={hospital} onChange={setHospital} />
          <InputField id="hosp-notes" label={t("common.notes")} value={hnotes} onChange={setHnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = supplementFormSchema.safeParse({ name: supname, brand: brand || undefined, category: category || undefined, composition: composition || undefined, dose: dose || undefined, frequency: frequency || undefined, prescribedBy: prescribedBy || undefined, startDate: startDate || undefined, endDate: endDate || undefined, notes: sunotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
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
      setErrors({ name: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_supplement")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="sup-name" label={t("common.name")} value={supname} onChange={setSupname} error={errors.name} />
          <InputField id="sup-brand" label={t("clinical_record.brand")} value={brand} onChange={setBrand} />
          <SelectField id="sup-cat" label={t("clinical_record.category")} value={category} options={["multivitaminico", "vitamina_d", "hierro", "calcio", "omega_3", "proteina", "creatina", "probiotico", "herbolario", "homeopatico", "otro"]} labels={translatedLabels(t, "clinical_record.options.supplement_category", SupplementCategoryLabel)} onValueChange={setCategory} />
          <InputField id="sup-comp" label={t("clinical_record.composition")} value={composition} onChange={setComposition} />
          <InputField id="sup-dose" label={t("clinical_record.dose")} value={dose} onChange={setDose} />
          <InputField id="sup-freq" label={t("clinical_record.frequency")} value={frequency} onChange={setFrequency} />
          <InputField id="sup-by" label={t("clinical_record.prescribed_by")} value={prescribedBy} onChange={setPrescribedBy} />
          <InputField id="sup-start" label={t("clinical_record.start_date")} type="date" value={startDate} onChange={setStartDate} />
          <InputField id="sup-end" label={t("clinical_record.end_date")} type="date" value={endDate} onChange={setEndDate} />
          <InputField id="sup-notes" label={t("common.notes")} value={sunotes} onChange={setSunotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = foodFrequencyFormSchema.safeParse({ foodGroupId, foodGroupName: foodGroupName || undefined, frequency, quantity: quantity || undefined, preparation: preparation || undefined, notes: ffnotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setFoodGroupId(""); setFoodGroupName(""); setFrequency("diario"); setQuantity(""); setPreparation(""); setFfnotes("");
    } catch {
      setErrors({ foodGroupId: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_food_frequency")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField id="ff-group" label={t("clinical_record.food_group")} value={foodGroupId} onChange={setFoodGroupId} error={errors.foodGroupId} />
          <InputField id="ff-gname" label={t("clinical_record.food_group_name")} value={foodGroupName} onChange={setFoodGroupName} />
          <SelectField id="ff-freq" label={t("clinical_record.frequency")} value={frequency} options={["diario", "3-5_sem", "1-2_sem", "1-3_mes", "ocasional", "nunca"]} labels={translatedLabels(t, "clinical_record.options.food_frequency", FrequencyValueLabel)} onValueChange={setFrequency} error={errors.frequency} />
          <InputField id="ff-qty" label={t("clinical_record.quantity")} value={quantity} onChange={setQuantity} />
          <InputField id="ff-prep" label={t("clinical_record.preparation")} value={preparation} onChange={setPreparation} />
          <InputField id="ff-notes" label={t("common.notes")} value={ffnotes} onChange={setFfnotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
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
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = giSymptomFormSchema.safeParse({ symptomType, description: description || undefined, frequency: frequency || undefined, severity: severity || undefined, foodRelation: foodRelation || undefined, onsetDate: onsetDate || undefined, triggers: triggers || undefined, notes: ginotes || undefined });
    if (!result.success) {
      setErrors(toFieldErrors(result.error.issues, t));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      setOpen(false);
      setSymptomType("otro"); setDescription(""); setFrequency(""); setSeverity(5); setFoodRelation(""); setOnsetDate(""); setTriggers(""); setGinotes("");
    } catch {
      setErrors({ symptomType: t("clinical_record.error_save") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErrors({}); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("clinical_record.add_gi_symptom")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField id="gi-type" label={t("common.type")} value={symptomType} options={["estrenimiento", "diarrea", "distension", "reflujo", "nausea", "vomito", "dolor_abdominal", "acidez", "eructos", "flatulencia", "saciedad_temprana", "disfagia", "otro"]} labels={translatedLabels(t, "clinical_record.options.gi_symptom_type", GiSymptomTypeLabel)} onValueChange={setSymptomType} error={errors.symptomType} />
          <InputField id="gi-desc" label={t("common.description")} value={description} onChange={setDescription} />
          <InputField id="gi-freq" label={t("clinical_record.frequency")} value={frequency} onChange={setFrequency} />
          <div className="space-y-2">
            <Label htmlFor="gi-sev">{t("clinical_record.severity_scale")}</Label>
            <Input id="gi-sev" type="number" min={1} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} />
          </div>
          <InputField id="gi-food" label={t("clinical_record.food_relation")} value={foodRelation} onChange={setFoodRelation} />
          <InputField id="gi-onset" label={t("clinical_record.start_date")} type="date" value={onsetDate} onChange={setOnsetDate} />
          <InputField id="gi-trig" label={t("clinical_record.triggers")} value={triggers} onChange={setTriggers} />
          <InputField id="gi-notes" label={t("common.notes")} value={ginotes} onChange={setGinotes} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
