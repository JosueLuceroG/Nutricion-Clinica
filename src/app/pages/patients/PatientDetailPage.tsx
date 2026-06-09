import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  ClipboardCheck,
  UtensilsCrossed,
  Heart,
  Tags,
  FileText,
} from "lucide-react";
import { ClinicalRecordCards } from "@modules/clinical-record/ui/ClinicalRecordCards";
import { PatientPortalLinksCard } from "./PatientPortalLinksCard";
import { PatientPortalAdherenceCard } from "./PatientPortalAdherenceCard";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { useCascadeDeletePatient } from "@modules/patient/ui/useCascadeDeletePatient";
import { CascadeDeletePatientDialog } from "@modules/patient/ui/CascadeDeletePatientDialog";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { RecordStatus } from "@modules/patient/domain/RecordStatus";
import type { PatientStatus } from "@modules/patient/domain/PatientStatus";
import { patientService } from "@services/patientService";

function patientStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: PatientStatus) {
  if (status === "deceased") return t("patient.status_deceased");
  return t(`common.${status}`);
}

function recordStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: RecordStatus) {
  if (status === "discharged") return t("patient.record_discharged");
  if (status === "referred") return t("patient.record_referred");
  return t(`common.${status}`);
}

export function PatientDetailPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading, error, reload, deleted } = usePatient(id);
  const [busy, setBusy] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  // Flujo de eliminación: si el paciente tiene entidades vinculadas
  // (consultas, planes, labs, antropometrias) abre el modal de cascada
  // con dos opciones (Archivar / Eliminar todo). Si no tiene, ejecuta
  // el borrado simple directamente.
  const cascade = useCascadeDeletePatient({
    onComplete: (outcome) => {
      if (outcome === "deleted") {
        toast.success(t("patient.deleted_with_entities_success"));
      } else if (outcome === "archived") {
        toast.success(t("patient.archived"));
      }
      // `replace: true` evita que el botón "atrás" del navegador traiga
      // de vuelta al paciente eliminado. Si por alguna razón el
      // navigate tarda, el hook usePatient ya marcó `deleted: true` y
      // la UI muestra el empty state "Paciente no existe" en vez de
      // datos viejos.
      navigate("/pacientes", { replace: true });
    },
    onError: (err) => {
      toast.error(t("patient.operation_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const onArchive = async () => {
    if (!id || !patient) return;
    setArchiveOpen(true);
  };

  const executeArchive = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await patientService.archive.execute(id);
      toast.success(t("patient.archived"));
      setArchiveOpen(false);
      navigate("/pacientes", { replace: true });
    } catch (err) {
      toast.error(t("patient.archive_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !patient) {
    return (
      <>
        <PageHeader title={t("common.loading")} />
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
        <PageHeader title={t("common.error_title")} />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <PageHeader title={t("patient.not_found_title")} />
        <PageContent>
          <EmptyState
            title={t("patient.not_exists")}
            description={
              deleted
                ? t("patient.not_found_deleted_desc")
                : t("patient.not_found_desc")
            }
            action={{ label: t("patient.back_to_patients"), onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={patient.fullName}
        description={t("patient.record_short", { id: patient.id.toString().slice(0, 8) })}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/pacientes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("common.edit")}
              </Link>
            </Button>
            {patient.status === "active" && (
              <Button variant="outline" onClick={onArchive} disabled={busy || cascade.busy || cascade.loadingCounts}>
                <Archive className="mr-2 h-4 w-4" />
                {t("common.archive")}
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => id && cascade.requestDelete(id)}
              disabled={busy || cascade.busy || cascade.loadingCounts}
              data-testid="delete-patient-button"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {cascade.loadingCounts ? t("common.counting") : t("common.delete")}
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
                {t("layout.context_patient_title")}
              </CardTitle>
              <CardDescription>
                {t("patient.record_created", { status: recordStatusLabel(t, patient.recordStatus), date: new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(patient.createdAt) })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow label={t("patient.full_name")} value={patient.fullName} />
              <DetailRow label={t("patient.birth_date")} value={new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(patient.birthDate)} />
              <DetailRow label={t("patient.age")} value={t("patient.age_value", { age: patient.age })} />
              <DetailRow label={t("patient.sex")} value={t(`patient.sex_${patient.sex}`)} />
              {patient.occupation && <DetailRow label={t("patient.occupation")} value={patient.occupation} />}
              <DetailRow
                label={t("common.status")}
                value={
                  <Badge variant={patient.isActive ? "success" : "secondary"}>
                    {patientStatusLabel(t, patient.status)}
                  </Badge>
                }
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("patient.contact")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {patient.email ? (
                  <a href={`mailto:${patient.email.toString()}`} className="flex items-center gap-2 text-sm hover:underline">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {patient.email.toString()}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("patient.no_email")}</p>
                )}
                {patient.phone ? (
                  <a href={`tel:${patient.phone.toString()}`} className="flex items-center gap-2 text-sm hover:underline">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {patient.phone.toString()}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("patient.no_phone")}</p>
                )}
                {patient.secondaryPhone && (
                  <a href={`tel:${patient.secondaryPhone.toString()}`} className="flex items-center gap-2 text-sm hover:underline text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {t("patient.secondary_phone_value", { phone: patient.secondaryPhone.toString() })}
                  </a>
                )}
                <div className="border-t pt-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t("patient.last_update", { date: new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(patient.updatedAt) })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <PatientPortalLinksCard patientId={patient.id.toString()} />

            <PatientPortalAdherenceCard patientId={patient.id.toString()} />

            {(patient.emergencyContactName || patient.emergencyContactPhone) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Heart className="h-4 w-4 text-rose-500" />
                    {t("patient.emergency_contact")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {patient.emergencyContactName && <p>{patient.emergencyContactName}</p>}
                  {patient.emergencyContactRelationship && <p className="text-xs text-muted-foreground">{patient.emergencyContactRelationship}</p>}
                  {patient.emergencyContactPhone && (
                    <a href={`tel:${patient.emergencyContactPhone.toString()}`} className="flex items-center gap-2 text-sm hover:underline">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {patient.emergencyContactPhone.toString()}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {patient.generalNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    <FileText className="mr-1 h-3 w-3 inline" />
                    {t("patient.general_notes")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{patient.generalNotes}</p>
                </CardContent>
              </Card>
            )}

            {patient.clinicalTags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Tags className="h-4 w-4" />
                    {t("patient.clinical_tags")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1">
                  {patient.clinicalTags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t("patient.clinical_modules")}</CardTitle>
            <CardDescription>{t("patient.structured_info")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/consultas`}
              icon={ClipboardList}
              label={t("consultation.title")}
              hint={t("patient.module_consultations_hint")}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/antropometria`}
              icon={Activity}
              label={t("anthropometry.title")}
              hint={t("patient.module_anthropometry_hint")}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/laboratorio`}
              icon={FlaskConical}
              label={t("lab.title")}
              hint={t("patient.module_lab_hint")}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/planes`}
              icon={UtensilsCrossed}
              label={t("mealplan.title")}
              hint={t("patient.module_meal_plans_hint")}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/adherencia`}
              icon={ClipboardCheck}
              label={t("adherence.title")}
              hint={t("adherence.record_desc")}
            />
          </CardContent>
        </Card>

        <ClinicalRecordCards patientId={patient.id.toString()} />
      </PageContent>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={t("patient.archive_title", { name: patient.fullName })}
        description={t("patient.archive_desc")}
        confirmLabel={t("common.archive")}
        tone="warning"
        busy={busy}
        onConfirm={executeArchive}
      />

      <CascadeDeletePatientDialog
        open={cascade.dialogOpen}
        patientName={patient.fullName}
        counts={cascade.counts}
        loading={cascade.loadingCounts}
        busy={cascade.busy}
        onCancel={cascade.cancel}
        onArchive={cascade.archive}
        onDeleteAll={cascade.deleteAll}
      />
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
