import { Link, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { PatientForm, PatientFormSkeleton } from "@modules/patient/ui/PatientForm";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";

export function NewPatientPage() {
  const { patientId } = useParams();
  const isEdit = Boolean(patientId);
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading } = usePatient(isEdit ? id : null);

  return (
    <>
      <PageHeader
        title={isEdit ? "Editar paciente" : "Nuevo paciente"}
        description={
          isEdit
            ? "Modifica los datos del paciente"
            : "Registra un nuevo paciente en el sistema"
        }
        actions={
          <Button asChild variant="outline">
            <Link to={isEdit && patient ? `/pacientes/${patient.id.toString()}` : "/pacientes"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-3xl">
          {isEdit ? (
            loading ? (
              <PatientFormSkeleton />
            ) : patient ? (
              <PatientForm
                mode="edit"
                patientId={id ?? undefined}
                initialPatient={patient}
              />
            ) : null
          ) : (
            <PatientForm mode="create" />
          )}
        </div>
      </PageContent>
    </>
  );
}
