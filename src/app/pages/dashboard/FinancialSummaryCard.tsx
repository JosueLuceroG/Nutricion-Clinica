import { Link } from "react-router-dom";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { FinancialSummaryData } from "./dashboardMockData";

interface FinancialSummaryCardProps {
  summary: FinancialSummaryData;
}

function progressWidth(value: number) {
  return `${Math.max(0, Math.min(value, 100))}%`;
}

export function FinancialSummaryCard({ summary }: FinancialSummaryCardProps) {
  return (
    <DashboardSectionCard
      title="Resumen financiero"
      icon={<CircleDollarSign size={20} strokeWidth={1.9} />}
      action={
        <Link className="nc-dashboard-card-action" to="/billing/report">
          Ver reporte
        </Link>
      }
      className="nc-dashboard-section-card--financial"
    >
      <div className="nc-dashboard-financial-hero">
        <span className="nc-dashboard-financial-hero__label">Ingresos proyectados</span>
        <div className="nc-dashboard-financial-hero__row">
          <strong>{summary.total}</strong>
          <span>{summary.trend}</span>
        </div>
        <div className="nc-dashboard-financial-meter" aria-label={summary.objective}>
          <span style={{ width: summary.collectionRate }} />
        </div>
        <small>{summary.objective}</small>
      </div>

      <ul className="nc-dashboard-financial-list" aria-label="Detalle financiero">
        {summary.items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="nc-dashboard-financial-list__item">
              <span className={`nc-dashboard-financial-list__icon nc-dashboard-financial-list__icon--${item.tone}`} aria-hidden="true">
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <span className="nc-dashboard-financial-list__body">
                <span className="nc-dashboard-financial-list__topline">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </span>
                <span className="nc-dashboard-financial-list__detail">{item.detail}</span>
                <span className="nc-dashboard-financial-list__track" aria-hidden="true">
                  <span className={`nc-dashboard-financial-list__fill nc-dashboard-financial-list__fill--${item.tone}`} style={{ width: progressWidth(item.percent) }} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <Link className="nc-dashboard-card-link" to="/billing">
        Abrir facturación
        <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
      </Link>
    </DashboardSectionCard>
  );
}
