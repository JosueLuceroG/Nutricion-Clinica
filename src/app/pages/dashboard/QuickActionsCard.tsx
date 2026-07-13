import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { DashboardSectionCard } from "./DashboardSectionCard";
import type { QuickActionItem } from "./dashboardMockData";

interface QuickActionsCardProps {
  actions: QuickActionItem[];
}

export function QuickActionsCard({ actions }: QuickActionsCardProps) {
  return (
    <DashboardSectionCard
      title="Acciones rápidas"
      icon={<Sparkles size={20} strokeWidth={1.9} />}
      className="nc-dashboard-section-card--actions"
    >
      <div className="nc-dashboard-quick-actions" aria-label="Acciones rápidas">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} className="nc-dashboard-quick-actions__item" to={action.to}>
              <span className={`nc-dashboard-quick-actions__icon nc-dashboard-quick-actions__icon--${action.tone}`} aria-hidden="true">
                <Icon size={24} strokeWidth={1.9} />
              </span>
              <span className="nc-dashboard-quick-actions__body">
                <strong>{action.label}</strong>
              </span>
            </Link>
          );
        })}
      </div>
    </DashboardSectionCard>
  );
}
