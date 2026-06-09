import { Link, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { ConsultationWizard } from "@modules/consultation/ui/ConsultationWizard";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";

export function NewConsultationPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading, error, reload } = usePatient(id);

  if (loading) {
    return (
      <>
        <PageHeader title={t("common.loading")} />
        <PageContent>
          <Skeleton className="h-96 w-full" />
        </PageContent>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t("common.error_occurred")} />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!patient || !id) {
    return (
      <>
        <PageHeader title={t("patient.title_single") + " " + t("common.no_results").toLowerCase()} />
        <PageContent>{null}</PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("consultation.new")}
        description={`${t("common.patient")}: ${patient.fullName} · ${patient.age} ${t("patient.title_single").toLowerCase()}`}
        actions={
          <Button asChild variant="outline">
            <Link to={`/pacientes/${patient.id.toString()}/consultas`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.previous")}
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-3xl">
          <ConsultationWizard
            patientId={id}
            onComplete={(consultationId) =>
              window.location.assign(`#/consultas/${consultationId}`)
            }
          />
        </div>
      </PageContent>
    </>
  );
}
