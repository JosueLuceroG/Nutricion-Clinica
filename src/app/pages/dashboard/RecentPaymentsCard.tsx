import { Link } from "react-router-dom";
import { ArrowRight, ReceiptText } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { RecentPaymentItem, RecentPaymentStatus } from "./dashboardMockData";

interface RecentPaymentsCardProps {
  payments: RecentPaymentItem[];
}

function paymentStatusClass(status: RecentPaymentStatus) {
  if (status === "Pagado") return "paid";
  if (status === "Parcial") return "partial";
  return "pending";
}

export function RecentPaymentsCard({ payments }: RecentPaymentsCardProps) {
  return (
    <DashboardSectionCard
      title="Pagos recientes"
      icon={<ReceiptText size={20} strokeWidth={1.9} />}
      action={
        <Link className="nc-dashboard-card-action" to="/billing/payments">
          Ver pagos
        </Link>
      }
      className="nc-dashboard-section-card--payments"
    >
      {payments.length > 0 ? (
        <ul className="nc-dashboard-payments" aria-label="Pagos recientes">
          {payments.map((payment) => (
            <li key={`${payment.patient}-${payment.date}-${payment.amount}`} className="nc-dashboard-payments__item">
              <span className={`nc-dashboard-payments__avatar nc-dashboard-payments__avatar--${payment.avatarTone}`}>
                {payment.avatar}
              </span>
              <span className="nc-dashboard-payments__body">
                <span className="nc-dashboard-payments__patient">{payment.patient}</span>
                <span className="nc-dashboard-payments__concept">{payment.concept}</span>
                <span className="nc-dashboard-payments__method">{payment.method} - {payment.date}</span>
              </span>
              <span className="nc-dashboard-payments__meta">
                <strong>{payment.amount}</strong>
                <span className={`nc-dashboard-payment-status nc-dashboard-payment-status--${paymentStatusClass(payment.status)}`}>
                  {payment.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="nc-dashboard-empty-note">
          No hay pagos recientes registrados.
        </div>
      )}

      <Link className="nc-dashboard-card-link" to="/billing/payments">
        Administrar pagos
        <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
      </Link>
    </DashboardSectionCard>
  );
}
