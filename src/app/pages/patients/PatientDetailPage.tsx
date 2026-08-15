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
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ClinicalRecordCards } from "@modules/clinical-record/ui/ClinicalRecordCards";
import { PatientMealPhotosCard } from "./PatientMealPhotosCard";
import { PatientPortalLinksCard } from "./PatientPortalLinksCard";
import { PatientPortalAdherenceCard } from "./PatientPortalAdherenceCard";
import { PatientMessagingCard } from "./PatientMessagingCard";
import { PatientSubstitutionsCard } from "./PatientSubstitutionsCard";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { usePatientPaymentSummary } from "@modules/consultation/ui/useBillingHooks";
import { useCascadeDeletePatient } from "@modules/patient/ui/useCascadeDeletePatient";
import { CascadeDeletePatientDialog } from "@modules/patient/ui/CascadeDeletePatientDialog";
import { PatientMedicalIntakeCard } from "@modules/patient/ui/PatientMedicalIntakeCard";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Gender } from "@modules/patient/domain/Gender";
import type { MaritalStatus } from "@modules/patient/domain/MaritalStatus";
import type { EducationLevel } from "@modules/patient/domain/EducationLevel";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { RecordStatus } from "@modules/patient/domain/RecordStatus";
import type { PatientStatus } from "@modules/patient/domain/PatientStatus";
import { patientService } from "@services/patientService";
import { formatCurrency } from "@utils/formatCurrency";
import { usePreferencesStore } from "@store/preferencesStore";

function patientStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: PatientStatus) {
  if (status === "deceased") return t("patient.status_deceased");
  return t(`common.${status}`);
}

function recordStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: RecordStatus) {
  if (status === "discharged") return t("patient.record_discharged");
  if (status === "referred") return t("patient.record_referred");
  return t(`common.${status}`);
}

