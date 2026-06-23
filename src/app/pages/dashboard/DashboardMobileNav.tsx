import { NavLink } from "react-router-dom";
import { dashboardNavItems } from "./DashboardSidebar";

export function DashboardMobileNav() {
  return (
    <nav className="nc-dashboard-mobile-nav" aria-label="Navegacion movil del dashboard">
      <div className="nc-dashboard-mobile-nav__scroller">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nc-dashboard-mobile-nav__item${isActive ? " nc-dashboard-mobile-nav__item--active" : ""}`
              }
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
