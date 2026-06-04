import * as React from "react";
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Save,
  X,
  Plus,
  Trash2,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  Target,
  Apple,
  GripVertical,
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
import { getSystemFoodById, type FoodId } from "@modules/smae/domain";
import { foodExchangeNutrition } from "@modules/mealplan/application/planCalculations";
import { mealPlanService } from "@services/mealPlanService";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { PlanMeal } from "@modules/mealplan/domain/MealPlan";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { FoodPicker } from "./FoodPicker";

interface MealPlanFormProps {
  patientId: PatientId;
  consultationId: ConsultationId;
  onSaved?: (planId: string) => void;
}

export function MealPlanForm({ patientId, consultationId, onSaved }: MealPlanFormProps) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);

  const { control, register, handleSubmit, watch, setValue, formState: { errors } } =
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const foodMatch = activeId.match(/^food-(.+)-(\d+)$/);
    const slotMatch = overId.match(/^slot-(.+)$/);
    if (!foodMatch || !slotMatch) return;
    const sourceSlot = foodMatch[1];
    const sourceRowIdx = parseInt(foodMatch[2] ?? "", 10);
    const targetSlot = slotMatch[1];
    if (!sourceSlot || !targetSlot) return;
    if (sourceSlot === targetSlot) return;

    const sourceIdx = MEAL_SLOT_ORDER.indexOf(sourceSlot as MealSlot);
    const targetIdx = MEAL_SLOT_ORDER.indexOf(targetSlot as MealSlot);
    if (sourceIdx < 0 || targetIdx < 0) return;

    const sourceMeal = meals[sourceIdx];
    const sourceExchanges = sourceMeal?.exchanges ?? [];
    if (sourceRowIdx < 0 || sourceRowIdx >= sourceExchanges.length) return;
    const exchange = sourceExchanges[sourceRowIdx];
    if (!exchange || !exchange.foodId || !exchange.count) return;

    const newSource = sourceExchanges.filter((_, i) => i !== sourceRowIdx);
    const targetExchanges = meals[targetIdx]?.exchanges ?? [];
    const newTarget = [...targetExchanges, exchange];

    setValue(`meals.${sourceIdx}.exchanges`, newSource, { shouldDirty: true });
    setValue(`meals.${targetIdx}.exchanges`, newTarget, { shouldDirty: true });
    toast.success(`${getSystemFoodById(exchange.foodId)?.name ?? "Alimento"} movido a ${MealSlotShortLabel[targetSlot as MealSlot]}`);
  };

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
        consultationId,
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {MEAL_SLOT_ORDER.map((slot) => (
          <MealSection
            key={slot}
            slot={slot}
            control={control}
            register={register}
            watch={watch}
            slotKcalTarget={Math.round((kcalTarget ?? 0) * DEFAULT_KCAL_DISTRIBUTION[slot])}
          />
        ))}
      </DndContext>

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
  slotKcalTarget,
}: {
  slot: MealSlot;
  control: ReturnType<typeof useForm<MealPlanFormValues>>["control"];
  register: ReturnType<typeof useForm<MealPlanFormValues>>["register"];
  watch: ReturnType<typeof useForm<MealPlanFormValues>>["watch"];
  slotKcalTarget: number;
}) {
  const idx = MEAL_SLOT_ORDER.indexOf(slot);
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: `meals.${idx}.exchanges`,
  });
  const currentMeal = watch(`meals.${idx}`);
  const [collapsed, setCollapsed] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);

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

  const openPickerForNew = () => {
    setEditingRowIdx(null);
    setPickerOpen(true);
  };

  const openPickerForEdit = (rowIdx: number) => {
    setEditingRowIdx(rowIdx);
    setPickerOpen(true);
  };

  const handlePickerSelect = (foodId: FoodId) => {
    if (editingRowIdx === null) {
      append({ foodId, count: 1 });
    } else {
      const existing = fields[editingRowIdx];
      if (existing) {
        update(editingRowIdx, { ...existing, foodId });
      }
    }
    setEditingRowIdx(null);
  };

  return (
    <DroppableMealCard slot={slot}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
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
        <SlotProgress actualKcal={totals.kcal} targetKcal={slotKcalTarget} />
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-2">
          {fields.map((row, rowIdx) => {
            const food = row.foodId ? getSystemFoodById(row.foodId) : null;
            return (
              <DraggableFoodRow
                key={row.id}
                slot={slot}
                rowIdx={rowIdx}
                foodName={food?.name ?? null}
                onClickFood={() => openPickerForEdit(rowIdx)}
                onDelete={() => remove(rowIdx)}
                countProps={register(`meals.${idx}.exchanges.${rowIdx}.count`, {
                  valueAsNumber: true,
                })}
              />
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openPickerForNew}
          >
            <Plus className="mr-2 h-3 w-3" />
            Añadir alimento
          </Button>

          <FoodPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={handlePickerSelect}
          />
        </CardContent>
      )}
    </DroppableMealCard>
  );
}

