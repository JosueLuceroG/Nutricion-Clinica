import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/config";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, X } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState } from "@components/layout/EmptyState";
import {
  useConsultationLive,
  usePatientLive,
} from "@modules/consultation/ui/useBillingHooks";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", i18n.language);

/**
 * Recibo imprimible (HTML, no CFDI).
 * - Botón Imprimir dispara `window.print()`.
 * - CSS print-friendly: oculta sidebar/header/botones; muestra solo el recibo.
 * - Disclaimer visible: "ESTE DOCUMENTO NO ES UN CFDI".
 */
export const ReceiptPage = () => {
  const { t } = useTranslation();
  const { consultationId } = useParams<{ consultationId: string }>();
  const navigate = useNavigate();
  const [now] = useState(() => new Date());

  const consultation = useConsultationLive(consultationId ?? null);
  const patient = usePatientLive(consultation?.patientId.toString() ?? null);

  // Si la consulta no está pagada, mostrar aviso.
  const isReady = consultation !== null && consultation !== undefined;
  const isPaid = isReady && (consultation as { isPaid?: boolean })?.isPaid === true;

  // Inyecta CSS de impresión una sola vez.
  useEffect(() => {
    const id = "billing-receipt-print-css";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #billing-receipt-root, #billing-receipt-root * { visibility: visible !important; }
        #billing-receipt-root {
          position: absolute !important;
          top: 0; left: 0;
          width: 100%;
          padding: 0 !important;
          margin: 0 !important;
        }
        .billing-receipt-no-print { display: none !important; }
        .billing-receipt-page { box-shadow: none !important; border: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  const fechaEmision = useMemo(() => {
    return new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeStyle: "short" }).format(now);
  }, [now]);

  if (consultationId === undefined) {
    return (
      <PageContent>
        <EmptyState title={t("billing.receipt_title")} description={t("common.error_occurred")} />
      </PageContent>
    );
  }

  if (consultation === null) {
    // No cargado aún
    return (
      <>
        <PageHeader title={`${t("common.loading")} ${t("billing.receipt_title")}`} />
        <PageContent>
          <Skeleton className="h-96 w-full" />
        </PageContent>
      </>
    );
  }

  if (!consultation) {
    return (
      <PageContent>
        <EmptyState
          title={t("common.error_occurred")}
          description={t("common.no_results")}
          action={{ label: t("common.previous"), onClick: () => navigate("/billing") }}
        />
      </PageContent>
    );
  }

  if (!isPaid) {
    return (
      <>
        <PageHeader
          title={t("billing.receipt_title")}
          actions={
            <Button asChild variant="outline">
              <Link to="/billing">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.previous")}
              </Link>
            </Button>
          }
        />
        <PageContent>
          <EmptyState
            title={t("common.no_data")}
            description={t("billing.pending_consultations")}
            action={{
              label: t("consultation.mark_as_paid"),
              onClick: () => navigate(`/billing?mark=${consultation.id.toString()}`),
            }}
          />
        </PageContent>
      </>
    );
  }

  const c = consultation;
  return (
    <>
      <PageHeader
        title={t("billing.receipt_title")}
        description={`${t("consultation.title_single")} #${c.consultationNumber} · ${patient?.fullName ?? `(${t("common.loading")})`}`}
        actions={
          <div className="billing-receipt-no-print flex gap-2">
            <Button asChild variant="outline">
              <Link to="/billing">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.previous")}
              </Link>
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("billing.print")}
            </Button>
            <Button asChild variant="ghost">
              <Link to="/billing">
                <X className="mr-2 h-4 w-4" />
                {t("common.close")}
              </Link>
            </Button>
          </div>
        }
      />
      <PageContent>
        <div id="billing-receipt-root" className="mx-auto max-w-2xl">
          <Card className="billing-receipt-page">
            <CardContent className="space-y-6 p-8">
              {/* Encabezado */}
              <header className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-2xl font-bold">{t("common.app_name")}</h2>
                  <p className="text-sm text-muted-foreground">{t("billing.receipt_header")}</p>
                </div>
                <div className="text-right text-sm">
                  <p>
                    <span className="text-muted-foreground">{t("billing.receipt_no", { id: "" })}</span>
                    <span className="font-mono">{c.id.toString().slice(0, 8).toUpperCase()}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("billing.receipt_date", { date: "" })}</span>{fechaEmision}
                  </p>
                </div>
              </header>

              {/* Paciente */}
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                  {t("common.patient")}
                </h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("common.name")}</p>
                    <p className="font-medium">{patient?.fullName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("consultation.consultation_date")}</p>
                    <p className="font-medium">
                      {new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(
                        c.consultationDate,
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Consulta */}
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                  {t("consultation.title_single")}
                </h2>
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">{t("consultation.reason")}:</span> {c.reason}
                  </p>
                  {c.assessment && (
                    <p className="mt-1">
                      <span className="text-muted-foreground">{t("consultation.assessment")}:</span> {c.assessment}
                    </p>
                  )}
                </div>
              </section>

              {/* Pago */}
              <section>
                  <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                    {t("consultation.payment_section")}
                  </h2>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3">{t("common.description")}</td>
                        <td className="p-3 text-right">{t("consultation.title_single")}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3">{t("consultation.payment_method")}</td>
                        <td className="p-3 text-right">
                          {c.paymentMethod ? t(`consultation.method_${c.paymentMethod}`) : "—"}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3">{t("consultation.payment_date")}</td>
                        <td className="p-3 text-right">
                          {c.paidAt
                            ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(
                                c.paidAt,
                              )
                            : "—"}
                        </td>
                      </tr>
                      {c.reference && (
                        <tr className="border-b">
                          <td className="p-3">{t("common.description")}</td>
                          <td className="p-3 text-right font-mono">{c.reference}</td>
                        </tr>
                      )}
                      {c.invoiceNumber && (
                        <tr className="border-b">
                          <td className="p-3">{t("billing.receipt_no", { id: "" })}</td>
                          <td className="p-3 text-right font-mono">{c.invoiceNumber}</td>
                        </tr>
                      )}
                      <tr className="bg-muted/30 font-semibold">
                        <td className="p-3">{t("billing.column_cost")}</td>
                        <td className="p-3 text-right text-lg">{MXN(c.cost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {c.billingNotes && (
                <section>
                  <h2 className="mb-1 text-sm font-semibold uppercase text-muted-foreground">
                    {t("common.notes")}
                  </h2>
                  <p className="text-sm">{c.billingNotes}</p>
                </section>
              )}

              <footer className="border-t pt-4 text-center text-xs text-muted-foreground">
                <p className="font-semibold uppercase text-destructive">
                  {t("billing.receipt_disclaimer")}
                </p>
              </footer>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
};
