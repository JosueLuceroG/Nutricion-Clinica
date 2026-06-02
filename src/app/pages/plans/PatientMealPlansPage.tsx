import { Link, useNavigate, useParams } from "react-router-dom";
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
import { MealPlanStatusLabel, MealPlanStatusColor } from "@modules/mealplan/domain/MealPlanStatus";
import { planDailyNutrition, planVsTarget } from "@modules/mealplan/application/planCalculations";
import { mealPlanService } from "@services/mealPlanService";

export function PatientMealPlansPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = patientId ? PatientId.fromUnsafe(patientId) : null;
  const { data: patient, loading: patientLoading } = usePatient(id);
  const { data, loading, error, reload } = usePatientMealPlans(id);

  const onDelete = async (planId: MealPlanId, planName: string) => {
    if (!confirm(`¿Eliminar el plan "${planName}"? Esta acción se puede revertir.`)) return;
    try {
      await mealPlanService.delete.execute(planId, true);
      toast.success("Plan eliminado");
      reload();
    } catch (err) {
      toast.error("No se pudo eliminar", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (patientLoading || loading) {
    return (
      <>
        <PageHeader title="Cargando…" />
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
        <PageHeader title="Error" />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <PageHeader title="Paciente no encontrado" />
        <PageContent>
          <EmptyState
            title="El paciente no existe"
            action={{ label: "Volver", onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title={`Planes alimentarios · ${patient.fullName}`}
        description={`${items.length} plan${items.length === 1 ? "" : "es"} registrado${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al paciente
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/pacientes/${patient.id.toString()}/planes/nuevo`}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo plan
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        {items.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="Sin planes alimentarios"
            description="Crea un plan basado en el Sistema Mexicano de Alimentos Equivalentes para este paciente."
            action={{
              label: "Crear primer plan",
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
                          {MealPlanStatusLabel[p.status]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Eliminar"
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
                        label="kcal reales / objetivo"
                        value={`${Math.round(totals.kcal)} / ${p.kcalTarget}`}
                        diff={diff.kcal}
                      />
                      <MiniStat
                        label="Proteína g / objetivo"
                        value={`${totals.proteinG.toFixed(1)} / ${p.proteinTargetG}`}
                        diff={diff.proteinG}
                      />
                      <MiniStat
                        label="Carbohidratos g / objetivo"
                        value={`${totals.carbsG.toFixed(1)} / ${p.carbsTargetG}`}
                        diff={diff.carbsG}
                      />
                      <MiniStat
                        label="Grasa g / objetivo"
                        value={`${totals.fatG.toFixed(1)} / ${p.fatTargetG}`}
                        diff={diff.fatG}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {patient.fullName} · {totalExchanges} equivalente
                        {totalExchanges === 1 ? "" : "s"} registrados
                      </p>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/planes/${p.id.toString()}`}>Ver detalle completo</Link>
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
          En meta
        </Badge>
      )}
    </div>
  );
}
