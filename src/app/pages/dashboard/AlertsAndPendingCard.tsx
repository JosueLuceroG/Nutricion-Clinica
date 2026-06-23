import { Link } from "react-router-dom";
import { ArrowRight, Bell } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { DashboardAlertItem } from "./dashboardMockData";

interface AlertsAndPendingCardProps {
  alerts: DashboardAlertItem[];
}

export function AlertsAndPendingCard({ alerts }: AlertsAndPendingCardProps) {
  return (
    <DashboardSectionCard
      title="Alertas y pendientes"
      icon={<Bell size={20} strokeWidth={1.9} />}
      className="nc-dashboard-section-card--alerts"
    >
      <ul className="nc-dashboard-alerts" aria-label="Alertas y pendientes">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          const isArrow = alert.count === "›";
          return (
            <li key={alert.title} className="nc-dashboard-alerts__item">
              <span className={`nc-dashboard-alerts__icon nc-dashboard-alerts__icon--${alert.tone}`} aria-hidden="true">
                <Icon size={22} strokeWidth={1.9} />
              </span>
              <span className="nc-dashboard-alerts__body">
                <span className="nc-dashboard-alerts__title">{alert.title}</span>
                <span className="nc-dashboard-alerts__detail">{alert.detail}</span>
              </span>
              <span className={`nc-dashboard-alerts__badge nc-dashboard-alerts__badge--${alert.tone}${isArrow ? " nc-dashboard-alerts__badge--arrow" : ""}`}>
                {alert.count}
              </span>
            </li>
          );
        })}
      </ul>

      <Link className="nc-dashboard-card-link nc-dashboard-card-link--alerts" to="/notificaciones">
        Ver todas
        <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
      </Link>
    </DashboardSectionCard>
  );
}
