import { Link, useParams } from "react-router-dom";
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState } from "@components/layout/EmptyState";
import { AnthropometryForm } from "@modules/anthropometry/ui/AnthropometryForm";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { Sex } from "@modules/patient/domain/Sex";

export function NewMeasurementPage() {
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
          <div className="mx-auto max-w-3xl space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
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
        <PageHeader title={t("patient.title_single") + " " + t("common.no_results")} />
        <PageContent>{null}</PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("anthropometry.new_title")}
        description={`${t("patient.title_single")}: ${patient.fullName}`}
        actions={
          <Button asChild variant="outline">
            <Link to={`/pacientes/${patient.id.toString()}/antropometria`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.previous")}
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-3xl">
          <AnthropometryForm
            patientId={id}
            defaultAge={patient.age}
            defaultSex={patient.sex as Sex}
          />
        </div>
      </PageContent>
    </>
  );
}
