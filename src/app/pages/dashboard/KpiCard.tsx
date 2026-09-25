import { Link } from "react-router-dom";
import type { DashboardKpiItem } from "./dashboardMockData";

interface KpiCardProps {
  item: DashboardKpiItem;
}

export function KpiCard({ item }: KpiCardProps) {
  const Icon = item.icon;
  const visualization = item.visualization ?? "largeNumber";
  const progress = Math.max(0, Math.min(100, item.progress ?? 0));
  const content = (
    <>
      <span className="nc-dashboard-kpi-card__icon" aria-hidden="true">
        <Icon size={27} strokeWidth={1.85} />
      </span>

      <span className="nc-dashboard-kpi-card__body">
        <span className="nc-dashboard-kpi-card__label">{item.label}</span>
        {visualization === "percentage" ? (
          <span className="nc-dashboard-kpi-card__percentage" style={{ "--nc-kpi-percentage": `${progress * 3.6}deg` } as React.CSSProperties}>
            <strong>{item.value}</strong>
          </span>
        ) : (
          <span className="nc-dashboard-kpi-card__valueRow">
            <span className="nc-dashboard-kpi-card__value">{item.value}</span>
            {item.trend && (
              <span className={`nc-dashboard-kpi-card__trend nc-dashboard-kpi-card__trend--${item.trendTone ?? "up"}`}>
                {item.trend}
              </span>
            )}
          </span>
        )}
        <span className="nc-dashboard-kpi-card__hint">{item.hint}</span>
        {visualization === "progress" && typeof item.progress === "number" && (
          <span
            className="nc-dashboard-kpi-card__progress"
            role="progressbar"
            aria-label={`Progreso: ${Math.round(item.progress)}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.max(0, Math.min(100, item.progress)))}
          >
            <i style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} className={`nc-dashboard-kpi-card nc-dashboard-kpi-card--${item.tone}`} data-visualization={visualization} aria-label={`${item.label}: ${item.value}`}>
        {content}
      </Link>
    );
  }

  return (
    <article className={`nc-dashboard-kpi-card nc-dashboard-kpi-card--${item.tone}`} data-visualization={visualization} aria-label={`${item.label}: ${item.value}`}>
      {content}
    </article>
  );
}
