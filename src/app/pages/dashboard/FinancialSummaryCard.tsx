import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { FinancialSummaryData } from "./dashboardMockData";

interface FinancialSummaryCardProps {
  summary: FinancialSummaryData;
}

function sparklinePaths(values: number[]): { line: string; area: string } {
  const normalized = values.length > 0 ? values : [0, 0];
  const max = Math.max(1, ...normalized);
  const step = 216 / Math.max(1, normalized.length - 1);
  const points = normalized.map((value, index) => {
    const x = 2 + index * step;
    const y = 48 - (value / max) * 36;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${points.join(" L")}`;
  return { line, area: `${line} L218 58 L2 58 Z` };
}

export function FinancialSummaryCard({ summary }: FinancialSummaryCardProps) {
  const paid = summary.items[0];
  const pending = summary.items[1];
  const collectionRate = Math.max(0, Math.min(Number.parseFloat(summary.collectionRate) || 0, 100));
  const trendDown = summary.trend.includes("↓");
  const sparkline = sparklinePaths(summary.sparkline);

  return (
    <DashboardSectionCard
      title="Resumen financiero"
      icon={<CircleDollarSign size={20} strokeWidth={1.9} />}
      action={
        <Link className="nc-dashboard-card-action" to="/billing/report">
          Ver detalle financiero
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </Link>
      }
      className="nc-dashboard-section-card--financial"
    >
      <div className="nc-dashboard-financial-overview">
        <section className="nc-dashboard-financial-income" aria-label="Ingresos del mes">
          <span>Ingresos del mes</span>
          <strong>{paid?.value ?? "$0.00"}</strong>
          <small className={trendDown ? "nc-dashboard-financial-trend--down" : undefined}>{summary.trend}</small>
          <svg viewBox="0 0 220 58" role="img" aria-label="Tendencia de ingresos del mes">
            <defs>
              <linearGradient id="ncFinancialArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c77a" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#22c77a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={sparkline.area} fill="url(#ncFinancialArea)" />
            <path d={sparkline.line} fill="none" stroke="#22c77a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </section>

        <section className="nc-dashboard-financial-collection" aria-label="Cobro del mes">
          <span className="nc-dashboard-financial-collection__title">Cobro del mes</span>
          <div className="nc-dashboard-financial-collection__body">
            <div className="nc-dashboard-financial-donut" style={{ "--nc-collection-rate": `${collectionRate * 3.6}deg` } as CSSProperties}>
              <strong>{Math.round(collectionRate)}%</strong>
            </div>
            <dl className="nc-dashboard-financial-legend">
              <div>
                <dt><i className="nc-dashboard-financial-legend__dot nc-dashboard-financial-legend__dot--paid" />Cobrado</dt>
                <dd>{paid?.value ?? "$0.00"}</dd>
              </div>
              <div>
                <dt><i className="nc-dashboard-financial-legend__dot nc-dashboard-financial-legend__dot--pending" />Pendiente</dt>
                <dd>{pending?.value ?? "$0.00"}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </DashboardSectionCard>
  );
}
