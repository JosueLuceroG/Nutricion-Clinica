import { Link, useNavigate, useParams } from "react-router-dom";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, ClipboardList, Calendar, Activity, Trash2, User, DollarSign, Receipt } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState, ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { usePatientConsultations } from "@modules/consultation/ui/useConsultationHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import { ConsultationStatusColor, type ConsultationStatus } from "@modules/consultation/domain/ConsultationStatus";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@modules/consultation/domain/PaymentStatus";
import { MarkAsPaidDialog } from "@modules/consultation/ui/MarkAsPaidDialog";
import { consultationService } from "@services/consultationService";
import { useUIStore } from "@store/uiStore";
import { hasAnyRole, BILLING_ROLES } from "@modules/auth/authRoles";
import { useAuthStore } from "@store/authStore";

function consultationStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: ConsultationStatus) {
  return t(`consultation.status_${status.replace("-", "_")}`);
}

export function PatientConsultationsPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading: patientLoading } = usePatient(id);
  const { data, loading, error, reload } = usePatientConsultations(id);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const user = useAuthStore((s) => s.user);
  const canManagePayment = hasAnyRole(user?.rol ?? null, BILLING_ROLES);

  const [paidTarget, setPaidTarget] = React.useState<Consultation | null>(null);

  const onDelete = async (consultationId: ConsultationId) => {
    if (!confirm(t("consultation.delete_confirm"))) return;
    try {
      await consultationService.delete.execute(consultationId, true);
      toast.success(t("consultation.deleted_success"));
      reload();
    } catch (err) {
      toast.error(t("consultation.delete_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (patientLoading || loading) {
    return (
      <>
        <PageHeader title={t("common.loading")} />
        <PageContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
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
            action={{ label: t("common.back"), onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  const items = data?.items ?? [];
  void sidebarCollapsed;

  return (
    <>
      <PageHeader
        title={t("consultation.patient_consultations", { patientName: patient.fullName })}
        description={t("consultation.count_registered", { count: items.length })}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("patient.back_to_patient")}
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/pacientes/${patient.id.toString()}/consultas/nueva`}>
                <Plus className="mr-2 h-4 w-4" />
                {t("consultation.new")}
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t("consultation.no_patient_consultations")}
            description={t("consultation.first_consultation_desc")}
            action={{
              label: t("consultation.register_first"),
              onClick: () => navigate(`/pacientes/${patient.id.toString()}/consultas/nueva`),
            }}
          />
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <Card key={c.id.toString()}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(c.consultationDate)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {t("consultation.consultation_number", { number: c.consultationNumber })}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        <span className="line-clamp-2">{c.reason}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ConsultationStatusColor[c.status] as never}>
                        {consultationStatusLabel(t, c.status)}
                      </Badge>
                      {c.cost > 0 ? (
                        <Badge variant={PAYMENT_STATUS_COLORS[c.paymentStatus] ?? "secondary"}>
                          <DollarSign className="mr-1 h-3 w-3" />
                          {PAYMENT_STATUS_LABELS[c.paymentStatus] ?? c.paymentStatus}
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("common.delete")}
                        onClick={() => onDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {c.subjective && (
                      <DetailPreview label={t("consultation.subjective")} value={c.subjective} />
                    )}
                    {c.assessment && (
                      <DetailPreview label={t("consultation.assessment")} value={c.assessment} />
                    )}
                    {c.plan && (
                      <DetailPreview label={t("consultation.plan")} value={c.plan} />
                    )}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("consultation.links_title")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.anthropometryId && (
                          <Badge variant="info">
                            <Activity className="mr-1 h-3 w-3" />
                            {t("anthropometry.title")}
                          </Badge>
                        )}
                        {c.labPanelId && (
                          <Badge variant="info">
                            <ClipboardList className="mr-1 h-3 w-3" />
                            {t("lab.title")}
                          </Badge>
                        )}
                        {!c.anthropometryId && !c.labPanelId && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      {c.nextVisitDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("consultation.next_visit_short", { date: new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(c.nextVisitDate) })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {t("patient.label_with_name", { name: patient.fullName })}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManagePayment && (
                        <Button
                          variant={c.isPaid ? "outline" : "default"}
                          size="sm"
                          onClick={() => setPaidTarget(c)}
                          data-testid={`mark-paid-${c.id.toString()}`}
                        >
                          <DollarSign className="mr-1 h-4 w-4" />
                          {c.isPaid ? t("consultation.edit_payment") : t("consultation.mark_as_paid")}
                        </Button>
                      )}
                      {c.isPaid && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/billing/${c.id.toString()}/receipt`}>
                            <Receipt className="mr-1 h-4 w-4" />
                            {t("billing.receipt_title")}
                          </Link>
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/consultas/${c.id.toString()}`}>{t("consultation.view_full_detail")}</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
      <MarkAsPaidDialog
        open={!!paidTarget}
        consultation={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => {
          setPaidTarget(null);
          toast.success(t("consultation.payment_registered"));
          reload();
        }}
      />
    </>
  );
}

function DetailPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/20 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 line-clamp-3 text-xs">{value}</p>
    </div>
  );
}
