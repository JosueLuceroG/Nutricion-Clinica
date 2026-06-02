import * as React from "react";
import { useForm, useFieldArray, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  Save,
  X,
  Plus,
  Trash2,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  MealPlanFormSchema,
  mealPlanFormDefaultValues,
  type MealPlanFormValues,
} from "@modules/mealplan/application/mealPlanFormSchema";
import {
  MEAL_SLOT_ORDER,
  MealSlotLabel,
  MealSlotShortLabel,
  DEFAULT_KCAL_DISTRIBUTION,
  type MealSlot,
} from "@modules/mealplan/domain/MealSlot";
import { getAllFoods, type FoodId } from "@modules/mealplan/domain/Food";
import { FoodGroupLabel } from "@modules/mealplan/domain/FoodGroup";
import { foodExchangeNutrition } from "@modules/mealplan/application/planCalculations";
import { mealPlanService } from "@services/mealPlanService";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { PlanMeal } from "@modules/mealplan/domain/MealPlan";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";

interface MealPlanFormProps {
  patientId: PatientId;
  onSaved?: (planId: string) => void;
}

const ALL_FOODS = getAllFoods();

export function MealPlanForm({ patientId, onSaved }: MealPlanFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);

  const { control, register, handleSubmit, watch, formState: { errors } } =
    useForm<MealPlanFormValues>({
      resolver: zodResolver(MealPlanFormSchema),
      defaultValues: mealPlanFormDefaultValues,
      mode: "onSubmit",
      reValidateMode: "onChange",
    });

  const meals = watch("meals");
  const kcalTarget = watch("kcalTarget");
  const proteinTargetG = watch("proteinTargetG");
  const carbsTargetG = watch("carbsTargetG");
  const fatTargetG = watch("fatTargetG");

  const totals = React.useMemo(() => {
    return meals.reduce(
      (acc, m) => {
        const n = m.exchanges.reduce(
          (a, ex) => {
            if (!ex.foodId || !ex.count || !Number.isFinite(ex.count)) return a;
            const x = foodExchangeNutrition(ex.foodId as FoodId, ex.count);
            a.kcal += x.kcal;
            a.proteinG += x.proteinG;
            a.carbsG += x.carbsG;
            a.fatG += x.fatG;
            return a;
          },
          { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
        );
        acc.kcal += n.kcal;
        acc.proteinG += n.proteinG;
        acc.carbsG += n.carbsG;
        acc.fatG += n.fatG;
        return acc;
      },
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  }, [meals]);

  const suggestDistribution = () => {
    toast.info("Distribución calórica sugerida", {
      description: MEAL_SLOT_ORDER.map(
        (s) =>
          `${MealSlotShortLabel[s]}: ${Math.round(
            kcalTarget * DEFAULT_KCAL_DISTRIBUTION[s],
          )} kcal (${Math.round(DEFAULT_KCAL_DISTRIBUTION[s] * 100)}%)`,
      ).join(" · "),
    });
  };

  const onSubmit: SubmitHandler<MealPlanFormValues> = async (values) => {
    setSubmitting(true);
    try {
      const mealsForDomain: PlanMeal[] = MEAL_SLOT_ORDER.map((slot) => {
        const raw = values.meals.find((m) => m.slot === slot);
        const exchanges = (raw?.exchanges ?? []).flatMap((e) => {
          if (!e.foodId || !Number.isFinite(e.count) || e.count <= 0) return [];
          return [{ foodId: e.foodId as FoodId, count: e.count }];
        });
        return { slot, exchanges };
      });

      const plan = await mealPlanService.create.execute({
        patientId,
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
        startDate: new Date(values.startDate),
        endDate: values.endDate ? new Date(values.endDate) : null,
        kcalTarget: values.kcalTarget,
        proteinTargetG: values.proteinTargetG,
        carbsTargetG: values.carbsTargetG,
        fatTargetG: values.fatTargetG,
        meals: mealsForDomain,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });

      const totalExchanges = mealsForDomain.reduce(
        (acc, m) => acc + m.exchanges.length,
        0,
      );
      toast.success("Plan alimentario creado", {
        description: `${totalExchanges} equivalentes registrados · ${Math.round(totals.kcal)} kcal`,
      });

      if (onSaved) {
        onSaved(plan.id.toString());
      } else {
        navigate(`/pacientes/${patientId.toString()}/planes`);
      }
    } catch (err) {
      toast.error("No se pudo guardar el plan", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Datos generales y objetivos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del plan" error={errors.name?.message} required>
              <Input
                {...register("name")}
                placeholder="Ej. Hipocalórico 1500 kcal — Etapa 1"
                aria-invalid={!!errors.name}
              />
            </Field>
            <Field label="Fecha de inicio" error={errors.startDate?.message} required>
              <Input type="date" {...register("startDate")} aria-invalid={!!errors.startDate} />
            </Field>
            <Field label="Fecha de fin (opcional)" error={errors.endDate?.message}>
              <Input type="date" {...register("endDate")} aria-invalid={!!errors.endDate} />
            </Field>
            <Field label="Descripción" error={errors.description?.message}>
              <Input
                {...register("description")}
                placeholder="Notas del plan, contexto clínico"
                aria-invalid={!!errors.description}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="kcal objetivo" error={errors.kcalTarget?.message} required>
              <Input
                type="number"
                step="10"
                {...register("kcalTarget", { valueAsNumber: true })}
                aria-invalid={!!errors.kcalTarget}
              />
            </Field>
            <Field label="Proteína (g)" error={errors.proteinTargetG?.message}>
              <Input
                type="number"
                step="1"
                {...register("proteinTargetG", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Carbohidratos (g)" error={errors.carbsTargetG?.message}>
              <Input
                type="number"
                step="1"
                {...register("carbsTargetG", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Grasa (g)" error={errors.fatTargetG?.message}>
              <Input type="number" step="1" {...register("fatTargetG", { valueAsNumber: true })} />
            </Field>
          </div>
          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" size="sm" onClick={suggestDistribution}>
              <Target className="mr-2 h-4 w-4" />
              Ver distribución sugerida por tiempo
            </Button>
          </div>
        </CardContent>
      </Card>

      <TotalsCard
        totals={totals}
        kcalTarget={kcalTarget}
        proteinTargetG={proteinTargetG}
        carbsTargetG={carbsTargetG}
        fatTargetG={fatTargetG}
      />

      {MEAL_SLOT_ORDER.map((slot) => (
        <MealSection
          key={slot}
          slot={slot}
          control={control}
          register={register}
          watch={watch}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Notas del plan</CardTitle>
          <CardDescription>Indicaciones generales, técnica culinaria, recomendaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("notes")}
            rows={3}
            placeholder="Ej. Tomar 2 L de agua al día, preferir preparaciones al vapor…"
            aria-invalid={!!errors.notes}
          />
          {errors.notes?.message && (
            <p className="mt-1.5 text-xs text-destructive">{errors.notes.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={submitting}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          <Save className="mr-2 h-4 w-4" />
          {submitting ? "Guardando…" : "Crear plan"}
        </Button>
      </div>
    </form>
  );
}

function TotalsCard({
  totals,
  kcalTarget,
  proteinTargetG,
  carbsTargetG,
  fatTargetG,
}: {
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  kcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}) {
  const diff = {
    kcal: totals.kcal - kcalTarget,
    proteinG: totals.proteinG - proteinTargetG,
    carbsG: totals.carbsG - carbsTargetG,
    fatG: totals.fatG - fatTargetG,
  };
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UtensilsCrossed className="h-4 w-4" />
          Totales del día vs objetivos
        </CardTitle>
        <CardDescription>
          Cálculo en tiempo real a partir de los equivalentes registrados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MacroStat
            label="kcal"
            actual={totals.kcal}
            target={kcalTarget}
            diff={diff.kcal}
            unit=""
          />
          <MacroStat
            label="Proteína"
            actual={totals.proteinG}
            target={proteinTargetG}
            diff={diff.proteinG}
            unit="g"
          />
          <MacroStat
            label="Carbohidratos"
            actual={totals.carbsG}
            target={carbsTargetG}
            diff={diff.carbsG}
            unit="g"
          />
          <MacroStat
            label="Grasa"
            actual={totals.fatG}
            target={fatTargetG}
            diff={diff.fatG}
            unit="g"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MacroStat({
  label,
  actual,
  target,
  diff,
  unit,
}: {
  label: string;
  actual: number;
  target: number;
  diff: number;
  unit: string;
}) {
  const show = Math.abs(diff) > 0.1;
  const tone = diff > 0 ? "destructive" : diff < 0 ? "warning" : "success";
  const decimals = unit === "g" ? 1 : 0;
  return (
    <div className="rounded-md border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">
        {actual.toFixed(decimals)}{" "}
        <span className="text-xs text-muted-foreground">{unit}</span>
      </p>
      <p className="text-[10px] text-muted-foreground">Objetivo: {target}{unit}</p>
      {show ? (
        <Badge variant={tone as never} className="mt-1">
          {diff > 0 ? "+" : ""}
          {diff.toFixed(decimals)} {unit}
        </Badge>
      ) : (
        <Badge variant="success" className="mt-1">
          En meta
        </Badge>
      )}
    </div>
  );
}

function MealSection({
  slot,
  control,
  register,
  watch,
}: {
  slot: MealSlot;
  control: ReturnType<typeof useForm<MealPlanFormValues>>["control"];
  register: ReturnType<typeof useForm<MealPlanFormValues>>["register"];
  watch: ReturnType<typeof useForm<MealPlanFormValues>>["watch"];
}) {
  const idx = MEAL_SLOT_ORDER.indexOf(slot);
  const { fields, append, remove } = useFieldArray({
    control,
    name: `meals.${idx}.exchanges`,
  });
  const currentMeal = watch(`meals.${idx}`);
  const [collapsed, setCollapsed] = React.useState(false);

  const totals = React.useMemo(() => {
    return (currentMeal?.exchanges ?? []).reduce(
      (acc, ex) => {
        if (!ex.foodId || !ex.count || !Number.isFinite(ex.count)) return acc;
        const n = foodExchangeNutrition(ex.foodId as FoodId, ex.count);
        acc.kcal += n.kcal;
        acc.proteinG += n.proteinG;
        acc.carbsG += n.carbsG;
        acc.fatG += n.fatG;
        return acc;
      },
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  }, [currentMeal]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{MealSlotLabel[slot]}</CardTitle>
            <CardDescription>
              {fields.length === 0
                ? "Sin alimentos registrados"
                : `${fields.length} alimento${fields.length === 1 ? "" : "s"} · ${Math.round(totals.kcal)} kcal`}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Expandir" : "Colapsar"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-2">
          {fields.map((row, rowIdx) => (
            <div
              key={row.id}
              className="grid grid-cols-12 items-end gap-2 rounded-md border bg-muted/10 p-2"
            >
              <div className="col-span-7">
                <Label className="text-xs">Alimento</Label>
                <Controller
                  control={control}
                  name={`meals.${idx}.exchanges.${rowIdx}.foodId`}
                  render={({ field }) => (
                    <select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Seleccionar…</option>
                      {ALL_FOODS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} — {FoodGroupLabel[f.group]}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Raciones</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register(`meals.${idx}.exchanges.${rowIdx}.count`, {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="col-span-2 flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar"
                  onClick={() => remove(rowIdx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ foodId: "" as FoodId, count: 1 })}
          >
            <Plus className="mr-2 h-3 w-3" />
            Añadir alimento
          </Button>
        </CardContent>
      )}
    </Card>
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
