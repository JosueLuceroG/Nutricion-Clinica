import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "@store/preferencesStore";
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  PlayCircle,
  XCircle,
  RotateCcw,
  Calendar,
  ClipboardList,
  UtensilsCrossed,
  Target,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge, type BadgeProps } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { useMealPlan } from "@modules/mealplan/ui/useMealPlanHooks";
import { MealPlanId } from "@modules/mealplan/domain/MealPlanId";
import {
  MealPlanStatusColor,
  canTransitionMealPlan,
  type MealPlanStatus,
} from "@modules/mealplan/domain/MealPlanStatus";
import {
  MEAL_SLOT_ORDER,
  type MealSlot,
} from "@modules/mealplan/domain/MealSlot";
import {
  Food,
  SYSTEM_FOODS,
  type FoodGroup,
} from "@modules/smae/domain";
import {
  planDailyNutrition,
  planVsTarget,
  mealRows,
} from "@modules/mealplan/application/planCalculations";
import { mealPlanService } from "@services/mealPlanService";
import { pdfService } from "@services/pdf/pdfService";
import { patientService } from "@services/patientService";

function mealPlanStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: MealPlanStatus) {
  return t(`mealplan.status_${status}`);
}

function mealSlotLabel(t: ReturnType<typeof useTranslation>["t"], slot: MealSlot) {
  return t(`mealplan.${slot.replace("-", "_")}`);
}

function foodGroupLabel(t: ReturnType<typeof useTranslation>["t"], group: FoodGroup) {
  return t(`smae.food_group_${group.replace(/-/g, "_")}`);
}

