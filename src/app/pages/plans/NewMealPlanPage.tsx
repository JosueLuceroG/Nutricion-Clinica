import { Link, useNavigate, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft, ClipboardList, User } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import { usePatientConsultations } from "@modules/consultation/ui/useConsultationHooks";
import { MealPlanForm } from "@modules/mealplan/ui/MealPlanForm";

export function NewMealPlanPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading: patientLoading, error: patientError } = usePatient(id);
  const { data: consultations, loading: consLoading } = usePatientConsultations(id);

  const loading = patientLoading || consLoading;

  if (loading) {
    return (
      <>
        <PageHeader title="Cargando…" />
        <PageContent>
          <Skeleton className="h-64 w-full" />
        </PageContent>
      </>
    );
  }

  if (patientError || !patient || !id) {
    return (
      <>
        <PageHeader title="Paciente no encontrado" />
        <PageContent>
          <ErrorState
            message={patientError?.message ?? "No se encontró el paciente"}
            onRetry={() => navigate("/pacientes")}
          />
        </PageContent>
      </>
    );
  }

  const latestCons = consultations?.items?.length
    ? consultations.items.reduce((latest, c) =>
        c.consultationDate.getTime() > latest.consultationDate.getTime() ? c : latest,
      )
    : null;

  if (!latestCons) {
    return (
      <>
        <PageHeader
          title="Nuevo plan alimentario"
          description={`Para ${patient.fullName}`}
          actions={
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}/planes`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          }
        />
        <PageContent>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Sin consultas registradas
              </CardTitle>
              <CardDescription>
                No se puede crear un plan alimentario sin una consulta activa.
                Registre una consulta primero.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`/pacientes/${patient.id.toString()}/consultas/nueva`}>
                  Ir a nueva consulta
                </Link>
              </Button>
            </CardContent>
          </Card>
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nuevo plan alimentario"
        description={`Para ${patient.fullName}`}
        actions={
          <Button asChild variant="outline">
            <Link to={`/pacientes/${patient.id.toString()}/planes`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Paciente:</span>
          <span className="font-medium">{patient.fullName}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {patient.age} años · {patient.email?.toString() ?? "sin correo"}
          </span>
        </div>
        <MealPlanForm patientId={id} consultationId={latestCons.id} />
      </PageContent>
    </>
  );
}
