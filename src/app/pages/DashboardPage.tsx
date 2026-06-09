import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Users as UsersIcon,
  Calendar,
  UtensilsCrossed,
  ClipboardList,
  Activity,
  FlaskConical,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState } from "@components/layout/EmptyState";
import { useDashboardKpis } from "@app/hooks/useDashboardKpis";
import { ConsultationStatusColor } from "@modules/consultation/domain/ConsultationStatus";

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useDashboardKpis();

  return (
    <>
      <PageHeader
        title={t("nav.dashboard")}
        description={t("dashboard.description")}
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={reload} aria-label={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/pacientes")}>
              <UsersIcon className="mr-2 h-4 w-4" />
              {t("patient.title")}
            </Button>
            <Button onClick={() => navigate("/pacientes/nuevo")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("patient.new")}
            </Button>
          </>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t("billing.active_patients")}
            value={data?.totalActivePatients ?? null}
            total={data?.totalPatients ?? null}
            icon={UsersIcon}
            to="/pacientes"
            hint={t("dashboard.total_registered")}
          />
          <KpiCard
            label={t("dashboard.consultations_this_month")}
            value={data?.consultationsThisMonth ?? null}
            icon={Calendar}
            to="/consultas"
            hint={t("dashboard.current_month_agenda")}
          />
          <KpiCard
            label={t("dashboard.active_plans")}
            value={data?.activePlans ?? null}
            icon={UtensilsCrossed}
            to="/planes"
            hint={t("dashboard.in_follow_up")}
          />
          <KpiCard
            label={t("dashboard.pending_sync")}
            value={data?.pendingSync ?? 0}
            icon={Activity}
            to="/configuracion"
            hint={t("dashboard.unsent_changes")}
          />
        </div>

        {error && (
          <Card className="mt-4 border-destructive">
            <CardContent className="p-4 text-sm text-destructive">
              {t("dashboard.metrics_error", { message: error.message })}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t("dashboard.upcoming_consultations")}
                <Badge variant="secondary">{data?.upcomingConsultations.length ?? 0}</Badge>
              </CardTitle>
              <CardDescription>
                {t("dashboard.upcoming_consultations_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !data || data.upcomingConsultations.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title={t("consultation.no_consultations")}
                  description={t("dashboard.schedule_consultation_desc")}
                  action={{
                    label: t("patient.title"),
                    onClick: () => navigate("/pacientes"),
                  }}
                />
              ) : (
                <ul className="divide-y">
                  {data.upcomingConsultations.slice(0, 5).map((c) => (
                    <li key={c.id.toString()}>
                      <Link
                        to={`/consultas/${c.id.toString()}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-2.5 hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {new Intl.DateTimeFormat("es-MX", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(c.consultationDate)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t("dashboard.patient_short", { id: c.patientId.toString().slice(0, 8), number: c.consultationNumber })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ConsultationStatusColor[c.status] as never}>
                            {t(`consultation.status_${c.status.replace("-", "_")}`)}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t("dashboard.expiring_plans")}
                <Badge variant="secondary">{data?.expiringPlans.length ?? 0}</Badge>
              </CardTitle>
              <CardDescription>
                {t("dashboard.expiring_plans_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !data || data.expiringPlans.length === 0 ? (
                <EmptyState
                  icon={UtensilsCrossed}
                  title={t("mealplan.no_plans")}
                  description={t("dashboard.expiring_plans_empty")}
                />
              ) : (
                <ul className="divide-y">
                  {data.expiringPlans.slice(0, 5).map((p) => (
                    <li key={p.id.toString()}>
                      <Link
                        to={`/planes/${p.id.toString()}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-2.5 hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.kcalTarget} kcal ·{" "}
                            {p.endDate &&
                              new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
                                p.endDate,
                              )}
                          </p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dashboard.recent_patients")}</CardTitle>
              <CardDescription>{t("dashboard.recent_patients_desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !data || data.recentPatients.length === 0 ? (
                <EmptyState
                  icon={UsersIcon}
                  title={t("patient.no_patients")}
                  description={t("dashboard.create_first_patient")}
                  action={{
                    label: t("patient.new"),
                    onClick: () => navigate("/pacientes/nuevo"),
                  }}
                />
              ) : (
                <ul className="divide-y">
                  {data.recentPatients.map((p) => (
                    <li key={p.id.toString()}>
                      <Link
                        to={`/pacientes/${p.id.toString()}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-2.5 hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t("dashboard.patient_age_sex", { age: p.age, sex: t(`patient.sex_${p.sex}`) })}
                          </p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("dashboard.quick_access")}</CardTitle>
              <CardDescription>{t("dashboard.quick_access_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <QuickLink
                to="/consultas"
                icon={ClipboardList}
                label={t("consultation.title")}
                hint="Wizard SOAP"
              />
              <QuickLink
                to="/laboratorio"
                icon={FlaskConical}
                label={t("lab.title")}
                hint={t("dashboard.biochemical_calculations")}
              />
              <QuickLink
                to="/calculos"
                icon={Activity}
                label={t("calculations.title")}
                hint="BMI, TDEE, eGFR, HOMA-IR"
              />
              <QuickLink
                to="/planes"
                icon={UtensilsCrossed}
                label={t("mealplan.title")}
                hint={t("dashboard.smae_edition")}
              />
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}

function KpiCard({
  label,
  value,
  total,
  icon: Icon,
  to,
  hint,
}: {
  label: string;
  value: number | null;
  total?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  hint: string;
}) {
  const navigate = useNavigate();
  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary"
      onClick={() => navigate(to)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(to);
        }
      }}
    >
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between text-xs uppercase tracking-wider">
          {label}
          <Icon className="h-3 w-3" />
        </CardDescription>
        {value === null ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <CardTitle className="flex items-baseline gap-1.5 text-2xl font-bold tabular-nums">
            {value}
            {total !== null && total !== undefined && (
              <span className="text-xs font-normal text-muted-foreground">/ {total}</span>
            )}
          </CardTitle>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md border bg-card p-2 transition-colors hover:border-primary hover:bg-accent"
    >
      <Icon className="h-4 w-4 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
    </Link>
  );
}
