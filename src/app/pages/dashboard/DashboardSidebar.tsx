import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Heart,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UtensilsCrossed,
  UsersRound,
  WalletCards,
} from "lucide-react";

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export const dashboardNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pacientes", label: "Pacientes", icon: UsersRound },
  { to: "/consultas", label: "Consultas", icon: ClipboardList },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/planes", label: "Planes", icon: ReceiptText },
  { to: "/smae", label: "Alimentos", icon: UtensilsCrossed },
  { to: "/billing", label: "Facturación", icon: WalletCards },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export function DashboardSidebar({ collapsed, onToggleCollapsed }: DashboardSidebarProps) {
  return (
    <aside className="nc-dashboard-sidebar" aria-label="Navegación principal del dashboard">
      <div className="nc-dashboard-sidebar__brand">
        <NavLink to="/" className="nc-dashboard-sidebar__brandLink" aria-label="NutriClinica dashboard">
          <img
            className="nc-dashboard-sidebar__logo"
            src="/assets/logo-system.png"
            alt="NutriClinica"
            width="46"
            height="46"
          />
          {!collapsed && (
            <span className="nc-dashboard-sidebar__brandText">
              <span className="nc-dashboard-sidebar__brandName">NutriClinica</span>
              <span className="nc-dashboard-sidebar__brandSub">Tu clínica, su bienestar</span>
            </span>
          )}
        </NavLink>
      </div>

      <nav className="nc-dashboard-sidebar__nav" aria-label="Secciones del dashboard">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nc-dashboard-sidebar__item${isActive ? " nc-dashboard-sidebar__item--active" : ""}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="nc-dashboard-sidebar__itemIcon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.9} />
              </span>
              {!collapsed && <span className="nc-dashboard-sidebar__itemLabel">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <section className="nc-dashboard-impact" aria-label="Tu impacto hoy">
          <div className="nc-dashboard-impact__icon" aria-hidden="true">
            <Heart size={22} strokeWidth={1.9} />
          </div>
          <h2 className="nc-dashboard-impact__title">Tu impacto hoy</h2>
          <p className="nc-dashboard-impact__text">
            Cada consulta es un paso hacia una vida más saludable.
          </p>
          <div className="nc-dashboard-impact__plant" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="nc-dashboard-impact__dots" aria-hidden="true">
            <span className="nc-dashboard-impact__dot nc-dashboard-impact__dot--active" />
            <span className="nc-dashboard-impact__dot" />
            <span className="nc-dashboard-impact__dot" />
          </div>
        </section>
      )}

      <button
        type="button"
        className="nc-dashboard-sidebar__collapse"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        {!collapsed && <span>Contraer</span>}
      </button>
    </aside>
  );
}
