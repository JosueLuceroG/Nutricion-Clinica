import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { UpcomingConsultationItem } from "./dashboardMockData";

interface UpcomingConsultationsCardProps {
  items: UpcomingConsultationItem[];
  title?: string;
}

export function UpcomingConsultationsCard({ items, title = "Próximas consultas" }: UpcomingConsultationsCardProps) {
  return (
    <DashboardSectionCard
      title={title}
      icon={<CalendarDays size={20} strokeWidth={1.9} />}
      action={
        <Link className="nc-dashboard-card-action" to="/agenda">
          Ver agenda
        </Link>
      }
      className="nc-dashboard-section-card--consultations"
    >
      {items.length > 0 ? (
        <ul className="nc-dashboard-consultations" aria-label="Próximas consultas">
          {items.map((item) => (
            <li key={`${item.time}-${item.patient}`} className="nc-dashboard-consultations__item">
              <time className="nc-dashboard-consultations__time">{item.time}</time>
              <span className={`nc-dashboard-consultations__avatar nc-dashboard-consultations__avatar--${item.avatarTone}`}>
                {item.avatar}
              </span>
              <span className="nc-dashboard-consultations__body">
                <span className="nc-dashboard-consultations__name">{item.patient}</span>
                <span className="nc-dashboard-consultations__type">{item.type}</span>
              </span>
              <span
                className={`nc-dashboard-status-pill nc-dashboard-status-pill--${item.status === "Confirmada" ? "confirmed" : "pending"}`}
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="nc-dashboard-empty-note">
          No hay consultas proximas agendadas.
        </div>
      )}

      <Link className="nc-dashboard-card-link" to="/consultas">
        Ver todas las consultas
        <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
      </Link>
    </DashboardSectionCard>
  );
}
