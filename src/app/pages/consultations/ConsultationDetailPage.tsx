import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "@store/preferencesStore";
import i18n from "../../../i18n/config";
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  PlayCircle,
  XCircle,
  RotateCcw,
  Activity,
  FlaskConical,
  Heart,
  FileDown,
  DollarSign,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { ErrorState, EmptyState } from "@components/layout/EmptyState";
import { useConsultation } from "@modules/consultation/ui/useConsultationHooks";
import { ConsultationId } from "@modules/consultation/domain/ConsultationId";
import type { ConsultationStatus } from "@modules/consultation/domain/ConsultationStatus";
import { MarkAsPaidDialog } from "@modules/consultation/ui/MarkAsPaidDialog";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@modules/consultation/domain/PaymentStatus";
import { isBillingRole, useCurrentRole } from "@modules/auth/authRoles";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { Vitals } from "@modules/consultation/domain/Vitals";
import { consultationService } from "@services/consultationService";
import { patientService } from "@services/patientService";
import { anthropometryService } from "@services/anthropometryService";
import { labPanelService } from "@services/labPanelService";
import { pdfService } from "@services/pdf/pdfService";
import { formatCurrency } from "@utils/formatCurrency";

function consultationStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: ConsultationStatus) {
  return t(`consultation.status_${status.replace("-", "_")}`);
}

