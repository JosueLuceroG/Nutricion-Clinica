import { Link, useNavigate, useParams } from "react-router-dom";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, UtensilsCrossed, Trash2, Calendar, User, Target } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState, ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { usePatientMealPlans } from "@modules/mealplan/ui/useMealPlanHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { MealPlanId } from "@modules/mealplan/domain/MealPlanId";
import { MealPlanStatusColor } from "@modules/mealplan/domain/MealPlanStatus";
import { planDailyNutrition, planVsTarget } from "@modules/mealplan/application/planCalculations";
import { mealPlanService } from "@services/mealPlanService";

export function PatientMealPlansPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading: patientLoading } = usePatient(id);
  const { data, loading, error, reload } = usePatientMealPlans(id);

  const onDelete = async (planId: MealPlanId, planName: string) => {
    if (!confirm(t("mealplan.delete_confirm", { name: planName }))) return;
    try {
      await mealPlanService.delete.execute(planId, true);
      toast.success(t("mealplan.deleted_success"));
      reload();
    } catch (err) {
      toast.error(t("mealplan.delete_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (patientLoading || loading) {
    return (
      <>
        <PageHeader title={t("common.loading")} />
        <PageContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
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

  if (!patient) {
    return (
      <>
        <PageHeader title={t("patient.not_found_title")} />
        <PageContent>
          <EmptyState
            title={t("patient.not_exists")}
            action={{ label: t("common.back"), onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t("mealplan.patient_plans", { patientName: patient.fullName })}
        description={t("mealplan.count_registered", { count: items.length })}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("patient.back_to_patient")}
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/pacientes/${patient.id.toString()}/planes/nuevo`}>
                <Plus className="mr-2 h-4 w-4" />
                {t("mealplan.new")}
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        {items.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title={t("mealplan.no_plans")}
            description={t("mealplan.empty_patient_desc")}
            action={{
              label: t("mealplan.create_first"),
              onClick: () => navigate(`/pacientes/${patient.id.toString()}/planes/nuevo`),
            }}
          />
        ) : (
          <div className="space-y-3">
            {items.map((p) => {
              const totals = planDailyNutrition(p);
              const diff = planVsTarget(p);
              const totalExchanges = p.meals.reduce(
                (acc, m) => acc + m.exchanges.length,
                0,
              );
              return (
                <Card key={p.id.toString()}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          {p.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
                            p.startDate,
                          )}
                          {p.endDate && (
                            <>
                              {" "}→{" "}
                              {new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(
                                p.endDate,
                              )}
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={MealPlanStatusColor[p.status] as never}>
                          {t(`mealplan.status_${p.status}`)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("common.delete")}
                          onClick={() => onDelete(p.id, p.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <MiniStat
                        label={t("mealplan.kcal_actual_target")}
                        value={`${Math.round(totals.kcal)} / ${p.kcalTarget}`}
                        diff={diff.kcal}
                      />
                      <MiniStat
                        label={t("mealplan.protein_actual_target")}
                        value={`${totals.proteinG.toFixed(1)} / ${p.proteinTargetG}`}
                        diff={diff.proteinG}
                      />
                      <MiniStat
                        label={t("mealplan.carbs_actual_target")}
                        value={`${totals.carbsG.toFixed(1)} / ${p.carbsTargetG}`}
                        diff={diff.carbsG}
                      />
                      <MiniStat
                        label={t("mealplan.fat_actual_target")}
                        value={`${totals.fatG.toFixed(1)} / ${p.fatTargetG}`}
                        diff={diff.fatG}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {t("mealplan.exchanges_registered", { name: patient.fullName, count: totalExchanges })}
                      </p>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/planes/${p.id.toString()}`}>{t("common.view_details")}</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>
    </>
  );
}

function MiniStat({ label, value, diff }: { label: string; value: string; diff: number }) {
  const { t } = useTranslation();
  const tone = Math.abs(diff) <= 0.1 ? "success" : diff > 0 ? "destructive" : "warning";
  return (
    <div className="rounded-md bg-muted/20 p-2">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Target className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      {Math.abs(diff) > 0.1 ? (
        <Badge variant={tone as never} className="mt-1">
          {diff > 0 ? "+" : ""}
          {diff.toFixed(diff > 100 || diff < -100 ? 0 : 1)}
        </Badge>
      ) : (
        <Badge variant="success" className="mt-1">
          {t("mealplan.in_target")}
        </Badge>
      )}
    </div>
  );
}
