import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { useMealPlan } from "@modules/mealplan/ui/useMealPlanHooks";
import { MealPlanId } from "@modules/mealplan/domain/MealPlanId";
import {
  MealPlanStatusLabel,
  MealPlanStatusColor,
  canTransitionMealPlan,
  type MealPlanStatus,
} from "@modules/mealplan/domain/MealPlanStatus";
import {
  MEAL_SLOT_ORDER,
  MealSlotLabel,
} from "@modules/mealplan/domain/MealSlot";
import { FoodGroupLabel } from "@modules/mealplan/domain/FoodGroup";
import {
  planDailyNutrition,
  planVsTarget,
  mealRows,
} from "@modules/mealplan/application/planCalculations";
import { mealPlanService } from "@services/mealPlanService";

export function MealPlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const id = planId ? MealPlanId.fromUnsafe(planId) : null;
  const { data: plan, loading, error, reload } = useMealPlan(id);
  const [busy, setBusy] = React.useState(false);

  const onTransition = async (to: MealPlanStatus) => {
    if (!id) return;
    setBusy(true);
    try {
      await mealPlanService.transition.execute(id, to);
      toast.success(`Plan ${MealPlanStatusLabel[to].toLowerCase()}`);
      reload();
    } catch (err) {
      toast.error("No se pudo cambiar el estado", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!id || !plan) return;
    if (!confirm(`¿Eliminar "${plan.name}"? Esta acción se puede revertir.`)) return;
    setBusy(true);
    try {
      await mealPlanService.delete.execute(id, true);
      toast.success("Plan eliminado");
      navigate(`/pacientes/${plan.patientId.toString()}/planes`);
    } catch (err) {
      toast.error("No se pudo eliminar", {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  if (loading && !plan) {
    return (
      <>
        <PageHeader title="Cargando…" />
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
        <PageHeader title="Error" />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <PageHeader title="Plan no encontrado" />
        <PageContent>
          <EmptyState
            title="El plan no existe"
            description="Es posible que haya sido eliminado o el enlace sea incorrecto."
            action={{ label: "Volver", onClick: () => navigate("/planes") }}
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
        Activar plan
      </Button>,
    );
  }
  if (canTransitionMealPlan(plan.status, "completed")) {
    actions.push(
      <Button key="complete" onClick={() => onTransition("completed")} disabled={busy}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Marcar completado
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
        Reactivar como borrador
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
        Cancelar
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
                Volver
              </Link>
            </Button>
            {actions}
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
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
                          {MealSlotLabel[slot]}
                        </CardTitle>
                        <CardDescription>
                          {rows.length === 0
                            ? "Sin alimentos"
                            : `${rows.length} alimento${rows.length === 1 ? "" : "s"} · ${Math.round(mealKcal)} kcal`}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {rows.length === 0 ? (
                      <p className="text-sm italic text-muted-foreground">
                        Sin alimentos registrados en este tiempo
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
                                  {FoodGroupLabel[r.group]} · {r.serving}
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
                  <CardTitle className="text-base">Notas del plan</CardTitle>
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
                  Cumplimiento diario
                </CardTitle>
                <CardDescription>Reales vs objetivos prescritos</CardDescription>
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
                    label="Proteína"
                    actual={totals.proteinG}
                    target={plan.proteinTargetG}
                    diff={diff.proteinG}
                    decimals={1}
                    unit="g"
                  />
                  <ComplianceStat
                    label="Carbohidratos"
                    actual={totals.carbsG}
                    target={plan.carbsTargetG}
                    diff={diff.carbsG}
                    decimals={1}
                    unit="g"
                  />
                  <ComplianceStat
                    label="Grasa"
                    actual={totals.fatG}
                    target={plan.fatTargetG}
                    diff={diff.fatG}
                    decimals={1}
                    unit="g"
                  />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Positivo = excedente · Negativo = déficit
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={MealPlanStatusColor[plan.status] as never}>
                  {MealPlanStatusLabel[plan.status]}
                </Badge>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Inicio: {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(plan.startDate)}
                  </p>
                  {plan.endDate && (
                    <p className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Fin: {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(plan.endDate)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vinculación clínica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Expediente del paciente</p>
                    <p className="text-xs text-muted-foreground">Ver consultas y mediciones</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/pacientes/${plan.patientId.toString()}`}>Abrir</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auditoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Creado: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(plan.createdAt)}
                </p>
                <p>
                  Actualizado: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(plan.updatedAt)}
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
          En meta
        </Badge>
      ) : (
        <Badge variant={tone as never} className="mt-1">
          {diff > 0 ? "+" : ""}
          {diff.toFixed(decimals)} {unit}
        </Badge>
      )}
    </div>
  );
}