export function MealPlanDetailPage() {
  const { t } = useTranslation();
  const { planId } = useParams();
  const navigate = useNavigate();
  const id = planId ? MealPlanId.fromUnsafe(planId) : null;
  const { data: plan, loading, error, reload } = useMealPlan(id);
  const [busy, setBusy] = React.useState(false);
  const subscriptionPlan = usePreferencesStore((s) => s.subscriptionPlan);
  const pdfBrandingEnabled = usePreferencesStore((s) => s.pdfBrandingEnabled);
  const clinicDisplayName = usePreferencesStore((s) => s.clinicDisplayName);

  const onTransition = async (to: MealPlanStatus) => {
    if (!id) return;
    setBusy(true);
    try {
      await mealPlanService.transition.execute(id, to);
      toast.success(t("mealplan.status_changed", { status: mealPlanStatusLabel(t, to).toLowerCase() }));
      reload();
    } catch (err) {
      toast.error(t("mealplan.status_change_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!id || !plan) return;
    if (!confirm(t("mealplan.delete_confirm", { name: plan.name }))) return;
    setBusy(true);
    try {
      await mealPlanService.delete.execute(id, true);
      toast.success(t("mealplan.deleted_success"));
      navigate(`/pacientes/${plan.patientId.toString()}/planes`);
    } catch (err) {
      toast.error(t("mealplan.delete_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  const onDownloadPdf = async () => {
    if (!plan) return;
    try {
      const patient = await patientService.get.execute(plan.patientId);
      if (!patient) {
        toast.error(t("patient.not_exists"));
        return;
      }
      const systemFoods = SYSTEM_FOODS.reduce<Record<string, Food>>((acc, f) => {
        acc[f.id] = f;
        return acc;
      }, {});
      const customFoods = await (await import("@services/smaeService")).smaeService.search({});
      const allFoods = { ...systemFoods };
      for (const f of customFoods) {
        allFoods[f.id] = f;
      }
      const lookupFn = (foodId: string) => allFoods[foodId] ?? Food.reconstitute({
        id: foodId,
        group: "verduras" as const,
        name: foodId,
        shortName: foodId,
        serving: t("mealplan.default_serving"),
        servingGrams: 100,
        keywords: [],
        custom: false,
      });
      const branding: { clinicDisplayName: string; showPlatformBranding: boolean } = {
        clinicDisplayName,
        showPlatformBranding: subscriptionPlan === "free" || pdfBrandingEnabled,
      };
      const data = pdfService.generateMealPlanPdf(plan, patient, lookupFn);
      pdfService.download(data, `plan-alimentacion-${patient.fullName.replace(/\s+/g, "-").toLowerCase()}.pdf`, branding);
      toast.success(t("consultation.pdf_downloaded"));
    } catch (err) {
      toast.error(t("mealplan.pdf_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (loading && !plan) {
    return (
      <>
        <PageHeader title={t("common.loading")} />
        <PageContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </PageContent>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t("common.error_title")} />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <PageHeader title={t("mealplan.not_found_title")} />
        <PageContent>
          <EmptyState
            title={t("mealplan.not_exists")}
            description={t("mealplan.not_found_desc")}
            action={{ label: t("common.back"), onClick: () => navigate("/planes") }}
          />
        </PageContent>
      </>
    );
  }

  const totals = planDailyNutrition(plan);
  const diff = planVsTarget(plan);
  const actions: React.ReactNode[] = [];

  if (canTransitionMealPlan(plan.status, "active")) {
    actions.push(
      <Button key="activate" onClick={() => onTransition("active")} disabled={busy}>
        <PlayCircle className="mr-2 h-4 w-4" />
        {t("mealplan.activate_plan")}
      </Button>,
    );
  }
  if (canTransitionMealPlan(plan.status, "completed")) {
    actions.push(
      <Button key="complete" onClick={() => onTransition("completed")} disabled={busy}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {t("mealplan.mark_completed")}
      </Button>,
    );
  }
  if (canTransitionMealPlan(plan.status, "draft")) {
    actions.push(
      <Button
        key="reactivate"
        variant="outline"
        onClick={() => onTransition("draft")}
        disabled={busy}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {t("mealplan.reactivate_as_draft")}
      </Button>,
    );
  }
  if (canTransitionMealPlan(plan.status, "cancelled")) {
    actions.push(
      <Button
        key="cancel"
        variant="outline"
        onClick={() => onTransition("cancelled")}
        disabled={busy}
      >
        <XCircle className="mr-2 h-4 w-4" />
        {t("common.cancel")}
      </Button>,
    );
  }

  return (
    <>
      <PageHeader
        title={plan.name}
        description={`${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(plan.startDate)}${
          plan.endDate
            ? ` → ${new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(plan.endDate)}`
            : ""
        }`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${plan.patientId.toString()}/planes`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
            {actions}
            <Button variant="outline" onClick={onDownloadPdf} disabled={busy}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("common.delete")}
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {MEAL_SLOT_ORDER.map((slot) => {
              const meal = plan.getMeal(slot);
              if (!meal) return null;
              const rows = mealRows(meal);
              const mealKcal = rows.reduce((acc, r) => acc + r.totalNutrition.kcal, 0);
              return (
                <Card key={slot}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          {mealSlotLabel(t, slot)}
                        </CardTitle>
                        <CardDescription>
                          {rows.length === 0
                            ? t("mealplan.no_foods")
                            : t("mealplan.food_count_kcal", { count: rows.length, kcal: Math.round(mealKcal) })}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {rows.length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        {t("mealplan.no_foods_in_slot")}
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {rows.map((r) => {
                          return (
                            <li
                              key={r.foodId}
                              className="flex items-center justify-between gap-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {r.count} × {r.foodName}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {foodGroupLabel(t, r.group)} · {r.serving}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                                <Badge variant="secondary" className="font-normal">
                                  {Math.round(r.totalNutrition.kcal)} kcal
                                </Badge>
                                <span>P {r.totalNutrition.proteinG.toFixed(1)}g</span>
                                <span>C {r.totalNutrition.carbsG.toFixed(1)}g</span>
                                <span>G {r.totalNutrition.fatG.toFixed(1)}g</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {plan.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("mealplan.plan_notes")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{plan.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  {t("mealplan.daily_compliance")}
                </CardTitle>
                <CardDescription>{t("mealplan.actual_vs_targets")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <ComplianceStat
                    label="kcal"
                    actual={totals.kcal}
                    target={plan.kcalTarget}
                    diff={diff.kcal}
                    decimals={0}
                  />
                  <ComplianceStat
                    label={t("mealplan.protein")}
                    actual={totals.proteinG}
                    target={plan.proteinTargetG}
                    diff={diff.proteinG}
                    decimals={1}
                    unit="g"
                  />
                  <ComplianceStat
                    label={t("mealplan.carbs")}
                    actual={totals.carbsG}
                    target={plan.carbsTargetG}
                    diff={diff.carbsG}
                    decimals={1}
                    unit="g"
                  />
                  <ComplianceStat
                    label={t("mealplan.fat")}
                    actual={totals.fatG}
                    target={plan.fatTargetG}
                    diff={diff.fatG}
                    decimals={1}
                    unit="g"
                  />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t("mealplan.diff_hint")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("common.status")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={MealPlanStatusColor[plan.status] as BadgeProps["variant"]}>
                  {mealPlanStatusLabel(t, plan.status)}
                </Badge>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t("mealplan.start_label", { date: new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(plan.startDate) })}
                  </p>
                  {plan.endDate && (
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t("mealplan.end_label", { date: new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(plan.endDate) })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("mealplan.clinical_link")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t("mealplan.patient_record")}</p>
                    <p className="text-xs text-muted-foreground">{t("mealplan.view_consultations_measurements")}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/pacientes/${plan.patientId.toString()}`}>{t("common.open")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("consultation.audit")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {t("mealplan.created_at", { date: new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(plan.createdAt) })}
                </p>
                <p>
                  {t("mealplan.updated_at", { date: new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(plan.updatedAt) })}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </>
  );
}

function ComplianceStat({
  label,
  actual,
  target,
  diff,
  decimals,
  unit = "",
}: {
  label: string;
  actual: number;
  target: number;
  diff: number;
  decimals: number;
  unit?: string;
}) {
  const { t } = useTranslation();
  const inMeta = Math.abs(diff) <= 0.1;
  const tone = inMeta ? "success" : diff > 0 ? "destructive" : "warning";
  return (
    <div className="rounded-md border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">
        {actual.toFixed(decimals)}{" "}
        <span className="text-xs text-muted-foreground">/ {target}{unit}</span>
      </p>
      {inMeta ? (
        <Badge variant="success" className="mt-1">
          {t("mealplan.in_target")}
        </Badge>
      ) : (
        <Badge variant={tone as BadgeProps["variant"]} className="mt-1">
          {diff > 0 ? "+" : ""}
          {diff.toFixed(decimals)} {unit}
        </Badge>
      )}
    </div>
  );
}
