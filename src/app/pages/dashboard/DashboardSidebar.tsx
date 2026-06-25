import * as React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Heart,
  HeartPulse,
  House,
  Leaf,
  ReceiptText,
  Settings,
  Sparkles,
  UtensilsCrossed,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export const dashboardNavItems = [
  { to: "/", label: "Dashboard", icon: House, end: true },
  { to: "/pacientes", label: "Pacientes", icon: UsersRound },
  { to: "/consultas", label: "Consultas", icon: ClipboardList },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/planes", label: "Planes", icon: ReceiptText },
  { to: "/smae", label: "Alimentos", icon: UtensilsCrossed },
  { to: "/billing", label: "Facturación", icon: WalletCards },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

interface ImpactSlide {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  theme: "ocean" | "aqua" | "blue" | "teal" | "mint";
  decoration: "leaf" | "spark" | "wave" | "pulse";
}

const impactSlides: ImpactSlide[] = [
  {
    id: "impacto",
    icon: Heart,
    title: "Tu impacto hoy",
    text: "Cada consulta es un paso hacia una vida más saludable.",
    theme: "ocean",
    decoration: "leaf",
  },
  {
    id: "progreso",
    icon: Sparkles,
    title: "Progreso real",
    text: "La constancia pesa más que la perfección.",
    theme: "blue",
    decoration: "spark",
  },
  {
    id: "nutricion",
    icon: Leaf,
    title: "Nutrir también es cuidar",
    text: "Cada plan puede acercar a alguien a sentirse mejor.",
    theme: "teal",
    decoration: "wave",
  },
  {
    id: "bienestar",
    icon: HeartPulse,
    title: "Bienestar diario",
    text: "Una mejor decisión al día también cuenta.",
    theme: "mint",
    decoration: "pulse",
  },
];

function getDailyImpactIndex(date = new Date()) {
  const day = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);
  return day % impactSlides.length;
}

function msUntilNextDay(date = new Date()) {
  const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(60_000, nextDay.getTime() - date.getTime());
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

export function DashboardSidebar({ collapsed, onToggleCollapsed }: DashboardSidebarProps) {
  const [activeImpactIndex, setActiveImpactIndex] = React.useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const pointerStartXRef = React.useRef<number | null>(null);
  const activeImpact = impactSlides[activeImpactIndex] ?? impactSlides[0];
  const ImpactIcon = activeImpact.icon;

  React.useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleDailySlide = () => {
      timeoutId = window.setTimeout(() => {
        setActiveImpactIndex(getDailyImpactIndex());
        scheduleDailySlide();
      }, msUntilNextDay());
    };

    scheduleDailySlide();

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  React.useEffect(() => {
    if (prefersReducedMotion) return;

    const intervalId = window.setInterval(() => {
      setActiveImpactIndex((index) => (index + 1) % impactSlides.length);
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  const showImpactSlide = (index: number) => {
    setActiveImpactIndex((index + impactSlides.length) % impactSlides.length);
  };

  const showPreviousImpactSlide = () => {
    setActiveImpactIndex((index) => (index - 1 + impactSlides.length) % impactSlides.length);
  };

  const showNextImpactSlide = () => {
    setActiveImpactIndex((index) => (index + 1) % impactSlides.length);
  };

  const handleImpactPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return;
    if ((event.target as HTMLElement).closest("button")) return;
    pointerStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleImpactPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const startX = pointerStartXRef.current;
    pointerStartXRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (startX === null) return;

    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < 36) return;
    if (deltaX > 0) showPreviousImpactSlide();
    else showNextImpactSlide();
  };

  return (
    <aside className="nc-dashboard-sidebar" aria-label="Navegación principal del dashboard">
      <div className="nc-dashboard-sidebar__brand">
        <NavLink to="/" className="nc-dashboard-sidebar__brandLink" aria-label="NutriClinica dashboard">
          <img
            className="nc-dashboard-sidebar__logo"
            src="/assets/logo-system.png"
            alt="NutriClinica"
            width="188"
            height="51"
          />
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
                <Icon size={19} strokeWidth={1.75} />
              </span>
              {!collapsed && <span className="nc-dashboard-sidebar__itemLabel">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <section
          className={`nc-dashboard-impact nc-dashboard-impact--${activeImpact.theme} nc-dashboard-impact--decor-${activeImpact.decoration}`}
          aria-label="Galería motivacional"
          onPointerDown={handleImpactPointerDown}
          onPointerUp={handleImpactPointerUp}
          onPointerCancel={() => {
            pointerStartXRef.current = null;
          }}
        >
          <div key={activeImpact.id} className="nc-dashboard-impact__content" aria-live="polite">
            <div className="nc-dashboard-impact__heading">
              <div className="nc-dashboard-impact__icon" aria-hidden="true">
                <ImpactIcon size={18} strokeWidth={1.8} />
              </div>
              <h2 className="nc-dashboard-impact__title">{activeImpact.title}</h2>
            </div>
            <p className="nc-dashboard-impact__text">{activeImpact.text}</p>
          </div>
          <div className="nc-dashboard-impact__plant" aria-hidden="true">
            <svg viewBox="0 0 120 168" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path className="nc-dashboard-impact__stem" d="M82 166C84 133 93 91 112 50" />
              <path className="nc-dashboard-impact__stem" d="M42 166C50 130 40 99 21 70" />
              <path className="nc-dashboard-impact__stem nc-dashboard-impact__stem--thin" d="M63 166C65 130 58 105 43 78" />
              <path className="nc-dashboard-impact__leaf" d="M86 97C103 89 116 100 114 119C96 126 83 115 86 97Z" />
              <path className="nc-dashboard-impact__leaf" d="M99 48C114 45 123 57 116 72C100 75 92 63 99 48Z" />
              <path className="nc-dashboard-impact__leaf" d="M53 95C70 95 80 109 75 126C58 127 48 112 53 95Z" />
              <path className="nc-dashboard-impact__leaf" d="M22 69C38 68 48 81 43 97C27 99 18 84 22 69Z" />
              <path className="nc-dashboard-impact__leaf" d="M63 124C79 125 88 139 82 154C66 154 57 139 63 124Z" />
              <path className="nc-dashboard-impact__leaf" d="M42 116C55 113 65 122 64 136C50 140 40 130 42 116Z" />
            </svg>
          </div>
          <div className="nc-dashboard-impact__dots" aria-label="Frases motivacionales">
            {impactSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`nc-dashboard-impact__dot${index === activeImpactIndex ? " nc-dashboard-impact__dot--active" : ""}`}
                onClick={() => showImpactSlide(index)}
                aria-label={`Mostrar frase: ${slide.title}`}
                aria-current={index === activeImpactIndex ? "true" : undefined}
              />
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        className="nc-dashboard-sidebar__collapse"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
        title={collapsed ? "Expandir sidebar" : undefined}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Contraer</span>}
      </button>
    </aside>
  );
}
