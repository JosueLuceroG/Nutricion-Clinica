import * as React from "react";
import { useForm, FormProvider, useFormContext, type FieldErrors, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  MessageCircle,
  Activity,
  FlaskConical,
  ClipboardList,
  Check,
  FileText,
  Heart,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ConsultationFormSchema,
  consultationFormDefaultValues,
  WIZARD_STEPS,
  type ConsultationFormValues,
  type WizardStepKey,
} from "@modules/consultation/application/consultationFormSchema";
import { consultationService } from "@services/consultationService";
import { anthropometryService } from "@services/anthropometryService";
import { labPanelService } from "@services/labPanelService";
import { clinicalSuggestionService } from "@services/clinicalSuggestionService";
import type { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { Vitals } from "@modules/consultation/domain/Vitals";
import type { DiagnosticSuggestion, PlanTargetSuggestion } from "@modules/clinical-engine/domain/Suggestion";
import { ConfidenceLabel } from "@modules/clinical-engine/domain/Suggestion";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { cn } from "@utils/cn";
import { useAI } from "@services/ai/useAI";
import { AIAssistButton } from "@components/ai/AIAssistButton";
import { useUnsavedChangesGuard } from "@hooks/useUnsavedChangesGuard";
import { useAutoSave } from "@hooks/useAutoSave";
import { SaveIndicator } from "@components/ui/SaveIndicator";
import { usePreferencesStore } from "@store/preferencesStore";

interface ConsultationWizardProps {
  patientId: PatientId;
  initialValues?: Partial<ConsultationFormValues>;
  onComplete?: (consultationId: string) => void;
}

const STEP_ICONS: Record<WizardStepKey, React.ComponentType<{ className?: string }>> = {
  basics: Stethoscope,
  subjective: MessageCircle,
  objective: Activity,
  lab: FlaskConical,
  plan: ClipboardList,
  review: FileText,
};

export function ConsultationWizard({ patientId, initialValues, onComplete }: ConsultationWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const isBeginnerMode = usePreferencesStore((s) => s.usageMode === "beginner");

  const methods = useForm<ConsultationFormValues>({
    resolver: zodResolver(ConsultationFormSchema),
    defaultValues: consultationFormDefaultValues,
    mode: "onChange",
  });

  React.useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      methods.reset({ ...consultationFormDefaultValues, ...initialValues });
    }
  }, []);

  useUnsavedChangesGuard(methods.formState.isDirty && !submitting, t("common.unsaved_changes_warning"));

  const allFormValues = methods.watch();
  const draftKey = `consultation:${patientId.toString()}`;
  const { status: saveStatus, clearDraft } = useAutoSave({
    key: draftKey,
    data: allFormValues as Record<string, unknown>,
    enabled: methods.formState.isDirty && !submitting,
  });

  const goNext = async () => {
    const fields = WIZARD_STEPS[step - 1]?.fields ?? [];
    if (fields.length === 0) {
      setStep((s) => Math.min(s + 1, WIZARD_STEPS.length));
      return;
    }
    const valid = await methods.trigger(fields as FieldPath<ConsultationFormValues>[]);
    if (valid) {
      setStep((s) => Math.min(s + 1, WIZARD_STEPS.length));
    }
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const goToStep = (target: number) => {
    if (target < step) setStep(target);
  };

  const onSubmit = methods.handleSubmit(
    async (values) => {
      setSubmitting(true);
      try {
        const nextVisitDate = values.nextVisitDate ? new Date(values.nextVisitDate) : null;
        const vitals = values.vitalsTaken
          ? Vitals.from(values.vitalSigns ?? {})
          : Vitals.empty();
        const consultation = await consultationService.schedule.execute({
          patientId,
          consultationDate: new Date(values.consultationDate),
          consultationNumber: 0,
          reason: values.reason.trim(),
          subjective: values.subjective,
          objective: values.objective,
          vitals,
          assessment: values.assessment,
          plan: values.plan,
          anthropometryId: values.anthropometryId ? AnthropometryId.fromUnsafe(values.anthropometryId) : null,
          labPanelId: values.labPanelId ? LabPanelId.fromUnsafe(values.labPanelId) : null,
          nextVisitDate,
        });

        clearDraft();

        toast.success(t("consultation.wizard.toast_registered"), {
          description: t("consultation.wizard.toast_scheduled", { number: consultation.consultationNumber }),
        });

        if (onComplete) {
          onComplete(consultation.id.toString());
        } else {
          navigate(`/pacientes/${patientId.toString()}/consultas`);
        }
      } catch (err) {
        toast.error(t("consultation.wizard.toast_save_error"), {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setSubmitting(false);
      }
    },
    (errors) => {
      const messages = Object.entries(errors)
        .map(([k, v]) => {
          const msg = (v as { message?: string } | undefined)?.message;
          return msg ? `${k}: ${msg}` : null;
        })
        .filter((s): s is string => s !== null);
      toast.error(t("consultation.wizard.toast_fix_errors"), {
        description: messages.length > 0 ? messages.join("\n") : t("consultation.wizard.toast_check_fields"),
      });
    },
  );

  const errors = methods.formState.errors as FieldErrors<ConsultationFormValues>;
  const currentStepDef = WIZARD_STEPS[step - 1];

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-6">
          <Stepper current={step} onSelect={goToStep} />
          {isBeginnerMode && <BeginnerConsultationGuide step={step} />}

          {step === 1 && <StepBasics errors={errors} />}
          {step === 2 && <StepSubjective errors={errors} />}
          {step === 3 && <StepObjective patientId={patientId} errors={errors} />}
          {step === 4 && <StepLab patientId={patientId} errors={errors} />}
          {step === 5 && <StepPlan patientId={patientId} errors={errors} isBeginnerMode={isBeginnerMode} />}
          {step === 6 && <StepReview patientId={patientId.toString()} />}

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-auto">
              {step > 1 && (
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={goBack} disabled={submitting}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t("common.back")}
                </Button>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => navigate(-1)} disabled={submitting}>
                <X className="mr-2 h-4 w-4" />
                {t("common.cancel")}
              </Button>
              {step < WIZARD_STEPS.length ? (
                <Button type="button" className="w-full sm:w-auto" onClick={goNext}>
                  {t("common.next")}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => void onSubmit()}
                  disabled={submitting}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {submitting ? t("consultation.wizard.saving") : t("consultation.wizard.save_consultation")}
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            {currentStepDef && step < WIZARD_STEPS.length && (
              <p className="text-center text-xs text-muted-foreground">
                {t("consultation.wizard.step_of", { step, total: WIZARD_STEPS.length })} · {currentStepDef.title}
              </p>
            )}
            <SaveIndicator status={saveStatus} />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

function BeginnerConsultationGuide({ step }: { step: number }) {
  const { t } = useTranslation();
  const key = WIZARD_STEPS[step - 1]?.key ?? "basics";
  const hintKey: Record<WizardStepKey, string> = {
    basics: "consultation.wizard.beginner_hint_basics",
    subjective: "consultation.wizard.beginner_hint_subjective",
    objective: "consultation.wizard.beginner_hint_objective",
    lab: "consultation.wizard.beginner_hint_lab",
    plan: "consultation.wizard.beginner_hint_plan",
    review: "consultation.wizard.beginner_hint_review",
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          {t("consultation.wizard.beginner_title")}
        </CardTitle>
        <CardDescription>{t(hintKey[key])}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Stepper({
  current,
  onSelect,
}: {
  current: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="flex w-full items-center gap-1 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((s, i) => {
        const num = i + 1;
        const isActive = num === current;
        const isDone = num < current;
        const Icon = STEP_ICONS[s.key];
        return (
          <li key={s.key} className="flex min-w-fit flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(num)}
              disabled={num > current}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                isActive && "border-primary bg-primary text-primary-foreground",
                isDone && "border-success bg-success/10 text-success",
                !isActive && !isDone && "border-muted bg-muted/30 text-muted-foreground",
                num > current && "cursor-not-allowed",
              )}
              aria-current={isActive ? "step" : undefined}
              aria-label={s.title}
            >
              {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </button>
            <span
              className={cn(
                "hidden text-xs sm:inline",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  isDone ? "bg-success/50" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const StepBasics = React.memo(function StepBasics({ errors }: { errors: FieldErrors<ConsultationFormValues> }) {
  const { register } = useFormContextSafe();
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          {t("consultation.wizard.basic_info")}
        </CardTitle>
        <CardDescription>{t("consultation.wizard.basic_info_description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={t("consultation.wizard.date")} htmlFor="field-consultation-date" error={errors.consultationDate?.message} required>
          <Input type="date" id="field-consultation-date" {...register("consultationDate")} aria-invalid={!!errors.consultationDate} aria-describedby={errors.consultationDate ? "field-consultation-date-error" : undefined} />
        </Field>
        <Field label={t("consultation.wizard.reason")} htmlFor="field-consultation-reason" error={errors.reason?.message} required>
          <Textarea
            id="field-consultation-reason"
            {...register("reason")}
            rows={3}
            placeholder={t("consultation.wizard.reason_placeholder")}
            aria-invalid={!!errors.reason}
            aria-describedby={errors.reason ? "field-consultation-reason-error" : undefined}
          />
        </Field>
      </CardContent>
    </Card>
  );
});

const StepSubjective = React.memo(function StepSubjective({ errors }: { errors: FieldErrors<ConsultationFormValues> }) {
  const { register } = useFormContextSafe();
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          {t("consultation.wizard.subjective")}
        </CardTitle>
        <CardDescription>{t("consultation.wizard.subjective_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Field label={t("consultation.wizard.subjective_notes")} htmlFor="field-consultation-subjective" error={errors.subjective?.message}>
          <Textarea
            id="field-consultation-subjective"
            {...register("subjective")}
            rows={6}
            placeholder={t("consultation.wizard.subjective_placeholder")}
            aria-describedby={errors.subjective ? "field-consultation-subjective-error" : undefined}
          />
        </Field>
      </CardContent>
    </Card>
  );
});

const StepObjective = React.memo(function StepObjective({
  patientId,
  errors,
}: {
  patientId: PatientId;
  errors: FieldErrors<ConsultationFormValues>;
}) {
  const { register, watch, setValue } = useFormContextSafe();
  const { t } = useTranslation();
  const vitalsTaken = watch("vitalsTaken");
  const [measurements, setMeasurements] = React.useState<
    Array<{ id: string; measuredAt: string; weightKg: number; heightCm: number; bmi: number }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    anthropometryService.list
      .execute({ patientId, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setMeasurements(
          res.items.map((m) => {
            const heightM = m.height.toMeters();
            const weightKg = m.weight.toKg();
            const bmi = weightKg / (heightM * heightM);
            return {
              id: m.id.toString(),
              measuredAt: m.measuredAt.toISOString().slice(0, 10),
              weightKg,
              heightCm: m.height.toCentimeters(),
              bmi,
            };
          }),
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t("consultation.wizard.vital_signs")}
          </CardTitle>
          <CardDescription>{t("consultation.wizard.vital_signs_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input
              type="checkbox"
              checked={vitalsTaken}
              onChange={(e) => setValue("vitalsTaken", e.target.checked, { shouldDirty: true })}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-primary text-primary accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex-1">
              <p className="text-sm font-medium leading-none">{t("consultation.wizard.vital_signs_taken")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("consultation.wizard.vital_signs_taken_description")}
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {vitalsTaken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              {t("consultation.wizard.vital_signs_capture")}
            </CardTitle>
            <CardDescription>{t("consultation.wizard.vital_signs_capture_description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label={t("consultation.wizard.systolic_pressure")} htmlFor="field-consultation-systolic" error={errors.vitalSigns?.systolicMmHg?.message}>
              <Input
                type="number"
                id="field-consultation-systolic"
                {...register("vitalSigns.systolicMmHg", { valueAsNumber: true })}
                placeholder="120"
                aria-describedby={errors.vitalSigns?.systolicMmHg ? "field-consultation-systolic-error" : undefined}
              />
            </Field>
            <Field label={t("consultation.wizard.diastolic_pressure")} htmlFor="field-consultation-diastolic" error={errors.vitalSigns?.diastolicMmHg?.message}>
              <Input
                type="number"
                id="field-consultation-diastolic"
                {...register("vitalSigns.diastolicMmHg", { valueAsNumber: true })}
                placeholder="80"
                aria-describedby={errors.vitalSigns?.diastolicMmHg ? "field-consultation-diastolic-error" : undefined}
              />
            </Field>
            <Field label={t("consultation.wizard.heart_rate")} htmlFor="field-consultation-heart-rate" error={errors.vitalSigns?.heartRateBpm?.message}>
              <Input
                type="number"
                id="field-consultation-heart-rate"
                {...register("vitalSigns.heartRateBpm", { valueAsNumber: true })}
                placeholder="72"
                aria-describedby={errors.vitalSigns?.heartRateBpm ? "field-consultation-heart-rate-error" : undefined}
              />
            </Field>
            <Field label={t("consultation.wizard.temperature")} htmlFor="field-consultation-temperature" error={errors.vitalSigns?.temperatureC?.message}>
              <Input
                type="number"
                id="field-consultation-temperature"
                step="0.1"
                {...register("vitalSigns.temperatureC", { valueAsNumber: true })}
                placeholder="36.5"
                aria-describedby={errors.vitalSigns?.temperatureC ? "field-consultation-temperature-error" : undefined}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("consultation.wizard.physical_exam")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label={t("consultation.wizard.physical_exam_notes")} htmlFor="field-consultation-objective" error={errors.objective?.message}>
            <Textarea
              id="field-consultation-objective"
              {...register("objective")}
              rows={4}
              placeholder={t("consultation.wizard.physical_exam_placeholder")}
              aria-describedby={errors.objective ? "field-consultation-objective-error" : undefined}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("consultation.wizard.link_anthropometry")}</CardTitle>
          <CardDescription>{t("consultation.wizard.link_anthropometry_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("consultation.wizard.loading_measurements")}</p>
          ) : measurements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("consultation.wizard.no_measurements")}</p>
          ) : (
            <MeasurementPicker
              name="anthropometryId"
              measurements={measurements}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
});

const StepLab = React.memo(function StepLab({
  patientId,
  errors,
}: {
  patientId: PatientId;
  errors: FieldErrors<ConsultationFormValues>;
}) {
  const { register } = useFormContextSafe();
  const { t } = useTranslation();
  const [panels, setPanels] = React.useState<
    Array<{ id: string; takenAt: string; labName: string | null; testCount: number }>
  >([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    labPanelService.list
      .execute({ patientId, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setPanels(
          res.items.map((p) => ({
            id: p.id.toString(),
            takenAt: p.takenAt.toISOString().slice(0, 10),
            labName: p.labName,
            testCount: p.results.length,
          })),
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          {t("consultation.wizard.link_lab_panel")}
        </CardTitle>
        <CardDescription>{t("consultation.wizard.link_lab_panel_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("consultation.wizard.loading_panels")}</p>
        ) : panels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("consultation.wizard.no_panels")}</p>
        ) : (
          <div className="space-y-2">
            {panels.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  value={p.id}
                  {...register("labPanelId")}
                  className="size-4 accent-primary"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {p.takenAt}
                    {p.labName && <span className="ml-2 text-xs text-muted-foreground">{p.labName}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("consultation.wizard.test_count", { count: p.testCount })}
                  </p>
                </div>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                value=""
                {...register("labPanelId")}
                className="size-4 accent-primary"
              />
              <span className="text-sm text-muted-foreground">{t("common.none")}</span>
            </label>
          </div>
        )}
        {errors.labPanelId?.message && (
          <p className="mt-1.5 text-xs text-destructive">{errors.labPanelId.message}</p>
        )}
      </CardContent>
    </Card>
  );
});

const StepPlan = React.memo(function StepPlan({
  patientId,
  errors,
  isBeginnerMode,
}: {
  patientId: PatientId;
  errors: FieldErrors<ConsultationFormValues>;
  isBeginnerMode: boolean;
}) {
  const { register, watch, setValue } = useFormContextSafe();
  const { t } = useTranslation();
  const anthropometryId = watch("anthropometryId");
  const labPanelId = watch("labPanelId");
  const vitalsTaken = watch("vitalsTaken");
  const vitals = watch("vitalSigns");
  const ai = useAI();

  const handleAIDraft = async () => {
    const values = watch();
    const v = vitalsTaken && vitals
      ? `${vitals.systolicMmHg ?? "?"}/${vitals.diastolicMmHg ?? "?"} PA, ${vitals.heartRateBpm ?? "?"} lpm, ${vitals.temperatureC ?? "?"}°C`
      : "No tomados";

    const result = await ai.execute("draftClinicalNotes", {
      reason: values.reason ?? "",
      subjective: values.subjective ?? "",
      objective: values.objective ?? "",
      vitals: v,
      anthropometrySummary: anthropometryId ? `Registro antropométrico disponible (ID: ${anthropometryId})` : "No disponible",
      labSummary: labPanelId ? `Panel de laboratorio disponible (ID: ${labPanelId})` : "No disponible",
      patientId,
    });

    if (result?.success && result.data) {
      const d = result.data as { assessment?: string; plan?: string };
      if (d.assessment) setValue("assessment", d.assessment, { shouldDirty: true });
      if (d.plan) setValue("plan", d.plan, { shouldDirty: true });
      toast.success(t("consultation.wizard.ai_draft_success"));
    } else if (ai.error) {
      toast.error(t("consultation.wizard.ai_draft_error"), { description: ai.error });
    }
  };

  return (
    <div className="space-y-4">
      <ClinicalSuggestionCard
        patientId={patientId}
        anthropometryId={anthropometryId ?? null}
        labPanelId={labPanelId ?? null}
        vitalsTaken={!!vitalsTaken}
        vitals={
          vitalsTaken && vitals
            ? Vitals.from({
                systolicMmHg: vitals.systolicMmHg ?? null,
                diastolicMmHg: vitals.diastolicMmHg ?? null,
                heartRateBpm: vitals.heartRateBpm ?? null,
                temperatureC: vitals.temperatureC ?? null,
              })
            : Vitals.empty()
        }
        onApplyAssessment={(text) => setValue("assessment", text, { shouldDirty: true })}
        onApplyPlan={(text) => setValue("plan", text, { shouldDirty: true })}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            {t("consultation.wizard.assessment_and_plan")}
          </CardTitle>
          <CardDescription>{t("consultation.wizard.assessment_and_plan_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isBeginnerMode ? t("consultation.wizard.ai_draft_hint_beginner") : t("consultation.wizard.ai_draft_hint")}
            </p>
            <AIAssistButton
              capability="draftClinicalNotes"
              busy={ai.busy}
              patientId={patientId.toString()}
              onClick={handleAIDraft}
            />
          </div>
          <Field label={t("consultation.wizard.assessment")} htmlFor="field-consultation-assessment" error={errors.assessment?.message}>
            <Textarea
              id="field-consultation-assessment"
              {...register("assessment")}
              rows={4}
              placeholder={t("consultation.wizard.assessment_placeholder")}
              aria-describedby={errors.assessment ? "field-consultation-assessment-error" : undefined}
            />
          </Field>
          <Field label={t("consultation.wizard.plan")} htmlFor="field-consultation-plan" error={errors.plan?.message}>
            <Textarea
              id="field-consultation-plan"
              {...register("plan")}
              rows={5}
              placeholder={t("consultation.wizard.plan_placeholder")}
              aria-describedby={errors.plan ? "field-consultation-plan-error" : undefined}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("consultation.wizard.next_appointment")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label={t("consultation.wizard.next_appointment_date")} htmlFor="field-consultation-next-visit" error={errors.nextVisitDate?.message}>
            <Input type="date" id="field-consultation-next-visit" {...register("nextVisitDate")} aria-describedby={errors.nextVisitDate ? "field-consultation-next-visit-error" : undefined} />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
});

const StepReview = React.memo(function StepReview({ patientId }: { patientId: string }) {
  const { watch } = useFormContextSafe();
  const { t } = useTranslation();
  const v = watch();
  const ai = useAI();
  const [summary, setSummary] = React.useState<string | null>(null);

  const vs = v.vitalSigns ?? {};
  const vsRow = [
    vs.systolicMmHg ? `PA ${vs.systolicMmHg}/${vs.diastolicMmHg ?? "?"}` : null,
    vs.heartRateBpm ? `FC ${vs.heartRateBpm} lpm` : null,
    vs.temperatureC ? `T° ${vs.temperatureC}°C` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleAISummarize = async () => {
    const context = {
      reason: v.reason ?? "",
      subjective: v.subjective ?? "",
      objective: v.objective ?? "",
      assessment: v.assessment ?? "",
      plan: v.plan ?? "",
      vitals: vsRow || "No tomados",
      anthropometrySummary: v.anthropometryId ? `Registro antropométrico disponible (ID: ${v.anthropometryId})` : "No disponible",
      labSummary: v.labPanelId ? `Panel de laboratorio disponible (ID: ${v.labPanelId})` : "No disponible",
    };

    const result = await ai.execute("summarizeConsultation", context);
    if (result?.success && result.data) {
      const d = result.data as { summary: string };
      setSummary(d.summary);
      toast.success(t("consultation.wizard.ai_summarize_success"));
    } else if (ai.error) {
      toast.error(t("consultation.wizard.ai_summarize_error"), { description: ai.error });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("consultation.wizard.review")}
            </CardTitle>
            <CardDescription>{t("consultation.wizard.review_description")}</CardDescription>
          </div>
          <AIAssistButton
              capability="summarizeConsultation"
              busy={ai.busy}
              patientId={patientId.toString()}
              onClick={handleAISummarize}
            />
        </div>
      </CardHeader>
      {summary && (
        <CardContent className="border-b bg-muted/20 pb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("consultation.wizard.ai_summarize")}
          </h4>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
        </CardContent>
      )}
      <CardContent className="space-y-4">
        <ReviewSection title={t("consultation.wizard.review_basic_info")}>
          <ReviewRow
            label={t("consultation.wizard.date")}
            value={
              v.consultationDate
                ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(v.consultationDate))
                : "—"
            }
          />
          <ReviewRow label={t("consultation.wizard.reason")} value={v.reason || "—"} />
        </ReviewSection>

        <ReviewSection title={t("consultation.wizard.review_subjective")}>
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.subjective || <em className="text-muted-foreground">{t("consultation.wizard.no_notes")}</em>}
          </p>
        </ReviewSection>

        <ReviewSection title={t("consultation.wizard.review_objective")}>
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.objective || <em className="text-muted-foreground">{t("consultation.wizard.no_notes")}</em>}
          </p>
          {vsRow && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              {vsRow}
            </p>
          )}
          {v.anthropometryId && (
            <Badge variant="info" className="mt-2">
              {t("consultation.wizard.anthropometry_linked")}
            </Badge>
          )}
        </ReviewSection>

        <ReviewSection title={t("consultation.wizard.review_lab")}>
          {v.labPanelId ? (
            <Badge variant="info">{t("consultation.wizard.lab_panel_linked")}</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">{t("consultation.wizard.no_lab_panel")}</p>
          )}
        </ReviewSection>

        <ReviewSection title={t("consultation.wizard.review_assessment")}>
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.assessment || <em className="text-muted-foreground">{t("consultation.wizard.no_assessment")}</em>}
          </p>
        </ReviewSection>

        <ReviewSection title={t("consultation.wizard.review_plan")}>
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.plan || <em className="text-muted-foreground">{t("consultation.wizard.no_plan")}</em>}
          </p>
          {v.nextVisitDate && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("consultation.wizard.next_appointment_label")}:{" "}
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(v.nextVisitDate))}
            </p>
          )}
        </ReviewSection>
      </CardContent>
    </Card>
  );
});

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b pb-1.5 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm sm:text-right">{value}</span>
    </div>
  );
}

function MeasurementPicker({
  name,
  measurements,
}: {
  name: keyof ConsultationFormValues;
  measurements: Array<{ id: string; measuredAt: string; weightKg: number; heightCm: number; bmi: number }>;
}) {
  const { register } = useFormContextSafe();
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {measurements.map((m) => (
        <label
          key={m.id}
          className="flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            type="radio"
            value={m.id}
            {...register(name)}
            className="size-4 accent-primary"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{m.measuredAt}</p>
            <p className="break-words text-xs text-muted-foreground">
              {t("consultation.wizard.weight")} {m.weightKg.toFixed(1)} kg · {t("consultation.wizard.height")} {m.heightCm.toFixed(0)} cm · BMI {m.bmi.toFixed(1)}
            </p>
          </div>
        </label>
      ))}
      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
        <input
          type="radio"
          value=""
          {...register(name)}
          className="size-4 accent-primary"
        />
        <span className="text-sm text-muted-foreground">{t("common.none_f")}</span>
      </label>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <Label className="text-sm" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function useFormContextSafe() {
  return useFormContext();
}

interface ClinicalSuggestionCardProps {
  patientId: PatientId;
  anthropometryId: string | null;
  labPanelId: string | null;
  vitalsTaken: boolean;
  vitals: Vitals;
  onApplyAssessment: (text: string) => void;
  onApplyPlan: (text: string) => void;
}

const CONFIDENCE_BADGE: Record<"low" | "medium" | "high", "secondary" | "default" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
};

function ClinicalSuggestionCard({
  patientId,
  anthropometryId,
  labPanelId,
  vitalsTaken,
  vitals,
  onApplyAssessment,
  onApplyPlan,
}: ClinicalSuggestionCardProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticSuggestion[] | null>(null);
  const [plan, setPlan] = React.useState<PlanTargetSuggestion | null>(null);

  const canCompute =
    anthropometryId !== null || labPanelId !== null || (vitalsTaken && !vitals.isEmpty);

  const onSuggest = async () => {
    setBusy(true);
    try {
      const bundle = await clinicalSuggestionService.gather(patientId, {
        anthropometryId,
        labPanelId,
        vitals: vitalsTaken ? vitals : Vitals.empty(),
      });
      setDiagnostics(bundle.diagnostics);
      setPlan(bundle.plan);
      if (bundle.diagnostics.length === 0 && bundle.plan === null) {
        toast.info(t("consultation.wizard.toast_no_suggestions"), {
          description: t("consultation.wizard.toast_no_suggestions_description"),
        });
      } else {
        toast.success(t("consultation.wizard.toast_suggestions_count", { count: bundle.diagnostics.length }));
      }
    } catch (err) {
      toast.error(t("consultation.wizard.toast_suggestions_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onApplyDiagnostics = () => {
    if (!diagnostics || diagnostics.length === 0) return;
    const text = diagnostics
      .map((d) => `${d.label} (${ConfidenceLabel[d.confidence]}) — ${d.rationale}`)
      .join("\n");
    onApplyAssessment(text);
    toast.success(t("consultation.wizard.toast_diagnostic_inserted"));
  };

  const onApplyPlanTargets = () => {
    if (!plan) return;
    const text =
      `Plan ${plan.goal === "loss" ? "hipocalórico" : plan.goal === "gain" ? "hipercalórico" : "de mantenimiento"} ` +
      `${plan.kcalTarget} kcal/día ` +
      `(proteína ${plan.proteinG} g · CHO ${plan.carbsG} g · grasa ${plan.fatG} g). ` +
      `BMR ${plan.bmrKcal} kcal (${plan.bmrFormula}), TDEE ${plan.tdeeKcal} kcal (actividad ${plan.activityLevel}). ` +
      `${plan.rationale}.`;
    onApplyPlan(text);
    toast.success(t("consultation.wizard.toast_plan_inserted"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("consultation.wizard.system_suggestions")}
        </CardTitle>
        <CardDescription>
          {t("consultation.wizard.system_suggestions_description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onSuggest} disabled={busy || !canCompute}>
            <Sparkles className="mr-2 h-4 w-4" />
            {busy ? t("consultation.wizard.analyzing") : t("consultation.wizard.suggest_diagnostic_plan")}
          </Button>
          {diagnostics !== null && diagnostics.length > 0 && (
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={onApplyDiagnostics}>
              {t("consultation.wizard.insert_diagnostic")}
            </Button>
          )}
          {plan !== null && (
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={onApplyPlanTargets}>
              {t("consultation.wizard.insert_plan")}
            </Button>
          )}
          {!canCompute && (
            <p className="text-xs text-muted-foreground">
              {t("consultation.wizard.enable_suggestions_hint")}
            </p>
          )}
        </div>

        {diagnostics !== null && diagnostics.length > 0 && (
          <ul className="space-y-1 text-sm">
            {diagnostics.map((d) => (
              <li key={d.code} className="flex items-start gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
                <Badge variant={CONFIDENCE_BADGE[d.confidence]} className="shrink-0 text-xs">
                  {ConfidenceLabel[d.confidence]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.rationale}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {plan !== null && (
          <div className="rounded-md border bg-primary/5 p-2 text-sm">
            <p className="font-medium">
              {plan.goal === "loss" ? t("consultation.wizard.deficit") : plan.goal === "gain" ? t("consultation.wizard.surplus") : t("consultation.wizard.maintenance")} · {plan.kcalTarget} kcal
            </p>
            <p className="text-xs text-muted-foreground">
              P {plan.proteinG} g · CHO {plan.carbsG} g · G {plan.fatG} g · TDEE {plan.tdeeKcal} kcal
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