export function ConsultationDetailPage() {
  const { t } = useTranslation();
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const id = consultationId ? ConsultationId.fromUnsafe(consultationId) : null;
  const { data: consultation, loading, error, reload } = useConsultation(id);
  const [busy, setBusy] = React.useState(false);
  const [paidTarget, setPaidTarget] = React.useState<Consultation | null>(null);
  const userRole = useCurrentRole();
  const canManagePayment = isBillingRole(userRole);
  const subscriptionPlan = usePreferencesStore((s) => s.subscriptionPlan);
  const pdfBrandingEnabled = usePreferencesStore((s) => s.pdfBrandingEnabled);
  const clinicDisplayName = usePreferencesStore((s) => s.clinicDisplayName);

  const onTransition = async (to: "in-progress" | "completed" | "cancelled" | "scheduled") => {
    if (!id) return;
    setBusy(true);
    try {
      await consultationService.transition.execute(id, to);
      toast.success(`${t("consultation.title_single")} ${consultationStatusLabel(t, to).toLowerCase()}`);
      reload();
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!id || !consultation) return;
    if (!confirm(`${t("common.delete")} ${t("consultation.title_single").toLowerCase()}? ${t("patient.delete_warning")}`)) return;
    setBusy(true);
    try {
      await consultationService.delete.execute(id, true);
      toast.success(t("consultation.title_single") + " " + t("common.deleted").toLowerCase());
      navigate(`/pacientes/${consultation.patientId.toString()}/consultas`);
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
      setBusy(false);
    }
  };

  const onExportPdf = async () => {
    if (!consultation) return;
    setBusy(true);
    try {
      const patient = await patientService.get.execute(consultation.patientId).catch(() => null);
      if (!patient) {
        toast.error(t("common.no_results"));
        return;
      }
      const anthropometry = consultation.anthropometryId
        ? await anthropometryService.get.execute(consultation.anthropometryId).catch(() => null)
        : null;
      const labPanel = consultation.labPanelId
        ? await labPanelService.get.execute(consultation.labPanelId).catch(() => null)
        : null;
      const pdfAnthropometry = anthropometry
        ? {
            weightKg: anthropometry.weight.toKg(),
            heightCm: anthropometry.height.toCentimeters(),
            bmi: anthropometry.bmi,
            measuredAt: anthropometry.measuredAt,
          }
        : null;
      const pdfLab = labPanel
        ? {
            glucose: labPanel.getValue("GLUCOSA"),
            cholesterol: labPanel.getValue("COLESTEROL_TOTAL"),
            triglycerides: labPanel.getValue("TRIGLICERIDOS"),
            takenAt: labPanel.takenAt,
          }
        : null;
      const branding: { clinicDisplayName: string; showPlatformBranding: boolean } = {
        clinicDisplayName,
        showPlatformBranding: subscriptionPlan === "free" || pdfBrandingEnabled,
      };
      pdfService.downloadConsultation(
        pdfService.generateConsultationPdf(consultation, patient, pdfAnthropometry, pdfLab),
        undefined,
        branding,
      );
      toast.success(t("consultation.pdf_downloaded"));
    } catch (err) {
      toast.error(t("consultation.pdf_export_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !consultation) {
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

  if (!consultation) {
    return (
      <>
        <PageHeader title={t("consultation.not_found_title")} />
        <PageContent>
          <EmptyState
            title={t("consultation.not_found_heading")}
            description={t("consultation.not_found_desc")}
            action={{ label: t("consultation.back_to_consultations"), onClick: () => navigate("/consultas") }}
          />
        </PageContent>
      </>
    );
  }

  const actions: React.ReactNode[] = [];
  if (consultation.status === "scheduled") {
    actions.push(
      <Button key="start" onClick={() => onTransition("in-progress")} disabled={busy}>
        <PlayCircle className="mr-2 h-4 w-4" />
        {t("consultation.start_consultation")}
      </Button>,
    );
  }
  if (consultation.status === "in-progress") {
    actions.push(
      <Button key="complete" onClick={() => onTransition("completed")} disabled={busy}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {t("consultation.complete")}
      </Button>,
    );
  }
  if (consultation.status === "cancelled") {
    actions.push(
      <Button key="reactivate" variant="outline" onClick={() => onTransition("scheduled")} disabled={busy}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {t("consultation.reactivate")}
      </Button>,
    );
  }
  if (consultation.isActive) {
    actions.push(
      <Button key="cancel" variant="outline" onClick={() => onTransition("cancelled")} disabled={busy}>
        <XCircle className="mr-2 h-4 w-4" />
        {t("common.cancel")}
      </Button>,
    );
  }

  return (
    <>
      <PageHeader
        title={t("consultation.consultation_number", { number: consultation.consultationNumber })}
        description={`${new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(consultation.consultationDate)} · ${consultationStatusLabel(t, consultation.status)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${consultation.patientId.toString()}/consultas`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
            {actions}
            {canManagePayment && (
              <Button
                variant={consultation.isPaid ? "outline" : "default"}
                onClick={() => setPaidTarget(consultation)}
                disabled={busy}
                data-testid="mark-paid-detail"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                {consultation.isPaid ? t("consultation.edit_payment") : t("consultation.mark_as_paid")}
              </Button>
            )}
            {consultation.isPaid && (
              <Button asChild variant="outline">
                <Link to={`/billing/${consultation.id.toString()}/receipt`}>
                  <Receipt className="mr-2 h-4 w-4" />
                  {t("billing.receipt_title")}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={onExportPdf} disabled={busy}>
              <FileDown className="mr-2 h-4 w-4" />
              {t("consultation.export_pdf")}
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("common.delete")}
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SOAPSection title={t("consultation.subjective_soap")} body={consultation.subjective} />
            <SOAPSection title={t("consultation.objective_soap")} body={consultation.objective} />
            <VitalsSection vitals={consultation.vitals} />
            <SOAPSection title={t("consultation.assessment_soap")} body={consultation.assessment} />
            <SOAPSection title={t("consultation.plan_soap")} body={consultation.plan} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("consultation.reason")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{consultation.reason}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("consultation.links_title")}</CardTitle>
                <CardDescription>{t("consultation.links_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {consultation.anthropometryId ? (
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t("consultation.anthropometry_link")}</p>
                      <p className="text-xs text-muted-foreground">{t("consultation.linked_to_consultation")}</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        to={`/pacientes/${consultation.patientId.toString()}/antropometria`}
                      >
                        {t("common.view_details")}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("consultation.no_anthropometry_link")}</p>
                )}
                {consultation.labPanelId ? (
                  <div className="flex items-center gap-2 rounded-md border p-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t("consultation.lab_panel")}</p>
                      <p className="text-xs text-muted-foreground">{t("consultation.linked_to_consultation")}</p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        to={`/pacientes/${consultation.patientId.toString()}/laboratorio`}
                      >
                        {t("common.view_details")}
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("consultation.no_lab_panel_link")}</p>
                )}
              </CardContent>
            </Card>

            {consultation.nextVisitDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("consultation.next_visit")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(consultation.nextVisitDate)}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  {t("consultation.payment_section")}
                </CardTitle>
                <CardDescription>
                  {consultation.cost > 0 ? t("consultation.payment_section") : t("consultation.no_cost_assigned")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("consultation.cost")}</span>
                  <span className="text-sm font-medium">
                    {consultation.cost > 0 ? formatCurrency(consultation.cost) : "—"}
                  </span>
                </div>
                {consultation.paymentConcept && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("consultation.payment_concept")}</span>
                    <span className="text-sm">{t(`consultation.concept_${consultation.paymentConcept}`)}</span>
                  </div>
                )}
                {consultation.amountPaid > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("consultation.amount_paid")}</span>
                    <span className="text-sm font-medium">{formatCurrency(consultation.amountPaid)}</span>
                  </div>
                )}
                {consultation.paymentStatus === "paid" && consultation.paymentMethod && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("consultation.payment_method")}</span>
                    <span className="text-sm">{t(`consultation.method_${consultation.paymentMethod}`)}</span>
                  </div>
                )}
                {consultation.isPaid && consultation.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("common.date")}</span>
                    <span className="text-sm">
                      {new Intl.DateTimeFormat(i18n.language, { dateStyle: "short" }).format(consultation.paidAt)}
                    </span>
                  </div>
                )}
                {consultation.reference && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("consultation.reference")}</span>
                    <span className="text-sm font-mono">{consultation.reference}</span>
                  </div>
                )}
                {consultation.invoiceNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("consultation.invoice")}</span>
                    <span className="text-sm font-mono">{consultation.invoiceNumber}</span>
                  </div>
                )}
                {consultation.cost > 0 && (
                  <Badge
                    variant={PAYMENT_STATUS_COLORS[consultation.paymentStatus] ?? "secondary"}
                    className="mt-2"
                  >
                    <DollarSign className="mr-1 h-3 w-3" />
                    {PAYMENT_STATUS_LABELS[consultation.paymentStatus] ?? consultation.paymentStatus}
                  </Badge>
                )}
                {canManagePayment && (
                  <Button
                    variant={consultation.isPaid ? "outline" : "default"}
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setPaidTarget(consultation)}
                    disabled={busy}
                    data-testid="mark-paid-card"
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    {consultation.isPaid ? t("consultation.edit_payment") : t("consultation.mark_as_paid")}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("consultation.audit")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>{t("consultation.created_at", { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" }).format(consultation.createdAt) })}</p>
                <p>{t("consultation.updated_at", { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" }).format(consultation.updatedAt) })}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContent>
      <MarkAsPaidDialog
        open={!!paidTarget}
        consultation={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => {
          setPaidTarget(null);
          reload();
        }}
      />
    </>
  );
}

function SOAPSection({ title, body }: { title: string; body: string | null }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {body ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">{t("consultation.no_notes")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function VitalsSection({ vitals }: { vitals: Vitals }) {
  const { t } = useTranslation();
  const rows: Array<{ label: string; value: string | null; unit: string }> = [
    { label: t("consultation.blood_pressure"), value: vitals.systolicMmHg !== null && vitals.diastolicMmHg !== null ? `${vitals.systolicMmHg}/${vitals.diastolicMmHg}` : null, unit: "mmHg" },
    { label: t("consultation.heart_rate"), value: vitals.heartRateBpm?.toString() ?? null, unit: t("consultation.bpm") },
    { label: t("consultation.temperature"), value: vitals.temperatureC?.toString() ?? null, unit: "°C" },
  ];
  const captured = rows.filter((r) => r.value !== null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4" />
          {t("consultation.vitals_section")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {vitals.isEmpty || captured.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t("consultation.no_vitals_taken")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label} className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</p>
                <p className="mt-1 text-lg font-semibold">
                  {r.value ?? <span className="text-sm font-normal text-muted-foreground">—</span>}
                  {r.value && <span className="ml-1 text-xs font-normal text-muted-foreground">{r.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
