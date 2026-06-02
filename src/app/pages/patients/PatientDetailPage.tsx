import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Archive,
  Mail,
  Phone,
  Calendar,
  User,
  Activity,
  FlaskConical,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import { SexLabel } from "@modules/patient/domain/Sex";
import { PatientStatusLabel } from "@modules/patient/domain/PatientStatus";
import { patientService } from "@services/patientService";

export function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = patientId ? PatientId.fromUnsafe(patientId) : null;
  const { data: patient, loading, error, reload } = usePatient(id);
  const [busy, setBusy] = React.useState(false);

  const onArchive = async () => {
    if (!id || !patient) return;
    if (!confirm(`¿Archivar a ${patient.fullName}?`)) return;
    setBusy(true);
    try {
      await patientService.archive.execute(id);
      toast.success("Paciente archivado");
      reload();
    } catch (err) {
      toast.error("No se pudo archivar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!id || !patient) return;
    if (!confirm(`¿Eliminar a ${patient.fullName}? Esta acción se puede revertir.`)) return;
    setBusy(true);
    try {
      await patientService.delete.execute(id, true);
      toast.success("Paciente eliminado");
      navigate("/pacientes");
    } catch (err) {
      toast.error("No se pudo eliminar", {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  if (loading && !patient) {
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

  if (!patient) {
    return (
      <>
        <PageHeader title="Paciente no encontrado" />
        <PageContent>
          <EmptyState
            title="El paciente no existe"
            description="Es posible que haya sido eliminado o el enlace sea incorrecto."
            action={{ label: "Volver a pacientes", onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={patient.fullName}
        description={`Expediente ${patient.id.toString().slice(0, 8)}…`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/pacientes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            {patient.status === "active" && (
              <Button variant="outline" onClick={onArchive} disabled={busy}>
                <Archive className="mr-2 h-4 w-4" />
                Archivar
              </Button>
            )}
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Información del paciente
              </CardTitle>
              <CardDescription>
                Datos registrados el {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(patient.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label="Nombre completo" value={patient.fullName} />
              <DetailRow
                label="Fecha de nacimiento"
                value={new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(patient.birthDate)}
              />
              <DetailRow label="Edad" value={`${patient.age} años`} />
              <DetailRow label="Sexo biológico" value={SexLabel[patient.sex]} />
              <DetailRow
                label="Estado"
                value={
                  <Badge variant={patient.isActive ? "success" : "secondary"}>
                    {PatientStatusLabel[patient.status]}
                  </Badge>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {patient.email ? (
                <a
                  href={`mailto:${patient.email.toString()}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {patient.email.toString()}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Sin correo</p>
              )}
              {patient.phone ? (
                <a
                  href={`tel:${patient.phone.toString()}`}
                  className="flex items-center gap-2 text-sm hover:underline"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {patient.phone.toString()}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Sin teléfono</p>
              )}
              <div className="border-t pt-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Última actualización: {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(patient.updatedAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Módulos clínicos</CardTitle>
            <CardDescription>Información estructurada del paciente</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/consultas`}
              icon={ClipboardList}
              label="Consultas"
              hint="Historial clínico y wizard SOAP"
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/antropometria`}
              icon={Activity}
              label="Antropometría"
              hint="Mediciones, BMI, composición corporal"
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/laboratorio`}
              icon={FlaskConical}
              label="Laboratorio"
              hint="Indicadores bioquímicos y cálculos derivados"
            />
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ModuleLink({
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
      className="group rounded-md border bg-card p-3 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}
