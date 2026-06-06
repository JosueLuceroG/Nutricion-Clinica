import { useEffect, useMemo, useState } from "react";
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
import { PAYMENT_METHOD_LABELS } from "@modules/consultation/domain/PaymentMethod";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", "es-MX");

/**
 * Recibo imprimible (HTML, no CFDI).
 * - Botón Imprimir dispara `window.print()`.
 * - CSS print-friendly: oculta sidebar/header/botones; muestra solo el recibo.
 * - Disclaimer visible: "ESTE DOCUMENTO NO ES UN CFDI".
 */
export const ReceiptPage = () => {
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
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" }).format(now);
  }, [now]);

  if (consultationId === undefined) {
    return (
      <PageContent>
        <EmptyState title="Recibo no disponible" description="Falta el ID de la consulta." />
      </PageContent>
    );
  }

  if (consultation === null) {
    // No cargado aún
    return (
      <>
        <PageHeader title="Cargando recibo…" />
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
          title="Consulta no encontrada"
          description="La consulta solicitada no existe o fue eliminada."
          action={{ label: "Volver", onClick: () => navigate("/billing") }}
        />
      </PageContent>
    );
  }

  if (!isPaid) {
    return (
      <>
        <PageHeader
          title="Recibo no disponible"
          actions={
            <Button asChild variant="outline">
              <Link to="/billing">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          }
        />
        <PageContent>
          <EmptyState
            title="La consulta aún no está pagada"
            description="Solo se pueden emitir recibos de consultas con pago registrado."
            action={{
              label: "Marcar como pagada",
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
        title="Recibo"
        description={`Consulta #${c.consultationNumber} · ${patient?.fullName ?? "(cargando paciente)"}`}
        actions={
          <div className="billing-receipt-no-print flex gap-2">
            <Button asChild variant="outline">
              <Link to="/billing">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button asChild variant="ghost">
              <Link to="/billing">
                <X className="mr-2 h-4 w-4" />
                Cerrar
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
                  <h1 className="text-2xl font-bold">NutriClínica</h1>
                  <p className="text-sm text-muted-foreground">RECIBO DE PAGO</p>
                </div>
                <div className="text-right text-sm">
                  <p>
                    <span className="text-muted-foreground">Folio:</span>{" "}
                    <span className="font-mono">{c.id.toString().slice(0, 8).toUpperCase()}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Emisión:</span> {fechaEmision}
                  </p>
                </div>
              </header>

              {/* Paciente */}
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                  Paciente
                </h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Nombre</p>
                    <p className="font-medium">{patient?.fullName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha de consulta</p>
                    <p className="font-medium">
                      {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
                        c.consultationDate,
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Consulta */}
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                  Consulta
                </h2>
                <div className="rounded-md border p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Motivo:</span> {c.reason}
                  </p>
                  {c.assessment && (
                    <p className="mt-1">
                      <span className="text-muted-foreground">Diagnóstico:</span> {c.assessment}
                    </p>
                  )}
                </div>
              </section>

              {/* Pago */}
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">
                  Pago
                </h2>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3">Concepto</td>
                        <td className="p-3 text-right">Consulta nutricional</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3">Método de pago</td>
                        <td className="p-3 text-right">
                          {c.paymentMethod ? PAYMENT_METHOD_LABELS[c.paymentMethod] : "—"}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3">Fecha de pago</td>
                        <td className="p-3 text-right">
                          {c.paidAt
                            ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(
                                c.paidAt,
                              )
                            : "—"}
                        </td>
                      </tr>
                      {c.reference && (
                        <tr className="border-b">
                          <td className="p-3">Referencia</td>
                          <td className="p-3 text-right font-mono">{c.reference}</td>
                        </tr>
                      )}
                      {c.invoiceNumber && (
                        <tr className="border-b">
                          <td className="p-3">Nº de factura</td>
                          <td className="p-3 text-right font-mono">{c.invoiceNumber}</td>
                        </tr>
                      )}
                      <tr className="bg-muted/30 font-semibold">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right text-lg">{MXN(c.cost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {c.billingNotes && (
                <section>
                  <h2 className="mb-1 text-sm font-semibold uppercase text-muted-foreground">
                    Notas
                  </h2>
                  <p className="text-sm">{c.billingNotes}</p>
                </section>
              )}

              <footer className="border-t pt-4 text-center text-xs text-muted-foreground">
                <p className="font-semibold uppercase text-destructive">
                  Este documento NO es un CFDI
                </p>
                <p>
                  La facturación electrónica ante el SAT es responsabilidad del
                  profesional de la salud.
                </p>
              </footer>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
};
