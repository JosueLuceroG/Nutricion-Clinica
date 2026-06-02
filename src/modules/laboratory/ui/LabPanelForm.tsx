import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Save, X, FlaskConical, Info, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  LabPanelFormSchema,
  labPanelFormDefaultValues,
  type LabPanelFormValues,
} from "@modules/laboratory/application/labPanelFormSchema";
import { LAB_TEST_CODES, LabTestCategoryLabel, getLabTestsByCategory, type LabTestCode, type LabTestDefinition } from "@modules/laboratory/domain/LabTest";
import { classifyLabValue } from "@modules/laboratory/domain/LabResult";
import { findReferenceRange } from "@modules/laboratory/domain/LabReferenceRange";
import { MEXICO_REFERENCE_RANGES } from "@modules/laboratory/data/mexicoReferenceRanges";
import { LabResult } from "@modules/laboratory/domain/LabResult";
import { labPanelService } from "@services/labPanelService";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { Sex } from "@modules/patient/domain/Sex";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";

interface LabPanelFormProps {
  patientId: PatientId;
  patientAge: number;
  patientSex: Sex;
}

const grouped = getLabTestsByCategory();

export function LabPanelForm({ patientId, patientAge, patientSex }: LabPanelFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LabPanelFormValues>({
    resolver: zodResolver(LabPanelFormSchema),
    defaultValues: labPanelFormDefaultValues,
  });

  const values = watch();

  const onSubmit = async (data: LabPanelFormValues) => {
    setSubmitting(true);
    try {
      const results = LAB_TEST_CODES
        .map((code) => {
          const v = data[code];
          if (typeof v === "number" && Number.isFinite(v)) {
            return LabResult.from({ test: code, value: v });
          }
          return null;
        })
        .filter((r): r is LabResult => r !== null);

      if (results.length === 0) {
        toast.error("Captura al menos un valor de laboratorio");
        return;
      }

      await labPanelService.create.execute({
        patientId,
        takenAt: new Date(data.takenAt),
        labName: data.labName?.trim() ? data.labName.trim() : null,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        results,
      });

      toast.success("Panel de laboratorio guardado", {
        description: `${results.length} resultado${results.length === 1 ? "" : "s"} registrados`,
      });
      navigate(`/pacientes/${patientId.toString()}/laboratorio`);
    } catch (err) {
      toast.error("No se pudo guardar el panel", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const watchedCodes = new Set<LabTestCode>(
    LAB_TEST_CODES.filter((c) => {
      const v = values[c];
      return typeof v === "number" && Number.isFinite(v);
    }),
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Datos del panel
          </CardTitle>
          <CardDescription>Fecha de la toma y referencia del laboratorio</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Fecha de toma" error={errors.takenAt?.message} required>
            <Input type="date" {...register("takenAt")} aria-invalid={!!errors.takenAt} />
          </FormField>
          <FormField label="Laboratorio (opcional)" error={errors.labName?.message}>
            <Input
              type="text"
              {...register("labName")}
              placeholder="Ej. Laboratorios Chopo, Olarte, etc."
            />
          </FormField>
        </CardContent>
      </Card>

      {Object.entries(grouped).map(([category, tests]) => (
        <LabCategorySection
          key={category}
          category={category as keyof typeof LabTestCategoryLabel}
          tests={tests}
          watched={values}
          errors={errors}
          register={register}
          patientAge={patientAge}
          patientSex={patientSex}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Notas clínicas</CardTitle>
          <CardDescription>Contexto, condiciones de la toma, indicaciones del médico</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            {...register("notes")}
            placeholder="Ej. Ayuno de 12 h, paciente en tratamiento con metformina…"
            rows={3}
            aria-invalid={!!errors.notes}
          />
          {errors.notes?.message && (
            <p className="mt-1.5 text-xs text-destructive">{errors.notes.message}</p>
          )}
        </CardContent>
      </Card>

      {watchedCodes.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Resumen de captura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Se registrarán {watchedCodes.size} resultado
              {watchedCodes.size === 1 ? "" : "s"}. Las alertas se calculan al guardar según
              el rango de referencia del paciente.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          <Save className="mr-2 h-4 w-4" />
          {submitting ? "Guardando…" : "Registrar panel"}
        </Button>
      </div>
    </form>
  );
}

function LabCategorySection({
  category,
  tests,
  watched,
  errors,
  register,
  patientAge,
  patientSex,
}: {
  category: keyof typeof LabTestCategoryLabel;
  tests: ReadonlyArray<LabTestDefinition>;
  watched: LabPanelFormValues;
  errors: Record<string, { message?: string } | undefined>;
  register: ReturnType<typeof useForm<LabPanelFormValues>>["register"];
  patientAge: number;
  patientSex: Sex;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4" />
          {LabTestCategoryLabel[category]}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tests.map((test) => {
          const value = watched[test.code];
          const hasValue = typeof value === "number" && Number.isFinite(value);
          const range = findReferenceRange(test.code, patientSex, patientAge, MEXICO_REFERENCE_RANGES);
          const flag = hasValue ? classifyLabValue(value as number, range) : "normal";

          return (
            <FormField
              key={test.code}
              label={`${test.name} (${test.unit})`}
              error={errors[test.code]?.message}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step={test.decimals > 0 ? `0.${"0".repeat(test.decimals)}1` : "1"}
                  {...register(test.code)}
                  placeholder="—"
                  aria-invalid={!!errors[test.code]}
                />
                {hasValue && flag !== "normal" && (
                  <Badge variant={flag === "critical-low" || flag === "critical-high" ? "destructive" : "warning"}>
                    {flag === "low" ? "↓" : flag === "high" ? "↑" : flag === "critical-low" ? "↓↓" : "↑↑"}
                  </Badge>
                )}
              </div>
              {range && hasValue && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Rango: {range.low ?? "—"}–{range.high ?? "—"}
                </p>
              )}
            </FormField>
          );
        })}
      </CardContent>
    </Card>
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

export function LabPanelFormSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
