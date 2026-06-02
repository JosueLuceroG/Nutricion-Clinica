import { Link, useNavigate, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft, User } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import { MealPlanForm } from "@modules/mealplan/ui/MealPlanForm";

export function NewMealPlanPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading, error } = usePatient(id);

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

  if (error || !patient || !id) {
    return (
      <>
        <PageHeader title="Paciente no encontrado" />
        <PageContent>
          <ErrorState
            message={error?.message ?? "No se encontró el paciente"}
            onRetry={() => navigate("/pacientes")}
          />
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
        <MealPlanForm patientId={id} />
      </PageContent>
    </>
  );
}
