import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Save, X, Ruler, Activity } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  AnthropometryFormSchema,
  anthropometryFormDefaultValues,
  type AnthropometryFormValues,
} from "@modules/anthropometry/application/anthropometryFormSchema";
import type { Sex } from "@modules/patient/domain/Sex";
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
  const { t } = useTranslation();
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

      toast.success(t("anthropometry.save"), {
        description: `BMI: ${created.bmi.toFixed(1)}`,
      });
      navigate(`/pacientes/${patientId.toString()}`);
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = (errs: typeof errors) => {
    const messages = Object.entries(errs)
      .map(([k, v]) => {
        const msg = (v as { message?: string } | undefined)?.message;
        return msg ? `${k}: ${msg}` : null;
      })
      .filter((s): s is string => s !== null);
    toast.error(t("errors.required"), {
      description: messages.length > 0 ? messages.join("\n") : t("anthropometry.measurements"),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t("anthropometry.measurements")}
          </CardTitle>
          <CardDescription>{t("anthropometry.column_weight")}, {t("anthropometry.height_cm")} {t("common.date")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField label={t("common.date")} error={errors.measuredAt?.message} required htmlFor="field-anthropometry-date">
            <Input type="date" id="field-anthropometry-date" {...register("measuredAt")} aria-invalid={!!errors.measuredAt} aria-describedby={errors.measuredAt ? "field-anthropometry-date-error" : undefined} />
          </FormField>
          <FormField label={t("anthropometry.weight_kg")} error={errors.weightKg?.message} required htmlFor="field-anthropometry-weight">
            <Input
              type="number"
              step="0.1"
              id="field-anthropometry-weight"
              {...register("weightKg")}
              placeholder="70.5"
              aria-invalid={!!errors.weightKg}
              aria-describedby={errors.weightKg ? "field-anthropometry-weight-error" : undefined}
            />
          </FormField>
          <FormField label={t("anthropometry.height_cm")} error={errors.heightCm?.message} required htmlFor="field-anthropometry-height">
            <Input
              type="number"
              step="0.1"
              id="field-anthropometry-height"
              {...register("heightCm")}
              placeholder="170"
              aria-invalid={!!errors.heightCm}
              aria-describedby={errors.heightCm ? "field-anthropometry-height-error" : undefined}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            {t("anthropometry.circumferences")}
          </CardTitle>
          <CardDescription>{t("common.optional")} - {t("anthropometry.body_fat_pct")}, RCC, RCE</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ["neck", t("anthropometry.neck_cm")],
              ["chest", t("anthropometry.chest_cm")],
              ["waist", t("anthropometry.waist_cm")],
              ["hip", t("anthropometry.hip_cm")],
              ["arm", t("anthropometry.arm_cm")],
              ["forearm", t("anthropometry.forearm_cm")],
              ["thigh", t("anthropometry.thigh_cm")],
              ["calf", t("anthropometry.calf_cm")],
            ] as const
          ).map(([k, label]) => (
            <FormField key={k} label={label} error={errors[k]?.message} htmlFor={`field-anthropometry-${k}`}>
              <Input
                type="number"
                step="0.1"
                id={`field-anthropometry-${k}`}
                {...register(k)}
                placeholder="—"
                aria-invalid={!!errors[k]}
                aria-describedby={errors[k] ? `field-anthropometry-${k}-error` : undefined}
              />
            </FormField>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("anthropometry.skinfolds")}</CardTitle>
          <CardDescription>{t("anthropometry.body_fat_pct")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ["triceps", t("anthropometry.triceps_mm")],
              ["biceps", t("anthropometry.biceps_mm")],
              ["subscapular", t("anthropometry.subscapular_mm")],
              ["suprailiac", t("anthropometry.suprailiac_mm")],
              ["abdominal", t("anthropometry.abdominal_mm")],
              ["thigh_skinfold", t("anthropometry.thigh_skinfold_mm")],
              ["calf_skinfold", t("anthropometry.calf_skinfold_mm")],
            ] as const
          ).map(([k, label]) => (
            <FormField key={k} label={label} error={errors[k]?.message} htmlFor={`field-anthropometry-${k}`}>
              <Input
                type="number"
                step="0.1"
                id={`field-anthropometry-${k}`}
                {...register(k)}
                placeholder="—"
                aria-invalid={!!errors[k]}
                aria-describedby={errors[k] ? `field-anthropometry-${k}-error` : undefined}
              />
            </FormField>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("common.notes")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("patient.sex")} error={errors.sex?.message} htmlFor="field-anthropometry-sex">
              <select
                id="field-anthropometry-sex"
                {...register("sex")}
                onChange={(e) => setSex(e.target.value as Sex)}
                aria-describedby={errors.sex ? "field-anthropometry-sex-error" : undefined}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {(["female", "male", "intersex", "undisclosed"] as Sex[]).map((s) => (
                  <option key={s} value={s}>
                    {t(`patient.sex_${s}`)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t("patient.age")} error={errors.ageYears?.message} htmlFor="field-anthropometry-age">
              <Input
                type="number"
                id="field-anthropometry-age"
                {...register("ageYears")}
                onChange={(e) => setAge(Number(e.target.value) || 0)}
                aria-describedby={errors.ageYears ? "field-anthropometry-age-error" : undefined}
              />
            </FormField>
          </div>
          <div>
            <Label htmlFor="notes">{t("common.notes")}</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder={t("anthropometry.notes_placeholder")}
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
            {t("anthropometry.auto_calculated")}
            {sex === "male" || sex === "female" ? ` ${t("anthropometry.auto_calculated_jackson")}` : "."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
          <X className="mr-2 h-4 w-4" />
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          <Save className="mr-2 h-4 w-4" />
          {submitting ? t("common.saving") : t("anthropometry.save")}
        </Button>
      </div>
    </form>
  );
}

function FormField({
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
