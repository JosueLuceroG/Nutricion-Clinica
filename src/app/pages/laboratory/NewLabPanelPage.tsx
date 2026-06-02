import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { LabPanelForm } from "@modules/laboratory/ui/LabPanelForm";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { Sex } from "@modules/patient/domain/Sex";

export function NewLabPanelPage() {
  const { patientId } = useParams();
  const id = patientId ? PatientId.fromUnsafe(patientId) : null;
  const { data: patient, loading, error, reload } = usePatient(id);

  if (loading) {
    return (
      <>
        <PageHeader title="Cargando paciente…" />
        <PageContent>
          <div className="mx-auto max-w-4xl space-y-4">
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

  if (!patient || !id) {
    return (
      <>
        <PageHeader title="Paciente no encontrado" />
        <PageContent>{null}</PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nuevo panel de laboratorio"
        description={`Paciente: ${patient.fullName} · ${patient.age} años`}
        actions={
          <Button asChild variant="outline">
            <Link to={`/pacientes/${patient.id.toString()}/laboratorio`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-4xl">
          <LabPanelForm
            patientId={id}
            patientAge={patient.age}
            patientSex={patient.sex as Sex}
          />
        </div>
      </PageContent>
    </>
  );
}
