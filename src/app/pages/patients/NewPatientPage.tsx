import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import {
  PatientForm,
  PatientFormSkeleton,
} from "@modules/patient/ui/PatientForm";
import { NewPatientWizard } from "@modules/patient/ui/NewPatientWizard";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { PatientId } from "@modules/patient/domain/PatientId";

export function NewPatientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(patientId);
  const returnToQuickConsultation =
    searchParams.get("returnTo") === "quick-consultation";
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading } = usePatient(isEdit ? id : null);

  if (!isEdit) {
    return (
      <NewPatientWizard
        onCreated={
          returnToQuickConsultation
            ? (created) =>
                navigate(
                  `/?quickConsultation=1&patientId=${encodeURIComponent(created.id.toString())}`,
                )
            : undefined
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t("patient.edit_title")}
        description={t("patient.edit_description")}
        actions={
          <Button asChild variant="outline">
            <Link
              to={
                patient ? `/pacientes/${patient.id.toString()}` : "/pacientes"
              }
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.back")}
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <PatientFormSkeleton />
          ) : patient ? (
            <PatientForm
              mode="edit"
              patientId={id ?? undefined}
              initialPatient={patient}
            />
          ) : null}
        </div>
      </PageContent>
    </>
  );
}
