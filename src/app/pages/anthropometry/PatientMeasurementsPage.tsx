import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Activity, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState, ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { usePatientMeasurements } from "@modules/anthropometry/ui/useAnthropometryHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { anthropometryService } from "@services/anthropometryService";
import { calculateBMI, BMICategoryLabel, BMICategoryColor } from "@utils/calculations/bmi";
import { bodyFatFromBMI, waistHipRisk } from "@utils/calculations/bodyComposition";

export function PatientMeasurementsPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading: patientLoading } = usePatient(id);
  const { data, loading, error, reload } = usePatientMeasurements(id);

  const onDelete = async (anthropometryId: AnthropometryId) => {
    if (!confirm(`${t("anthropometry.delete_confirm")} ${t("anthropometry.delete_warning")}`)) return;
    try {
      await anthropometryService.delete.execute(anthropometryId, true);
      toast.success(t("anthropometry.delete"));
      reload();
    } catch (err) {
      toast.error(t("common.error_occurred"), {
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
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </PageContent>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t("common.error_occurred")} />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <PageHeader title={t("patient.title_single") + " " + t("common.no_results")} />
        <PageContent>
          <EmptyState
            title={t("patient.detail") + " " + t("common.no_results")}
            action={{ label: t("common.previous"), onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  const items = data?.items ?? [];
  const sex = patient.sex === "male" || patient.sex === "female" ? patient.sex : null;

  return (
    <>
      <PageHeader
        title={`${t("anthropometry.measurements")} · ${patient.fullName}`}
        description={`${items.length} ${t("anthropometry.column_date")}${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.previous")}
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/pacientes/${patient.id.toString()}/antropometria/nueva`}>
                <Plus className="mr-2 h-4 w-4" />
                {t("anthropometry.new")}
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        {items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={t("anthropometry.no_measurements")}
            description={t("anthropometry.no_measurements")}
            action={{
              label: t("anthropometry.new"),
              onClick: () => navigate(`/pacientes/${patient.id.toString()}/antropometria/nueva`),
            }}
          />
        ) : (
          <div className="space-y-3">
            {items.map((m) => {
              const heightM = m.height.toMeters();
              const bmi = calculateBMI({ weightKg: m.weight.toKg(), heightM });
              const pct = sex ? bodyFatFromBMI({ bmi: bmi.value, ageYears: patient.age, sex }) : null;
              const whr = m.waistHipRatio;
              const whrRisk = whr !== null && sex ? waistHipRisk(whr, sex) : null;

              return (
                <Card key={m.id.toString()}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(m.measuredAt)}
                        </CardTitle>
                        <CardDescription>
                          {t("anthropometry.column_weight")} {m.weight.toKg().toFixed(1)} kg · {t("anthropometry.height_cm")} {m.height.toCentimeters()} cm
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("anthropometry.delete")}
                        onClick={() => onDelete(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric
                        label={t("anthropometry.bmi")}
                        value={bmi.value.toFixed(1)}
                        badge={
                          <Badge variant={BMICategoryColor[bmi.category] as never}>
                            {BMICategoryLabel[bmi.category]}
                          </Badge>
                        }
                      />
                      {pct !== null && (
                        <Metric label="% grasa (Deurenberg)" value={`${pct.toFixed(1)}%`} />
                      )}
                      {whr !== null && (
                        <Metric
                          label="RCC"
                          value={whr.toFixed(2)}
                          badge={
                            whrRisk && (
                              <Badge
                                variant={
                                  whrRisk.level === "very-high" || whrRisk.level === "high"
                                    ? "destructive"
                                    : whrRisk.level === "moderate"
                                      ? "warning"
                                      : "success"
                                }
                              >
                                {whrRisk.level}
                              </Badge>
                            )
                          }
                        />
                      )}
                      <Metric
                        label="Σ pliegues"
                        value={`${m.sumOfSkinfolds.toFixed(1)} mm`}
                      />
                    </div>
                    {m.notes && (
                      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{m.notes}</p>
                    )}
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

function Metric({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
  );
}
