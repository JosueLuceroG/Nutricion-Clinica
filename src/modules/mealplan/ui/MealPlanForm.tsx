import * as React from "react";
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  Star,
  Sparkles,
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
import { getSystemFoodById, getSystemFoodsByGroup, FoodGroupLabel, type FoodId } from "@modules/smae/domain";
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
import { Badge, type BadgeProps } from "@components/ui/badge";
import { FoodPicker } from "./FoodPicker";
import { createPatientSubstitution, getPatientSubstitutions } from "@services/api/patientSubstitutionApi";
import { useUnsavedChangesGuard } from "@hooks/useUnsavedChangesGuard";
import { useAutoSave } from "@hooks/useAutoSave";
import { SaveIndicator } from "@components/ui/SaveIndicator";
import { usePreferencesStore } from "@store/preferencesStore";
import { useAI } from "@services/ai/useAI";
import { AIAssistButton } from "@components/ai/AIAssistButton";

interface MealPlanFormProps {
  patientId: PatientId;
  consultationId: ConsultationId;
  onSaved?: (planId: string) => void;
}

export function MealPlanForm({ patientId, consultationId, onSaved }: MealPlanFormProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState(false);
  const isBeginnerMode = usePreferencesStore((s) => s.usageMode === "beginner");

  const { control, register, handleSubmit, watch, setValue, formState: { errors, isDirty } } =
    useForm<MealPlanFormValues>({
      resolver: zodResolver(MealPlanFormSchema),
      defaultValues: mealPlanFormDefaultValues,
      mode: "onSubmit",
      reValidateMode: "onChange",
    });

  useUnsavedChangesGuard(isDirty && !submitting, t("common.unsaved_changes_warning"));

  const allFormValues = watch();
  const draftKey = `mealplan:${patientId.toString()}`;
  const { status: saveStatus, clearDraft } = useAutoSave({
    key: draftKey,
    data: allFormValues as Record<string, unknown>,
    enabled: isDirty && !submitting,
  });

  const meals = watch("meals");
  const kcalTarget = watch("kcalTarget");
  const proteinTargetG = watch("proteinTargetG");
  const carbsTargetG = watch("carbsTargetG");
  const fatTargetG = watch("fatTargetG");

  const patientIdString = typeof patientId === "string" ? patientId : patientId.toString();

  const [applyingPrefs, setApplyingPrefs] = React.useState(false);
  const { execute: executeAI, busy: aiBusy } = useAI();

  const handleGenerateWithAI = React.useCallback(async () => {
    const response = await executeAI<{
      meals: Array<{
        slot: string;
        exchanges: Array<{
          group: string;
          quantity: number;
          examples: string[];
        }>;
      }>;
      totalKcal: number;
      notes?: string;
    }>("generateMealPlanInitial", {
      kcalTarget: kcalTarget ?? 1800,
      diagnosis: t("mealplan.title_single"),
      patientId: patientIdString,
    });

    if (!response?.success || !response.data) {
      toast.error(t("mealplan.form.toast.ai_menu_error"));
      return;
    }

    const labelToGroup = new Map<string, string>();
    for (const [groupKey, label] of Object.entries(FoodGroupLabel)) {
      labelToGroup.set(label.toLowerCase(), groupKey);
    }
    const foodsByGroup = getSystemFoodsByGroup();

    for (const meal of response.data.meals) {
      const slotIdx = MEAL_SLOT_ORDER.indexOf(meal.slot as MealSlot);
      if (slotIdx < 0) continue;

      const exchanges: Array<{ foodId: string; count: number }> = [];

      for (const ex of meal.exchanges) {
        const groupKey = labelToGroup.get(ex.group.toLowerCase());
        if (!groupKey) continue;

        const groupFoods = foodsByGroup.get(groupKey);
        if (!groupFoods || groupFoods.length === 0) continue;

        exchanges.push({
          foodId: groupFoods[0].id,
          count: Math.max(1, Math.round(ex.quantity)),
        });
      }

      if (exchanges.length > 0) {
        setValue(`meals.${slotIdx}.exchanges`, exchanges, { shouldDirty: true });
      }
    }

    toast.success(t("mealplan.form.toast.ai_menu_generated"));
  }, [executeAI, kcalTarget, setValue, t]);

  const handleSavePreference = React.useCallback(async (foodId: string) => {
    if (!foodId) return;
    const slot = watch("meals").find((m) =>
      m.exchanges.some((e) => e.foodId === foodId),
    )?.slot ?? null;
    try {
      await createPatientSubstitution(patientIdString, {
        originalFoodId: null,
        substituteFoodId: foodId,
        mealSlot: slot,
      });
      toast.success(t("mealplan.form.toast.preference_saved"));
    } catch (err) {
      toast.error(t("mealplan.form.toast.save_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [patientIdString, watch, t]);

  const handleApplyPreferences = React.useCallback(async () => {
    setApplyingPrefs(true);
    try {
      const subs = await getPatientSubstitutions(patientIdString);
      for (const meal of meals) {
        const idx = MEAL_SLOT_ORDER.indexOf(meal.slot);
        if (idx < 0) continue;
        const newExchanges = meal.exchanges.map((ex) => {
          const matchingSub = subs.find(
            (s) => s.substituteFoodId === ex.foodId || (s.mealSlot === meal.slot && s.originalFoodId === null),
          );
          if (matchingSub) {
            return { ...ex, foodId: matchingSub.substituteFoodId };
          }
          return ex;
        });
        setValue(`meals.${idx}.exchanges`, newExchanges, { shouldDirty: true });
      }
      toast.success(t("mealplan.form.toast.preferences_applied"));
    } catch (err) {
      toast.error(t("mealplan.form.toast.save_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setApplyingPrefs(false);
    }
  }, [patientIdString, meals, setValue, t]);

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
    toast.success(t("mealplan.form.toast.food_moved", {
      food: getSystemFoodById(exchange.foodId)?.name ?? t("mealplan.form.food"),
      slot: MealSlotShortLabel[targetSlot as MealSlot],
    }));
  };

  const suggestDistribution = () => {
    toast.info(t("mealplan.form.toast.suggested_distribution"), {
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
      clearDraft();

      toast.success(t("mealplan.form.toast.plan_created"), {
        description: t("mealplan.form.toast.plan_created_desc", {
          count: totalExchanges,
          kcal: Math.round(totals.kcal),
        }),
      });

      if (onSaved) {
        onSaved(plan.id.toString());
      } else {
        navigate(`/pacientes/${patientId.toString()}/planes`);
      }
    } catch (err) {
      toast.error(t("mealplan.form.toast.save_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {isBeginnerMode && <BeginnerMealPlanGuide />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t("mealplan.form.section.general")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("mealplan.form.field.plan_name")} htmlFor="field-plan-name" error={errors.name?.message} required>
              <Input
                id="field-plan-name"
                {...register("name")}
                placeholder={t("mealplan.form.placeholder.plan_name")}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "field-plan-name-error" : undefined}
              />
            </Field>
            <Field label={t("mealplan.form.field.start_date")} htmlFor="field-plan-start-date" error={errors.startDate?.message} required>
              <Input id="field-plan-start-date" type="date" {...register("startDate")} aria-invalid={!!errors.startDate} aria-describedby={errors.startDate ? "field-plan-start-date-error" : undefined} />
            </Field>
            <Field label={t("mealplan.form.field.end_date")} htmlFor="field-plan-end-date" error={errors.endDate?.message}>
              <Input id="field-plan-end-date" type="date" {...register("endDate")} aria-invalid={!!errors.endDate} aria-describedby={errors.endDate ? "field-plan-end-date-error" : undefined} />
            </Field>
            <Field label={t("mealplan.form.field.description")} htmlFor="field-plan-description" error={errors.description?.message}>
              <Input
                id="field-plan-description"
                {...register("description")}
                placeholder={t("mealplan.form.placeholder.description")}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "field-plan-description-error" : undefined}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={t("mealplan.form.field.kcal_target")} htmlFor="field-plan-kcal" error={errors.kcalTarget?.message} required>
              <Input
                id="field-plan-kcal"
                type="number"
                step="10"
                {...register("kcalTarget", { valueAsNumber: true })}
                aria-invalid={!!errors.kcalTarget}
                aria-describedby={errors.kcalTarget ? "field-plan-kcal-error" : undefined}
              />
            </Field>
            <Field label={t("mealplan.form.field.protein")} htmlFor="field-plan-protein" error={errors.proteinTargetG?.message}>
              <Input
                id="field-plan-protein"
                type="number"
                step="1"
                {...register("proteinTargetG", { valueAsNumber: true })}
                aria-describedby={errors.proteinTargetG ? "field-plan-protein-error" : undefined}
              />
            </Field>
            <Field label={t("mealplan.form.field.carbs")} htmlFor="field-plan-carbs" error={errors.carbsTargetG?.message}>
              <Input
                id="field-plan-carbs"
                type="number"
                step="1"
                {...register("carbsTargetG", { valueAsNumber: true })}
                aria-describedby={errors.carbsTargetG ? "field-plan-carbs-error" : undefined}
              />
            </Field>
            <Field label={t("mealplan.form.field.fat")} htmlFor="field-plan-fat" error={errors.fatTargetG?.message}>
              <Input id="field-plan-fat" type="number" step="1" {...register("fatTargetG", { valueAsNumber: true })} aria-describedby={errors.fatTargetG ? "field-plan-fat-error" : undefined} />
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleApplyPreferences} disabled={applyingPrefs}>
              <Sparkles className="mr-2 h-4 w-4" />
              {applyingPrefs ? t("common.sending") : t("mealplan.form.btn.apply_preferences")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={suggestDistribution}>
              <Target className="mr-2 h-4 w-4" />
              {t("mealplan.form.btn.suggest_distribution")}
            </Button>
            <AIAssistButton
              capability="generateMealPlanInitial"
              busy={aiBusy}
              patientId={patientIdString}
              onClick={handleGenerateWithAI}
            />
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
            onSavePreference={handleSavePreference}
            isBeginnerMode={isBeginnerMode}
          />
        ))}
      </DndContext>

      <Card>
        <CardHeader>
          <CardTitle>{t("mealplan.form.section.notes")}</CardTitle>
          <CardDescription>{t("mealplan.form.section.notes_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("notes")}
            rows={3}
            placeholder={t("mealplan.form.placeholder.notes")}
            aria-invalid={!!errors.notes}
          />
          {errors.notes?.message && (
            <p className="mt-1.5 text-xs text-destructive">{errors.notes.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex-1">
          <SaveIndicator status={saveStatus} />
        </div>
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => navigate(-1)} disabled={submitting}>
          <X className="mr-2 h-4 w-4" />
          {t("mealplan.form.btn.cancel")}
        </Button>
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
          <Save className="mr-2 h-4 w-4" />
          {submitting ? t("mealplan.form.btn.saving") : t("mealplan.form.btn.create")}
        </Button>
      </div>
    </form>
  );
}

function BeginnerMealPlanGuide() {
  const { t } = useTranslation();
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          {t("mealplan.form.beginner_title")}
        </CardTitle>
        <CardDescription>{t("mealplan.form.beginner_desc")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        <GuidedStep step="1" title={t("mealplan.form.beginner_step_targets")} description={t("mealplan.form.beginner_step_targets_desc")} />
        <GuidedStep step="2" title={t("mealplan.form.beginner_step_foods")} description={t("mealplan.form.beginner_step_foods_desc")} />
        <GuidedStep step="3" title={t("mealplan.form.beginner_step_review")} description={t("mealplan.form.beginner_step_review_desc")} />
      </CardContent>
    </Card>
  );
}

function GuidedStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {step}
        </span>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
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
  const { t } = useTranslation();
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
          {t("mealplan.form.section.totals")}
        </CardTitle>
        <CardDescription>
          {t("mealplan.form.section.totals_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MacroStat
            label={t("mealplan.form.macro.kcal")}
            actual={totals.kcal}
            target={kcalTarget}
            diff={diff.kcal}
            unit=""
          />
          <MacroStat
            label={t("mealplan.form.macro.protein")}
            actual={totals.proteinG}
            target={proteinTargetG}
            diff={diff.proteinG}
            unit="g"
          />
          <MacroStat
            label={t("mealplan.form.macro.carbs")}
            actual={totals.carbsG}
            target={carbsTargetG}
            diff={diff.carbsG}
            unit="g"
          />
          <MacroStat
            label={t("mealplan.form.macro.fat")}
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
  const { t } = useTranslation();
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
      <p className="text-[10px] text-muted-foreground">{t("mealplan.form.macro.target")}: {target}{unit}</p>
      {show ? (
        <Badge variant={tone as BadgeProps["variant"]} className="mt-1">
          {diff > 0 ? "+" : ""}
          {diff.toFixed(decimals)} {unit}
        </Badge>
      ) : (
        <Badge variant="success" className="mt-1">
          {t("mealplan.form.macro.on_target")}
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
  onSavePreference,
  isBeginnerMode,
}: {
  slot: MealSlot;
  control: ReturnType<typeof useForm<MealPlanFormValues>>["control"];
  register: ReturnType<typeof useForm<MealPlanFormValues>>["register"];
  watch: ReturnType<typeof useForm<MealPlanFormValues>>["watch"];
  slotKcalTarget: number;
  onSavePreference: (foodId: string) => void;
  isBeginnerMode: boolean;
}) {
  const { t } = useTranslation();
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
                ? t("mealplan.form.empty.no_foods")
                : t("mealplan.form.empty.food_count", {
                    count: fields.length,
                    kcal: Math.round(totals.kcal),
                  })}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? t("mealplan.form.aria.expand") : t("mealplan.form.aria.collapse")}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
        <SlotProgress actualKcal={totals.kcal} targetKcal={slotKcalTarget} />
        {isBeginnerMode && fields.length === 0 && !collapsed && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("mealplan.form.beginner_slot_hint")}
          </p>
        )}
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
                foodId={row.foodId ?? ""}
                foodName={food?.name ?? null}
                onClickFood={() => openPickerForEdit(rowIdx)}
                onDelete={() => remove(rowIdx)}
                onSavePreference={onSavePreference}
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
            {t("mealplan.form.btn.add_food")}
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
  foodId: string;
  foodName: string | null;
  onClickFood: () => void;
  onDelete: () => void;
  onSavePreference: (foodId: string) => void;
  countProps: ReturnType<ReturnType<typeof useForm<MealPlanFormValues>>["register"]>;
}

function DraggableFoodRow({
  slot,
  rowIdx,
  foodId,
  foodName,
  onClickFood,
  onDelete,
  onSavePreference,
  countProps,
}: DraggableFoodRowProps) {
  const { t } = useTranslation();
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
      className={`grid grid-cols-6 items-end gap-2 rounded-md border bg-muted/10 p-2 sm:grid-cols-12 ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="col-span-1 flex items-end pb-1">
        <button
          type="button"
          aria-label={t("mealplan.form.aria.drag")}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="col-span-5 min-w-0">
        <Label className="text-xs">{t("mealplan.form.field.food")}</Label>
        <Button
          type="button"
          variant="outline"
          className="min-w-0 w-full justify-start font-normal"
          onClick={onClickFood}
        >
          <Apple className="mr-2 h-3 w-3" />
          {foodName ? (
            <span className="truncate">{foodName}</span>
          ) : (
            <span className="text-muted-foreground">{t("mealplan.form.placeholder.select_food")}</span>
          )}
        </Button>
      </div>
      <div className="col-span-3 sm:col-span-3">
        <Label className="text-xs" htmlFor={`servings-${slot}-${rowIdx}`}>{t("mealplan.form.field.servings")}</Label>
        <Input type="number" step="0.5" min="0" {...countProps} id={`servings-${slot}-${rowIdx}`} />
      </div>
      <div className="col-span-3 flex items-end justify-end gap-1 sm:col-span-2">
        {foodId && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("mealplan.form.aria.save_preference")} onClick={() => onSavePreference(foodId)}>
            <Star className="h-4 w-4" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("mealplan.form.aria.delete")} onClick={onDelete}>
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

function SlotProgress({ actualKcal, targetKcal }: { actualKcal: number; targetKcal: number }) {
  const { t } = useTranslation();
  if (targetKcal <= 0) {
    return (
      <p className="text-[10px] text-muted-foreground mt-1">
        {t("mealplan.form.progress.define_target")}
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
      ? t("mealplan.form.adherence.too_low")
      : ratio > 1.15
        ? t("mealplan.form.adherence.exceeds")
        : ratio >= 0.85 && ratio <= 1.15
          ? t("mealplan.form.adherence.on_target")
          : t("mealplan.form.adherence.adjust");
  return (
    <div className="mt-2 space-y-1" aria-label={`${Math.round(actualKcal)} de ${targetKcal} kcal (${adherence})`}>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {Math.round(actualKcal)} / {targetKcal} kcal ({Math.round(ratio * 100)}%)
        </span>
        <Badge
          variant={
            adherence === t("mealplan.form.adherence.on_target")
              ? "success"
              : adherence === t("mealplan.form.adherence.exceeds")
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
