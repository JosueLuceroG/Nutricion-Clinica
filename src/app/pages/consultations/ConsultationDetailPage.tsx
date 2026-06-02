import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  PlayCircle,
  XCircle,
  RotateCcw,
  Activity,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { useConsultation } from "@modules/consultation/ui/useConsultationHooks";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { ConsultationStatusLabel } from "@modules/consultation/domain/ConsultationStatus";
import { consultationService } from "@services/consultationService";

export function ConsultationDetailPage() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const id = consultationId ? ConsultationId.fromUnsafe(consultationId) : null;
  const { data: consultation, loading, error, reload } = useConsultation(id);
  const [busy, setBusy] = React.useState(false);

  const onTransition = async (to: "in-progress" | "completed" | "cancelled" | "scheduled") => {
    if (!id) return;
    setBusy(true);
    try {
      await consultationService.transition.execute(id, to);
      toast.success(`Consulta ${ConsultationStatusLabel[to].toLowerCase()}`);
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
    if (!id || !consultation) return;
    if (!confirm("¿Eliminar esta consulta? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    try {
      await consultationService.delete.execute(id, true);
      toast.success("Consulta eliminada");
      navigate(`/pacientes/${consultation.patientId.toString()}/consultas`);
    } catch (err) {
      toast.error("No se pudo eliminar", {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  if (loading && !consultation) {
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

  if (!consultation) {
    return (
      <>
        <PageHeader title="Consulta no encontrada" />
        <PageContent>
          <EmptyState
            title="La consulta no existe"
            description="Es posible que haya sido eliminada o el enlace sea incorrecto."
            action={{ label: "Volver a consultas", onClick: () => navigate("/consultas") }}
          />
        </PageContent>
      </>
    );
  }

  const actions: React.ReactNode[] = [];
  if (consultation.status === "scheduled") {
    actions.push(
      <Button key="start" onClick={() => onTransition("in-progress")} disabled={busy}>
        <PlayCircle className="mr-2 h-4 w-4" />
        Iniciar consulta
      </Button>,
    );
  }
  if (consultation.status === "in-progress") {
    actions.push(
      <Button key="complete" onClick={() => onTransition("completed")} disabled={busy}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Completar
      </Button>,
    );
  }
  if (consultation.status === "cancelled") {
    actions.push(
      <Button key="reactivate" variant="outline" onClick={() => onTransition("scheduled")} disabled={busy}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Reactivar
      </Button>,
    );
  }
  if (consultation.isActive) {
    actions.push(
      <Button key="cancel" variant="outline" onClick={() => onTransition("cancelled")} disabled={busy}>
        <XCircle className="mr-2 h-4 w-4" />
        Cancelar
      </Button>,
    );
  }

  return (
    <>
      <PageHeader
        title={`Consulta #${consultation.consultationNumber}`}
        description={`${new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(consultation.consultationDate)} · ${ConsultationStatusLabel[consultation.status]}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${consultation.patientId.toString()}/consultas`}>
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
            <SOAPSection title="Subjetivo (S)" body={consultation.subjective} />
            <SOAPSection title="Objetivo (O)" body={consultation.objective} />
            <SOAPSection title="Diagnóstico (A)" body={consultation.assessment} />
            <SOAPSection title="Plan (P)" body={consultation.plan} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motivo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{consultation.reason}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vínculos</CardTitle>
                <CardDescription>Datos capturados en la misma sesión</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {consultation.anthropometryId ? (
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Medición antropométrica</p>
                      <p className="text-xs text-muted-foreground">Vinculada a esta consulta</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        to={`/pacientes/${consultation.patientId.toString()}/antropometria`}
                      >
                        Ver
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin medición antropométrica vinculada.</p>
                )}
                {consultation.labPanelId ? (
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Panel de laboratorio</p>
                      <p className="text-xs text-muted-foreground">Vinculado a esta consulta</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        to={`/pacientes/${consultation.patientId.toString()}/laboratorio`}
                      >
                        Ver
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin panel de laboratorio vinculado.</p>
                )}
              </CardContent>
            </Card>

            {consultation.nextVisitDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Próxima cita</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(consultation.nextVisitDate)}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auditoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>Creada: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(consultation.createdAt)}</p>
                <p>Actualizada: {new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(consultation.updatedAt)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
    </>
  );
}

function SOAPSection({ title, body }: { title: string; body: string | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {body ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Sin notas</p>
        )}
      </CardContent>
    </Card>
  );
}
