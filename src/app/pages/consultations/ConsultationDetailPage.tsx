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
  Heart,
  FileDown,
  DollarSign,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { useConsultation } from "@modules/consultation/ui/useConsultationHooks";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { ConsultationStatusLabel } from "@modules/consultation/domain/ConsultationStatus";
import { PAYMENT_METHOD_LABELS } from "@modules/consultation/domain/PaymentMethod";
import { MarkAsPaidDialog } from "@modules/consultation/ui/MarkAsPaidDialog";
import { isBillingRole, useCurrentRole } from "@modules/auth/authRoles";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { Vitals } from "@modules/consultation/domain/Vitals";
import { consultationService } from "@services/consultationService";
import { patientService } from "@services/patientService";
import { anthropometryService } from "@services/anthropometryService";
import { labPanelService } from "@services/labPanelService";
import { pdfService } from "@services/pdf/pdfService";
import { formatCurrency } from "@utils/formatCurrency";

export function ConsultationDetailPage() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const id = consultationId ? ConsultationId.fromUnsafe(consultationId) : null;
  const { data: consultation, loading, error, reload } = useConsultation(id);
  const [busy, setBusy] = React.useState(false);
  const [paidTarget, setPaidTarget] = React.useState<Consultation | null>(null);
  const userRole = useCurrentRole();
  const canManagePayment = isBillingRole(userRole);

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

  const onExportPdf = async () => {
    if (!consultation) return;
    setBusy(true);
    try {
      const patient = await patientService.get.execute(consultation.patientId).catch(() => null);
      if (!patient) {
        toast.error("No se encontró el paciente");
        return;
      }
      const anthropometry = consultation.anthropometryId
        ? await anthropometryService.get.execute(consultation.anthropometryId).catch(() => null)
        : null;
      const labPanel = consultation.labPanelId
        ? await labPanelService.get.execute(consultation.labPanelId).catch(() => null)
        : null;
      const pdfAnthropometry = anthropometry
        ? {
            weightKg: anthropometry.weight.toKg(),
            heightCm: anthropometry.height.toCentimeters(),
            bmi: anthropometry.bmi,
            measuredAt: anthropometry.measuredAt,
          }
        : null;
      const pdfLab = labPanel
        ? {
            glucose: labPanel.getValue("GLUCOSA"),
            cholesterol: labPanel.getValue("COLESTEROL_TOTAL"),
            triglycerides: labPanel.getValue("TRIGLICERIDOS"),
            takenAt: labPanel.takenAt,
          }
        : null;
      pdfService.downloadConsultation(
        pdfService.generateConsultationPdf(consultation, patient, pdfAnthropometry, pdfLab),
      );
      toast.success("PDF descargado");
    } catch (err) {
      toast.error("No se pudo exportar el PDF", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
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
            {canManagePayment && (
              <Button
                variant={consultation.isPaid ? "outline" : "default"}
                onClick={() => setPaidTarget(consultation)}
                disabled={busy}
                data-testid="mark-paid-detail"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {consultation.isPaid ? "Editar pago" : "Marcar pagada"}
              </Button>
            )}
            {consultation.isPaid && (
              <Button asChild variant="outline">
                <Link to={`/billing/${consultation.id.toString()}/receipt`}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Recibo
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={onExportPdf} disabled={busy}>
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
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
            <VitalsSection vitals={consultation.vitals} />
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
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  Pago
                </CardTitle>
                <CardDescription>
                  {consultation.isPaid
                    ? "Consulta liquidada"
                    : consultation.cost > 0
                      ? "Pago pendiente"
                      : "Sin costo asignado"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Costo</span>
                  <span className="text-sm font-medium">
                    {consultation.cost > 0 ? formatCurrency(consultation.cost) : "—"}
                  </span>
                </div>
                {consultation.isPaid && consultation.paymentMethod && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Método</span>
                    <span className="text-sm">{PAYMENT_METHOD_LABELS[consultation.paymentMethod]}</span>
                  </div>
                )}
                {consultation.isPaid && consultation.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fecha</span>
                    <span className="text-sm">
                      {new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(consultation.paidAt)}
                    </span>
                  </div>
                )}
                {consultation.isPaid && consultation.reference && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Referencia</span>
                    <span className="text-sm font-mono">{consultation.reference}</span>
                  </div>
                )}
                {consultation.isPaid && consultation.invoiceNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Factura</span>
                    <span className="text-sm font-mono">{consultation.invoiceNumber}</span>
                  </div>
                )}
                {consultation.isPaid && (
                  <Badge variant="success" className="mt-2">
                    <DollarSign className="mr-1 h-3 w-3" />
                    Pagada
                  </Badge>
                )}
                {canManagePayment && (
                  <Button
                    variant={consultation.isPaid ? "outline" : "default"}
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setPaidTarget(consultation)}
                    disabled={busy}
                    data-testid="mark-paid-card"
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    {consultation.isPaid ? "Editar pago" : "Marcar pagada"}
                  </Button>
                )}
              </CardContent>
            </Card>

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
      <MarkAsPaidDialog
        open={!!paidTarget}
        consultation={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => {
          setPaidTarget(null);
          reload();
        }}
      />
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

function VitalsSection({ vitals }: { vitals: Vitals }) {
  const rows: Array<{ label: string; value: string | null; unit: string }> = [
    { label: "Tensión arterial", value: vitals.systolicMmHg !== null && vitals.diastolicMmHg !== null ? `${vitals.systolicMmHg}/${vitals.diastolicMmHg}` : null, unit: "mmHg" },
    { label: "Frecuencia cardíaca", value: vitals.heartRateBpm?.toString() ?? null, unit: "lpm" },
    { label: "Temperatura", value: vitals.temperatureC?.toString() ?? null, unit: "°C" },
  ];
  const captured = rows.filter((r) => r.value !== null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4" />
          Signos vitales
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vitals.isEmpty || captured.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No se tomaron signos vitales en esta consulta.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label} className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</p>
                <p className="mt-1 text-lg font-semibold">
                  {r.value ?? <span className="text-sm font-normal text-muted-foreground">—</span>}
                  {r.value && <span className="ml-1 text-xs font-normal text-muted-foreground">{r.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
