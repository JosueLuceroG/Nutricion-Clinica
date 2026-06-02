import * as React from "react";
import { useForm, FormProvider, useFormContext, type FieldErrors, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
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
import type { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { cn } from "@utils/cn";

interface ConsultationWizardProps {
  patientId: PatientId;
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

export function ConsultationWizard({ patientId, onComplete }: ConsultationWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);

  const methods = useForm<ConsultationFormValues>({
    resolver: zodResolver(ConsultationFormSchema),
    defaultValues: consultationFormDefaultValues,
    mode: "onChange",
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

  const onSubmit = methods.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const nextVisitDate = values.nextVisitDate ? new Date(values.nextVisitDate) : null;
      const consultation = await consultationService.schedule.execute({
        patientId,
        consultationDate: new Date(values.consultationDate),
        consultationNumber: 0,
        reason: values.reason.trim(),
        subjective: values.subjective,
        objective: values.objective,
        assessment: values.assessment,
        plan: values.plan,
        anthropometryId: values.anthropometryId ? AnthropometryId.fromUnsafe(values.anthropometryId) : null,
        labPanelId: values.labPanelId ? LabPanelId.fromUnsafe(values.labPanelId) : null,
        nextVisitDate,
      });

      toast.success("Consulta registrada", {
        description: `Consulta #${consultation.consultationNumber} agendada`,
      });

      if (onComplete) {
        onComplete(consultation.id.toString());
      } else {
        navigate(`/pacientes/${patientId.toString()}/consultas`);
      }
    } catch (err) {
      toast.error("No se pudo guardar la consulta", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  });

  const errors = methods.formState.errors as FieldErrors<ConsultationFormValues>;
  const currentStepDef = WIZARD_STEPS[step - 1];

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} noValidate>
        <div className="space-y-6">
          <Stepper current={step} onSelect={goToStep} />

          {step === 1 && <StepBasics errors={errors} />}
          {step === 2 && <StepSubjective errors={errors} />}
          {step === 3 && <StepObjective patientId={patientId} errors={errors} />}
          {step === 4 && <StepLab patientId={patientId} errors={errors} />}
          {step === 5 && <StepPlan errors={errors} />}
          {step === 6 && <StepReview />}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <div>
              {step > 1 && (
                <Button type="button" variant="outline" onClick={goBack} disabled={submitting}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={submitting}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              {step < WIZARD_STEPS.length ? (
                <Button type="button" onClick={goNext}>
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={submitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {submitting ? "Guardando…" : "Guardar consulta"}
                </Button>
              )}
            </div>
          </div>
          {currentStepDef && step < WIZARD_STEPS.length && (
            <p className="text-center text-xs text-muted-foreground">
              Paso {step} de {WIZARD_STEPS.length} · {currentStepDef.title}
            </p>
          )}
        </div>
      </form>
    </FormProvider>
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
          <li key={s.key} className="flex flex-1 items-center gap-1">
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

function StepBasics({ errors }: { errors: FieldErrors<ConsultationFormValues> }) {
  const { register } = useFormContextSafe();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Datos básicos de la consulta
        </CardTitle>
        <CardDescription>Fecha y motivo principal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Fecha" error={errors.consultationDate?.message} required>
          <Input type="date" {...register("consultationDate")} aria-invalid={!!errors.consultationDate} />
        </Field>
        <Field label="Motivo de consulta" error={errors.reason?.message} required>
          <Textarea
            {...register("reason")}
            rows={3}
            placeholder="Ej. Control trimestral, paciente busca bajar de peso, seguimiento de diabetes…"
            aria-invalid={!!errors.reason}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function StepSubjective({ errors }: { errors: FieldErrors<ConsultationFormValues> }) {
  const { register } = useFormContextSafe();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Subjetivo (S)
        </CardTitle>
        <CardDescription>Lo que el paciente reporta: síntomas, antecedentes, cambios recientes</CardDescription>
      </CardHeader>
      <CardContent>
        <Field label="Notas subjetivas" error={errors.subjective?.message}>
          <Textarea
            {...register("subjective")}
            rows={6}
            placeholder="Síntomas, cambios en apetito/energía, adherencia al plan anterior, eventos relevantes…"
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function StepObjective({
  patientId,
  errors,
}: {
  patientId: PatientId;
  errors: FieldErrors<ConsultationFormValues>;
}) {
  const { register } = useFormContextSafe();
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
            Objetivo (O) — signos vitales
          </CardTitle>
          <CardDescription>Toma clínica del día</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tensión arterial sistólica (mmHg)" error={errors.vitalSigns?.systolicMmHg?.message}>
            <Input
              type="number"
              {...register("vitalSigns.systolicMmHg", { valueAsNumber: true })}
              placeholder="120"
            />
          </Field>
          <Field label="Tensión arterial diastólica (mmHg)" error={errors.vitalSigns?.diastolicMmHg?.message}>
            <Input
              type="number"
              {...register("vitalSigns.diastolicMmHg", { valueAsNumber: true })}
              placeholder="80"
            />
          </Field>
          <Field label="Frecuencia cardíaca (lpm)" error={errors.vitalSigns?.heartRateBpm?.message}>
            <Input
              type="number"
              {...register("vitalSigns.heartRateBpm", { valueAsNumber: true })}
              placeholder="72"
            />
          </Field>
          <Field label="Temperatura (°C)" error={errors.vitalSigns?.temperatureC?.message}>
            <Input
              type="number"
              step="0.1"
              {...register("vitalSigns.temperatureC", { valueAsNumber: true })}
              placeholder="36.5"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exploración física</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Notas de exploración" error={errors.objective?.message}>
            <Textarea
              {...register("objective")}
              rows={4}
              placeholder="Edema, palidez, hidratación, hallazgos a la exploración…"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vincular medición antropométrica</CardTitle>
          <CardDescription>Opcional — selecciona una medición reciente del paciente</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando mediciones…</p>
          ) : measurements.length === 0 ? (
            <p className="text-sm text-muted-foreground">El paciente no tiene mediciones registradas.</p>
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
}

function StepLab({
  patientId,
  errors,
}: {
  patientId: PatientId;
  errors: FieldErrors<ConsultationFormValues>;
}) {
  const { register } = useFormContextSafe();
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
          Vincular panel de laboratorio
        </CardTitle>
        <CardDescription>Opcional — selecciona un panel reciente para referenciarlo en esta consulta</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando paneles…</p>
        ) : panels.length === 0 ? (
          <p className="text-sm text-muted-foreground">El paciente no tiene paneles de laboratorio.</p>
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
                    {p.testCount} prueba{p.testCount === 1 ? "" : "s"}
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
              <span className="text-sm text-muted-foreground">Ninguno</span>
            </label>
          </div>
        )}
        {errors.labPanelId?.message && (
          <p className="mt-1.5 text-xs text-destructive">{errors.labPanelId.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StepPlan({ errors }: { errors: FieldErrors<ConsultationFormValues> }) {
  const { register } = useFormContextSafe();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Diagnóstico (A) y Plan (P)
          </CardTitle>
          <CardDescription>Interpretación clínica y plan a seguir</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Diagnóstico / evaluación nutricional" error={errors.assessment?.message}>
            <Textarea
              {...register("assessment")}
              rows={4}
              placeholder="Sobrepeso grado I, riesgo cardiometabólico moderado, deficiencia de vitamina D…"
            />
          </Field>
          <Field label="Plan y recomendaciones" error={errors.plan?.message}>
            <Textarea
              {...register("plan")}
              rows={5}
              placeholder="Dieta hipocalórica 1500 kcal, 30 min actividad aeróbica 5x/semana, suplementación…"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próxima cita</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Fecha de próxima cita" error={errors.nextVisitDate?.message}>
            <Input type="date" {...register("nextVisitDate")} />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function StepReview() {
  const { watch } = useFormContextSafe();
  const v = watch();

  const vs = v.vitalSigns ?? {};
  const vsRow = [
    vs.systolicMmHg ? `PA ${vs.systolicMmHg}/${vs.diastolicMmHg ?? "?"}` : null,
    vs.heartRateBpm ? `FC ${vs.heartRateBpm} lpm` : null,
    vs.temperatureC ? `T° ${vs.temperatureC}°C` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Revisión
        </CardTitle>
        <CardDescription>Verifica la información antes de guardar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ReviewSection title="Datos básicos">
          <ReviewRow
            label="Fecha"
            value={
              v.consultationDate
                ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(v.consultationDate))
                : "—"
            }
          />
          <ReviewRow label="Motivo" value={v.reason || "—"} />
        </ReviewSection>

        <ReviewSection title="Subjetivo (S)">
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.subjective || <em className="text-muted-foreground">Sin notas</em>}
          </p>
        </ReviewSection>

        <ReviewSection title="Objetivo (O)">
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.objective || <em className="text-muted-foreground">Sin notas</em>}
          </p>
          {vsRow && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              {vsRow}
            </p>
          )}
          {v.anthropometryId && (
            <Badge variant="info" className="mt-2">
              Medición antropométrica vinculada
            </Badge>
          )}
        </ReviewSection>

        <ReviewSection title="Laboratorio">
          {v.labPanelId ? (
            <Badge variant="info">Panel de laboratorio vinculado</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">Sin panel vinculado</p>
          )}
        </ReviewSection>

        <ReviewSection title="Diagnóstico (A)">
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.assessment || <em className="text-muted-foreground">Sin diagnóstico</em>}
          </p>
        </ReviewSection>

        <ReviewSection title="Plan (P)">
          <p className="whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-sm">
            {v.plan || <em className="text-muted-foreground">Sin plan</em>}
          </p>
          {v.nextVisitDate && (
            <p className="mt-2 text-xs text-muted-foreground">
              Próxima cita:{" "}
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(new Date(v.nextVisitDate))}
            </p>
          )}
        </ReviewSection>
      </CardContent>
    </Card>
  );
}

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
    <div className="flex items-start justify-between gap-4 border-b pb-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
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
          <div className="flex-1">
            <p className="text-sm font-medium">{m.measuredAt}</p>
            <p className="text-xs text-muted-foreground">
              Peso {m.weightKg.toFixed(1)} kg · Talla {m.heightCm.toFixed(0)} cm · BMI {m.bmi.toFixed(1)}
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
        <span className="text-sm text-muted-foreground">Ninguna</span>
      </label>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function useFormContextSafe() {
  return useFormContext();
}
