import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { ConsultationStatusLabel, ConsultationStatusColor } from "@modules/consultation/domain/ConsultationStatus";
import { SexLabel } from "@modules/patient/domain/Sex";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useDashboardKpis();

  return (
    <>
      <PageHeader
        title="Panel"
        description="Resumen general de tu consultorio nutricional"
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={reload} aria-label="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/pacientes")}>
              <UsersIcon className="mr-2 h-4 w-4" />
              Ver pacientes
            </Button>
            <Button onClick={() => navigate("/pacientes/nuevo")}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo paciente
            </Button>
          </>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Pacientes activos"
            value={data?.totalActivePatients ?? null}
            total={data?.totalPatients ?? null}
            icon={UsersIcon}
            to="/pacientes"
            hint="Total registrados"
          />
          <KpiCard
            label="Consultas este mes"
            value={data?.consultationsThisMonth ?? null}
            icon={Calendar}
            to="/consultas"
            hint="Agenda del mes en curso"
          />
          <KpiCard
            label="Planes activos"
            value={data?.activePlans ?? null}
            icon={UtensilsCrossed}
            to="/planes"
            hint="En seguimiento"
          />
          <KpiCard
            label="Pendientes sync"
            value={data?.pendingSync ?? 0}
            icon={Activity}
            to="/configuracion"
            hint="Cambios sin enviar"
          />
        </div>

        {error && (
          <Card className="mt-4 border-destructive">
            <CardContent className="p-4 text-sm text-destructive">
              No se pudieron cargar las métricas: {error.message}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Próximas consultas
                <Badge variant="secondary">{data?.upcomingConsultations.length ?? 0}</Badge>
              </CardTitle>
              <CardDescription>
                Programadas o en curso. Continúa con el wizard SOAP desde el expediente del paciente.
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
                  title="Sin consultas pendientes"
                  description="Agenda o inicia una nueva consulta desde el expediente del paciente."
                  action={{
                    label: "Ir a pacientes",
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
                            Paciente: {c.patientId.toString().slice(0, 8)}… · #{c.consultationNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ConsultationStatusColor[c.status] as never}>
                            {ConsultationStatusLabel[c.status]}
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
                Planes por vencer
                <Badge variant="secondary">{data?.expiringPlans.length ?? 0}</Badge>
              </CardTitle>
              <CardDescription>
                Planes activos con fecha de conclusión en los próximos 30 días.
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
                  title="Sin planes por vencer"
                  description="Los planes activos con fecha de fin próxima aparecerán aquí."
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
              <CardTitle>Pacientes recientes</CardTitle>
              <CardDescription>Últimos 5 pacientes registrados</CardDescription>
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
                  title="Sin pacientes"
                  description="Crea el primer paciente para empezar."
                  action={{
                    label: "Crear paciente",
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
                            {p.age} años · {SexLabel[p.sex]}
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
              <CardTitle className="text-base">Accesos rápidos</CardTitle>
              <CardDescription>Atajos a módulos clínicos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <QuickLink
                to="/consultas"
                icon={ClipboardList}
                label="Consultas"
                hint="Wizard SOAP"
              />
              <QuickLink
                to="/laboratorio"
                icon={FlaskConical}
                label="Laboratorio"
                hint="Cálculos bioquímicos"
              />
              <QuickLink
                to="/calculos"
                icon={Activity}
                label="Calculadora"
                hint="BMI, TDEE, eGFR, HOMA-IR"
              />
              <QuickLink
                to="/planes"
                icon={UtensilsCrossed}
                label="Planes"
                hint="SMAE 5ª edición"
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
