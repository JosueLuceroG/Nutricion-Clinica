import { Link, useParams, useSearchParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { ConsultationWizard } from "@modules/consultation/ui/ConsultationWizard";
import type { ConsultationFormValues } from "@modules/consultation/application/consultationFormSchema";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";

export function NewConsultationPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const prefillReason = searchParams.get("reason") || "";
  const prefillDate = searchParams.get("appointmentDate") || "";

  const initialValues = React.useMemo<Partial<ConsultationFormValues> | undefined>(() => {
    const vals: Partial<ConsultationFormValues> = {};
    if (prefillReason) vals.reason = prefillReason;
    if (prefillDate) vals.consultationDate = prefillDate;
    return Object.keys(vals).length > 0 ? vals : undefined;
  }, [prefillReason, prefillDate]);

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
            initialValues={initialValues}
            onComplete={(consultationId) => {
              if (appointmentId) {
                window.location.assign(`#/agenda`);
              } else {
                window.location.assign(`#/consultas/${consultationId}`);
              }
            }}
          />
        </div>
      </PageContent>
    </>
  );
}
