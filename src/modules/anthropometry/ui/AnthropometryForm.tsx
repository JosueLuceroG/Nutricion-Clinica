import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Save, X, Ruler, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  AnthropometryFormSchema,
  anthropometryFormDefaultValues,
  type AnthropometryFormValues,
} from "@modules/anthropometry/application/anthropometryFormSchema";
import { SexLabel, type Sex } from "@modules/patient/domain/Sex";
import { Weight, Height, Circumference, Skinfold } from "@modules/anthropometry/domain/Measurements";
import { anthropometryService } from "@services/anthropometryService";
import type { PatientId } from "@modules/patient/domain/PatientId";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { Alert, AlertDescription } from "@components/ui/alert";
import { Info } from "lucide-react";

interface AnthropometryFormProps {
  patientId: PatientId;
  defaultHeightCm?: number;
  defaultAge?: number;
  defaultSex?: Sex;
}

export function AnthropometryForm({
  patientId,
  defaultHeightCm,
  defaultAge,
  defaultSex,
}: AnthropometryFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  const [age, setAge] = React.useState<number | null>(defaultAge ?? null);
  const [sex, setSex] = React.useState<Sex>(defaultSex ?? "undisclosed");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<AnthropometryFormValues>({
    resolver: zodResolver(AnthropometryFormSchema),
    defaultValues: {
      ...anthropometryFormDefaultValues,
      heightCm: defaultHeightCm ? (defaultHeightCm as never) : ("" as never),
      ageYears: (defaultAge ?? 0) as never,
      sex: defaultSex ?? "undisclosed",
    },
  });

  React.useEffect(() => {
    if (defaultAge) {
      setAge(defaultAge);
      setValue("ageYears", defaultAge);
    }
    if (defaultSex) {
      setSex(defaultSex);
      setValue("sex", defaultSex);
    }
  }, [defaultAge, defaultSex, setValue]);

  const onSubmit = async (values: AnthropometryFormValues) => {
    setSubmitting(true);
    try {
      const circumferenceOf = (k: keyof typeof values): Circumference | undefined => {
        const v = values[k];
        return typeof v === "number" && Number.isFinite(v) && v > 0
          ? Circumference.fromCm(v)
          : undefined;
      };

      const skinfoldOf = (k: keyof typeof values): Skinfold | undefined => {
        const v = values[k];
        return typeof v === "number" && Number.isFinite(v) && v >= 0
          ? Skinfold.fromMm(v)
          : undefined;
      };

      const created = await anthropometryService.create.execute({
        patientId,
        measuredAt: new Date(values.measuredAt),
        weight: Weight.fromKg(values.weightKg),
        height: Height.fromCentimeters(values.heightCm),
        circumferences: {
          neck: circumferenceOf("neck"),
          chest: circumferenceOf("chest"),
          waist: circumferenceOf("waist"),
          hip: circumferenceOf("hip"),
          arm: circumferenceOf("arm"),
          forearm: circumferenceOf("forearm"),
          thigh: circumferenceOf("thigh"),
          calf: circumferenceOf("calf"),
        },
        skinfolds: {
          triceps: skinfoldOf("triceps"),
          biceps: skinfoldOf("biceps"),
          subscapular: skinfoldOf("subscapular"),
          suprailiac: skinfoldOf("suprailiac"),
          abdominal: skinfoldOf("abdominal"),
          thigh: skinfoldOf("thigh_skinfold"),
          calf: skinfoldOf("calf_skinfold"),
        },
        notes: values.notes ?? null,
      });

      toast.success("Medición registrada", {
        description: `BMI: ${created.bmi.toFixed(1)}`,
      });
      navigate(`/pacientes/${patientId.toString()}`);
    } catch (err) {
      toast.error("No se pudo registrar la medición", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Datos básicos
          </CardTitle>
          <CardDescription>Peso, talla y fecha de la medición</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField label="Fecha" error={errors.measuredAt?.message} required>
            <Input type="date" {...register("measuredAt")} aria-invalid={!!errors.measuredAt} />
          </FormField>
          <FormField label="Peso (kg)" error={errors.weightKg?.message} required>
            <Input
              type="number"
              step="0.1"
              {...register("weightKg")}
              placeholder="70.5"
              aria-invalid={!!errors.weightKg}
            />
          </FormField>
          <FormField label="Talla (cm)" error={errors.heightCm?.message} required>
            <Input
              type="number"
              step="0.1"
              {...register("heightCm")}
              placeholder="170"
              aria-invalid={!!errors.heightCm}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Circunferencias (cm)
          </CardTitle>
          <CardDescription>Opcionales — registradas para % grasa, RCC, RCE y masa muscular</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ["neck", "Cuello"],
              ["chest", "Tórax"],
              ["waist", "Cintura"],
              ["hip", "Cadera"],
              ["arm", "Brazo"],
              ["forearm", "Antebrazo"],
              ["thigh", "Muslo"],
              ["calf", "Pantorrilla"],
            ] as const
          ).map(([k, label]) => (
            <FormField key={k} label={label} error={errors[k]?.message}>
              <Input
                type="number"
                step="0.1"
                {...register(k)}
                placeholder="—"
                aria-invalid={!!errors[k]}
              />
            </FormField>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pliegues cutáneos (mm)</CardTitle>
          <CardDescription>Para cálculo de % grasa por Jackson-Pollock</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ["triceps", "Tríceps"],
              ["biceps", "Bíceps"],
              ["subscapular", "Subescapular"],
              ["suprailiac", "Suprailiaco"],
              ["abdominal", "Abdominal"],
              ["thigh_skinfold", "Muslo"],
              ["calf_skinfold", "Pantorrilla"],
            ] as const
          ).map(([k, label]) => (
            <FormField key={k} label={label} error={errors[k]?.message}>
              <Input
                type="number"
                step="0.1"
                {...register(k)}
                placeholder="—"
                aria-invalid={!!errors[k]}
              />
            </FormField>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contexto clínico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Sexo (para cálculos)" error={errors.sex?.message}>
              <select
                {...register("sex")}
                onChange={(e) => setSex(e.target.value as Sex)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {(Object.keys(SexLabel) as Sex[]).map((s) => (
                  <option key={s} value={s}>
                    {SexLabel[s]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Edad actual" error={errors.ageYears?.message}>
              <Input
                type="number"
                {...register("ageYears")}
                onChange={(e) => setAge(Number(e.target.value) || 0)}
              />
            </FormField>
          </div>
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Condiciones de la medición, observaciones, equipo utilizado…"
              rows={3}
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {age !== null && sex !== "undisclosed" && sex !== "intersex" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Se calcularán automáticamente: BMI, % grasa (Deurenberg), RCC, RCE
            {sex === "male" || sex === "female" ? " y % grasa por Jackson-Pollock (si hay pliegues)." : "."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          <Save className="mr-2 h-4 w-4" />
          {submitting ? "Guardando…" : "Registrar medición"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
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

export function AnthropometryFormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-72" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