function DroppableMealCard({ slot, children }: { slot: MealSlot; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` });
  return (
    <div ref={setNodeRef} className={isOver ? "ring-2 ring-primary ring-offset-2 rounded-lg" : ""}>
      {children}
    </div>
  );
}

interface DraggableFoodRowProps {
  slot: MealSlot;
  rowIdx: number;
  foodName: string | null;
  onClickFood: () => void;
  onDelete: () => void;
  countProps: ReturnType<ReturnType<typeof useForm<MealPlanFormValues>>["register"]>;
}

function DraggableFoodRow({
  slot,
  rowIdx,
  foodName,
  onClickFood,
  onDelete,
  countProps,
}: DraggableFoodRowProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `food-${slot}-${rowIdx}`,
  });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-12 items-end gap-2 rounded-md border bg-muted/10 p-2 ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="col-span-1 flex items-end pb-1">
        <button
          type="button"
          aria-label="Arrastrar a otro tiempo"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="col-span-6">
        <Label className="text-xs">Alimento</Label>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          onClick={onClickFood}
        >
          <Apple className="mr-2 h-3 w-3" />
          {foodName ? (
            <span className="truncate">{foodName}</span>
          ) : (
            <span className="text-muted-foreground">Seleccionar alimento…</span>
          )}
        </Button>
      </div>
      <div className="col-span-3">
        <Label className="text-xs">Raciones</Label>
        <Input type="number" step="0.5" min="0" {...countProps} />
      </div>
      <div className="col-span-2 flex items-end justify-end">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Eliminar" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
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

function SlotProgress({ actualKcal, targetKcal }: { actualKcal: number; targetKcal: number }) {
  if (targetKcal <= 0) {
    return (
      <p className="text-[10px] text-muted-foreground mt-1">
        Define kcal objetivo para ver distribución sugerida
      </p>
    );
  }
  const ratio = actualKcal / targetKcal;
  const pct = Math.min(ratio, 1.5) * 100;
  const tone =
    ratio < 0.5
      ? "bg-amber-400"
      : ratio > 1.15
        ? "bg-rose-500"
        : ratio >= 0.85 && ratio <= 1.15
          ? "bg-emerald-500"
          : "bg-amber-500";
  const adherence =
    ratio < 0.5
      ? "muy bajo"
      : ratio > 1.15
        ? "excede"
        : ratio >= 0.85 && ratio <= 1.15
          ? "en meta"
          : "ajustar";
  return (
    <div className="mt-2 space-y-1" aria-label={`${Math.round(actualKcal)} de ${targetKcal} kcal (${adherence})`}>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {Math.round(actualKcal)} / {targetKcal} kcal ({Math.round(ratio * 100)}%)
        </span>
        <Badge
          variant={
            adherence === "en meta"
              ? "success"
              : adherence === "excede"
                ? "destructive"
                : "warning"
          }
          className="text-[10px]"
        >
          {adherence}
        </Badge>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${tone} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {ratio > 1 && (
          <div
            className="absolute right-0 top-0 h-full w-0.5 bg-rose-700"
            style={{ left: `${(1 / Math.max(ratio, 1)) * 100}%` }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
