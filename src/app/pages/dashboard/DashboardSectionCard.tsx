import type { ReactNode } from "react";

interface DashboardSectionCardProps {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSectionCard({
  title,
  icon,
  action,
  children,
  className = "",
}: DashboardSectionCardProps) {
  return (
    <article className={`nc-dashboard-section-card ${className}`.trim()}>
      <header className="nc-dashboard-section-card__header">
        <h2 className="nc-dashboard-section-card__title">
          <span className="nc-dashboard-section-card__titleIcon" aria-hidden="true">
            {icon}
          </span>
          <span>{title}</span>
        </h2>
        {action && <div className="nc-dashboard-section-card__action">{action}</div>}
      </header>
      {children}
    </article>
  );
}
