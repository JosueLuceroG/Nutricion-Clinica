import { Link } from "react-router-dom";
import type { DashboardKpiItem } from "./dashboardMockData";

interface KpiCardProps {
  item: DashboardKpiItem;
}

export function KpiCard({ item }: KpiCardProps) {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      className={`nc-dashboard-kpi-card nc-dashboard-kpi-card--${item.tone}`}
      aria-label={`${item.label}: ${item.value}`}
    >
      <span className="nc-dashboard-kpi-card__icon" aria-hidden="true">
        <Icon size={27} strokeWidth={1.85} />
      </span>

      <span className="nc-dashboard-kpi-card__body">
        <span className="nc-dashboard-kpi-card__label">{item.label}</span>
        <span className="nc-dashboard-kpi-card__valueRow">
          <span className="nc-dashboard-kpi-card__value">{item.value}</span>
          {item.trend && <span className="nc-dashboard-kpi-card__trend">{item.trend}</span>}
        </span>
        <span className="nc-dashboard-kpi-card__hint">{item.hint}</span>
      </span>
    </Link>
  );
}