const patientRoutePreloaders = {
  directory: () => import("@app/pages/patients/PatientsListPage"),
  edit: () => import("@app/pages/patients/NewPatientPage"),
  consultations: () => import("@app/pages/consultations/PatientConsultationsPage"),
  anthropometry: () => import("@app/pages/anthropometry/PatientMeasurementsPage"),
  laboratory: () => import("@app/pages/laboratory/PatientLabPage"),
  plans: () => import("@app/pages/plans/PatientMealPlansPage"),
  adherence: () => import("@app/pages/patients/PatientAdherencePage"),
};

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
  const isBeginnerMode = usePreferencesStore((s) => s.usageMode === "beginner");
  const [advancedOpen, setAdvancedOpen] = React.useState(!isBeginnerMode);

  React.useEffect(() => {
    setAdvancedOpen(!isBeginnerMode);
  }, [isBeginnerMode, patientId]);

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
              <Link
                to="/pacientes"
                onPointerEnter={() => void patientRoutePreloaders.directory()}
                onPointerDown={() => void patientRoutePreloaders.directory()}
                onFocus={() => void patientRoutePreloaders.directory()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                to={`/pacientes/${patient.id.toString()}/editar`}
                onPointerEnter={() => void patientRoutePreloaders.edit()}
                onPointerDown={() => void patientRoutePreloaders.edit()}
                onFocus={() => void patientRoutePreloaders.edit()}
              >
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
              {patient.photoUrl && (
                <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                  <img
                    src={patient.photoUrl}
                    alt={t("patient.profile_photo_alt", {
                      name: patient.fullName,
                    })}
                    className="h-20 w-20 shrink-0 rounded-lg border object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {t("patient.profile_photo")}
                    </p>
                    <p className="truncate text-sm font-medium">
                      {patient.fullName}
                    </p>
                  </div>
                </div>
              )}
              <DetailRow label={t("patient.full_name")} value={patient.fullName} />
              <DetailRow label={t("patient.birth_date")} value={new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(patient.birthDate)} />
              <DetailRow label={t("patient.age")} value={t("patient.age_value", { age: patient.age })} />
              <DetailRow label={t("patient.sex")} value={t(`patient.sex_${patient.sex}`)} />
              {patient.occupation && <DetailRow label={t("patient.occupation")} value={patient.occupation} />}
              {patient.externalRecordNumber && (
                <DetailRow
                  label={t("patient.external_record_number")}
                  value={patient.externalRecordNumber}
                />
              )}
              {patient.admissionReason && (
                <DetailRow
                  label={t("patient.wizard.admission_reason")}
                  value={patient.admissionReason}
                />
              )}
              {patient.whatsappEnabled !== null && (
                <DetailRow
                  label={t("patient.wizard.whatsapp_question")}
                  value={t(
                    patient.whatsappEnabled ? "common.yes" : "common.no",
                  )}
                />
              )}
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

            <PatientPaymentSummaryCard patientId={patient.id.toString()} />

            {isBeginnerMode ? (
              <AdvancedPatientToolsToggle
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
              >
                <PatientPortalLinksCard patientId={patient.id.toString()} />
                <PatientPortalAdherenceCard patientId={patient.id.toString()} />
                <PatientMealPhotosCard patientId={patient.id.toString()} />
                <PatientMessagingCard patientId={patient.id.toString()} />
                <PatientSubstitutionsCard patientId={patient.id.toString()} />
              </AdvancedPatientToolsToggle>
            ) : (
              <>
                <PatientPortalLinksCard patientId={patient.id.toString()} />
                <PatientPortalAdherenceCard patientId={patient.id.toString()} />
                <PatientMealPhotosCard patientId={patient.id.toString()} />
                <PatientMessagingCard patientId={patient.id.toString()} />
                <PatientSubstitutionsCard patientId={patient.id.toString()} />
              </>
            )}

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

        <PatientRecordDetailsCard patient={patient} />

        <PatientMedicalIntakeCard intake={patient.medicalIntake} />

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
              preload={patientRoutePreloaders.consultations}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/antropometria`}
              icon={Activity}
              label={t("anthropometry.title")}
              hint={t("patient.module_anthropometry_hint")}
              preload={patientRoutePreloaders.anthropometry}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/laboratorio`}
              icon={FlaskConical}
              label={t("lab.title")}
              hint={t("patient.module_lab_hint")}
              preload={patientRoutePreloaders.laboratory}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/planes`}
              icon={UtensilsCrossed}
              label={t("mealplan.title")}
              hint={t("patient.module_meal_plans_hint")}
              preload={patientRoutePreloaders.plans}
            />
            <ModuleLink
              to={`/pacientes/${patient.id.toString()}/adherencia`}
              icon={ClipboardCheck}
              label={t("adherence.title")}
              hint={t("adherence.record_desc")}
              preload={patientRoutePreloaders.adherence}
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

const GENDER_LABEL_KEYS: Record<Gender, string> = {
  woman: "patient.gender_female",
  man: "patient.gender_male",
  non_binary: "patient.gender_non_binary",
  undisclosed: "patient.gender_undisclosed",
  other: "patient.gender_other",
};

const MARITAL_STATUS_LABEL_KEYS: Record<MaritalStatus, string> = {
  single: "patient.marital_single",
  married: "patient.marital_married",
  divorced: "patient.marital_divorced",
  widowed: "patient.marital_widowed",
  cohabiting: "patient.marital_free_union",
};

const EDUCATION_LABEL_KEYS: Record<EducationLevel, string> = {
  none: "patient.education_none",
  primary: "patient.education_primary",
  secondary: "patient.education_secondary",
  high_school: "patient.education_high_school",
  bachelor: "patient.education_bachelor",
  postgraduate: "patient.education_postgraduate",
};

function PatientRecordDetailsCard({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  const hasDetails = Boolean(
    patient.gender ||
      patient.maritalStatus ||
      patient.education ||
      patient.claveInterna ||
      patient.birthPlace ||
      patient.address ||
      patient.nationality ||
      patient.idType ||
      patient.idNumber ||
      patient.dischargeReason ||
      patient.responsibleProfessionalId ||
      patient.consentimientoInformadoId ||
      patient.fechaFirmaConsentimiento ||
      patient.versionPoliticaPrivacidad,
  );
  if (!hasDetails) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("patient.identification_and_record")}</CardTitle>
        <CardDescription>
          {t("patient.identification_and_record_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-3 md:grid-cols-2">
        {patient.gender && (
          <DetailRow
            label={t("patient.gender")}
            value={t(GENDER_LABEL_KEYS[patient.gender])}
          />
        )}
        {patient.maritalStatus && (
          <DetailRow
            label={t("patient.marital_status")}
            value={t(MARITAL_STATUS_LABEL_KEYS[patient.maritalStatus])}
          />
        )}
        {patient.education && (
          <DetailRow
            label={t("patient.education")}
            value={t(EDUCATION_LABEL_KEYS[patient.education])}
          />
        )}
        {patient.claveInterna && (
          <DetailRow
            label={t("patient.clave_interna")}
            value={patient.claveInterna}
          />
        )}
        {patient.birthPlace && (
          <DetailRow
            label={t("patient.birth_place")}
            value={patient.birthPlace}
          />
        )}
        {patient.nationality && (
          <DetailRow
            label={t("patient.nationality")}
            value={patient.nationality}
          />
        )}
        {patient.address && (
          <DetailRow
            label={t("patient.address")}
            value={patient.address}
          />
        )}
        {patient.idType && (
          <DetailRow
            label={t("patient.id_type")}
            value={patient.idType}
          />
        )}
        {patient.idNumber && (
          <DetailRow
            label={t("patient.id_number")}
            value={patient.idNumber}
          />
        )}
        {patient.dischargeReason && (
          <DetailRow
            label={t("patient.discharge_reason")}
            value={patient.dischargeReason}
          />
        )}
        {patient.responsibleProfessionalId && (
          <DetailRow
            label={t("patient.responsible_professional_id")}
            value={patient.responsibleProfessionalId}
          />
        )}
        {patient.consentimientoInformadoId && (
          <DetailRow
            label={t("patient.informed_consent")}
            value={patient.consentimientoInformadoId.toString()}
          />
        )}
        {patient.fechaFirmaConsentimiento && (
          <DetailRow
            label={t("patient.consent_signed_at")}
            value={new Intl.DateTimeFormat(undefined, {
              dateStyle: "long",
              timeStyle: "short",
            }).format(patient.fechaFirmaConsentimiento)}
          />
        )}
        {patient.versionPoliticaPrivacidad && (
          <DetailRow
            label={t("patient.privacy_policy_version")}
            value={patient.versionPoliticaPrivacidad}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PatientPaymentSummaryCard({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const paymentSummary = usePatientPaymentSummary(patientId);
  if (!paymentSummary) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          {t("billing.payments_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("billing.total_transactions")}
          </span>
          <span className="font-medium">
            {paymentSummary.consultationCount}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("billing.income_total")}
          </span>
          <span className="font-medium text-green-600">
            {formatCurrency(paymentSummary.totalPaid)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("billing.pending_collection")}
          </span>
          <span className="font-medium text-amber-600">
            {formatCurrency(paymentSummary.totalPending)}
          </span>
        </div>
        <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground">
          <span>
            {paymentSummary.paidCount}{" "}
            {t("billing.paid_consultations").toLowerCase()}
          </span>
          <span>
            {paymentSummary.pendingCount}{" "}
            {t("billing.pending_consultations").toLowerCase()}
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-1 w-full">
          <Link to={`/billing/payments?patientId=${patientId}`}>
            {t("common.view_details")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium whitespace-pre-wrap">
        {value}
      </span>
    </div>
  );
}

function AdvancedPatientToolsToggle({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("patient.beginner_advanced_tools")}</CardTitle>
          <CardDescription>{t("patient.beginner_advanced_tools_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onOpenChange(!open)}
          >
            {open ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {open ? t("patient.beginner_hide_advanced") : t("patient.beginner_show_advanced")}
          </Button>
        </CardContent>
      </Card>
      {open && children}
    </>
  );
}

function ModuleLink({
  to,
  icon: Icon,
  label,
  hint,
  preload,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  preload: () => Promise<unknown>;
}) {
  const preloadRoute = () => {
    void preload();
  };

  return (
    <Link
      to={to}
      className="group rounded-md border bg-card p-3 transition-colors hover:border-primary hover:bg-accent"
      onPointerEnter={preloadRoute}
      onPointerDown={preloadRoute}
      onFocus={preloadRoute}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Link>
  );
}
