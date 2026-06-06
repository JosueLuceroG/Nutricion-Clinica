import { Link, useNavigate, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft, Plus, ClipboardList, Calendar, Activity, Trash2, User, DollarSign, Receipt } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState, ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { usePatientConsultations } from "@modules/consultation/ui/useConsultationHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { ConsultationStatusLabel, ConsultationStatusColor } from "@modules/consultation/domain/ConsultationStatus";
import { MarkAsPaidDialog } from "@modules/consultation/ui/MarkAsPaidDialog";
import { consultationService } from "@services/consultationService";
import { useUIStore } from "@store/uiStore";
import { hasAnyRole, BILLING_ROLES } from "@modules/auth/authRoles";
import { useAuthStore } from "@store/authStore";

export function PatientConsultationsPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading: patientLoading } = usePatient(id);
  const { data, loading, error, reload } = usePatientConsultations(id);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const user = useAuthStore((s) => s.user);
  const canManagePayment = hasAnyRole(user?.rol ?? null, BILLING_ROLES);

  const [paidTarget, setPaidTarget] = React.useState<Consultation | null>(null);

  const onDelete = async (consultationId: ConsultationId) => {
    if (!confirm("¿Eliminar esta consulta? Esta acción no se puede deshacer.")) return;
    try {
      await consultationService.delete.execute(consultationId, true);
      toast.success("Consulta eliminada");
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
  void sidebarCollapsed;

  return (
    <>
      <PageHeader
        title={`Consultas · ${patient.fullName}`}
        description={`${items.length} consulta${items.length === 1 ? "" : "s"} registrada${items.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al paciente
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/pacientes/${patient.id.toString()}/consultas/nueva`}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva consulta
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin consultas registradas"
            description="Inicia el historial clínico del paciente con su primera consulta nutricional."
            action={{
              label: "Registrar primera consulta",
              onClick: () => navigate(`/pacientes/${patient.id.toString()}/consultas/nueva`),
            }}
          />
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <Card key={c.id.toString()}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(c.consultationDate)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          · Consulta #{c.consultationNumber}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        <span className="line-clamp-2">{c.reason}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ConsultationStatusColor[c.status] as never}>
                        {ConsultationStatusLabel[c.status]}
                      </Badge>
                      {c.isPaid ? (
                        <Badge variant="success">
                          <DollarSign className="mr-1 h-3 w-3" />
                          Pagada
                        </Badge>
                      ) : c.cost > 0 ? (
                        <Badge variant="warning">
                          <DollarSign className="mr-1 h-3 w-3" />
                          Pendiente
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eliminar"
                        onClick={() => onDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {c.subjective && (
                      <DetailPreview label="Subjetivo" value={c.subjective} />
                    )}
                    {c.assessment && (
                      <DetailPreview label="Diagnóstico" value={c.assessment} />
                    )}
                    {c.plan && (
                      <DetailPreview label="Plan" value={c.plan} />
                    )}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vínculos</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.anthropometryId && (
                          <Badge variant="info">
                            <Activity className="mr-1 h-3 w-3" />
                            Antropometría
                          </Badge>
                        )}
                        {c.labPanelId && (
                          <Badge variant="info">
                            <ClipboardList className="mr-1 h-3 w-3" />
                            Laboratorio
                          </Badge>
                        )}
                        {!c.anthropometryId && !c.labPanelId && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      {c.nextVisitDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Próxima: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(c.nextVisitDate)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      Paciente: {patient.fullName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManagePayment && (
                        <Button
                          variant={c.isPaid ? "outline" : "default"}
                          size="sm"
                          onClick={() => setPaidTarget(c)}
                          data-testid={`mark-paid-${c.id.toString()}`}
                        >
                          <DollarSign className="mr-1 h-4 w-4" />
                          {c.isPaid ? "Editar pago" : "Marcar pagada"}
                        </Button>
                      )}
                      {c.isPaid && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/billing/${c.id.toString()}/receipt`}>
                            <Receipt className="mr-1 h-4 w-4" />
                            Recibo
                          </Link>
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/consultas/${c.id.toString()}`}>Ver detalle completo</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
      <MarkAsPaidDialog
        open={!!paidTarget}
        consultation={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => {
          setPaidTarget(null);
          toast.success("Pago registrado");
          reload();
        }}
      />
    </>
  );
}

function DetailPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/20 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 line-clamp-3 text-xs">{value}</p>
    </div>
  );
}
