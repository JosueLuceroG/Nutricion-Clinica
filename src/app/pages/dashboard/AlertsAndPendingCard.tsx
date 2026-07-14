import { Link } from "react-router-dom";
import { ArrowRight, Bell, ChevronRight } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { DashboardAlertItem } from "./dashboardMockData";

interface AlertsAndPendingCardProps {
  alerts: DashboardAlertItem[];
  title?: string;
}

export function AlertsAndPendingCard({ alerts, title = "Alertas y pendientes" }: AlertsAndPendingCardProps) {
  return (
    <DashboardSectionCard
      title={title}
      icon={<Bell size={20} strokeWidth={1.9} />}
      className="nc-dashboard-section-card--alerts"
    >
      {alerts.length > 0 ? (
        <ul className="nc-dashboard-alerts" aria-label="Alertas y pendientes">
          {alerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <li key={alert.title} className="nc-dashboard-alerts__item">
                <span className={`nc-dashboard-alerts__icon nc-dashboard-alerts__icon--${alert.tone}`} aria-hidden="true">
                  <Icon size={22} strokeWidth={1.9} />
                </span>
                <span className="nc-dashboard-alerts__body">
                  <span className="nc-dashboard-alerts__title">{alert.title}</span>
                  <span className="nc-dashboard-alerts__detail">{alert.detail}</span>
                </span>
                {alert.actionTo ? (
                  <Link
                    className={`nc-dashboard-alerts__badge nc-dashboard-alerts__badge--${alert.tone} nc-dashboard-alerts__action`}
                    to={alert.actionTo}
                    aria-label={`Ver detalle: ${alert.title}`}
                  >
                    <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className={`nc-dashboard-alerts__badge nc-dashboard-alerts__badge--${alert.tone}`}>
                    {alert.count}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="nc-dashboard-empty-note">
          No hay alertas disponibles con los datos actuales.
        </div>
      )}

      <Link className="nc-dashboard-card-link nc-dashboard-card-link--alerts" to="/notificaciones">
        Ver todas
        <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
      </Link>
    </DashboardSectionCard>
  );
}
