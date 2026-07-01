import * as React from "react";
import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Heart,
  HeartPulse,
  Leaf,
  ReceiptText,
  Settings,
  Sparkles,
  UtensilsCrossed,
  UsersRound,
  WalletCards,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { motivationalMessages } from "./motivationalMessages";

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function DashboardHomeIcon({ size = 24, strokeWidth = 1.75, className, ...props }: LucideProps) {
  const iconClassName = className ? `nc-dashboard-home-icon ${className}` : "nc-dashboard-home-icon";

  return (
    <svg
      {...props}
      className={iconClassName}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        className="nc-dashboard-home-icon__solid"
        d="M4.34 10.86 11.2 5.08c.46-.39 1.14-.39 1.6 0l6.86 5.78a.72.72 0 0 1-.93 1.1l-.8-.67v6.98c0 .8-.65 1.45-1.45 1.45H7.52c-.8 0-1.45-.65-1.45-1.45v-6.98l-.8.67a.72.72 0 1 1-.93-1.1Z"
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        stroke="none"
      />
      <path className="nc-dashboard-home-icon__cutout" d="M10.12 19.72v-4.58c0-.62.5-1.12 1.12-1.12h1.52c.62 0 1.12.5 1.12 1.12v4.58h-3.76Z" />
      <path className="nc-dashboard-home-icon__outline" d="M6.25 10.7v7.48c0 .82.67 1.49 1.49 1.49h8.52c.82 0 1.49-.67 1.49-1.49V10.7" />
      <path className="nc-dashboard-home-icon__roof" d="m3.95 11.15 7.36-6.2a1.06 1.06 0 0 1 1.38 0l7.36 6.2" />
      <path className="nc-dashboard-home-icon__door" d="M10.18 19.67v-4.56c0-.43.35-.78.78-.78h2.08c.43 0 .78.35.78.78v4.56" />
    </svg>
  );
}

function DashboardActiveHomeIcon({ size = 24, className, ...props }: LucideProps) {
  const iconClassName = className ? `nc-dashboard-home-active-icon ${className}` : "nc-dashboard-home-active-icon";
  const maskId = `${React.useId().replace(/:/g, "")}-dashboard-home-mask`;

  return (
    <svg
      {...props}
      className={iconClassName}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24" style={{ maskType: "luminance" } as React.CSSProperties}>
        <rect width="24" height="24" fill="#ffffff" stroke="none" />
        <path d="M9.5 19.72V15.1c0-.78.63-1.41 1.41-1.41h2.18c.78 0 1.41.63 1.41 1.41v4.62h-5Z" fill="#000000" stroke="none" />
      </mask>
      <path
        d="M4.34 10.86 11.2 5.08c.46-.39 1.14-.39 1.6 0l6.86 5.78a.72.72 0 0 1-.93 1.1l-.8-.67v6.98c0 .8-.65 1.45-1.45 1.45H7.52c-.8 0-1.45-.65-1.45-1.45v-6.98l-.8.67a.72.72 0 1 1-.93-1.1Z"
        fill="currentColor"
        mask={`url(#${maskId})`}
        stroke="none"
        shapeRendering="geometricPrecision"
      />
    </svg>
  );
}

export const dashboardNavItems = [
  { to: "/", label: "Dashboard", icon: DashboardHomeIcon, end: true },
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
  theme: "ocean" | "aqua" | "blue" | "teal" | "mint";
  decoration: "leaf" | "spark" | "wave" | "pulse";
}

const IMPACT_DRAG_THRESHOLD_PX = 40;
const IMPACT_DRAG_MAX_OFFSET_PX = 96;
const IMPACT_SNAP_DURATION_MS = 140;
const IMPACT_SESSION_STORAGE_KEY = "nutriclinica.dashboard.impactIndex";

const impactSlides: ImpactSlide[] = [
  {
    id: "impacto",
    icon: Heart,
    title: "Tu impacto hoy",
    theme: "ocean",
    decoration: "leaf",
  },
  {
    id: "progreso",
    icon: Sparkles,
    title: "Progreso real",
    theme: "blue",
    decoration: "spark",
  },
  {
    id: "nutricion",
    icon: Leaf,
    title: "Nutrir también es cuidar",
    theme: "teal",
    decoration: "wave",
  },
  {
    id: "bienestar",
    icon: HeartPulse,
    title: "Bienestar diario",
    theme: "mint",
    decoration: "pulse",
  },
];

const IMPACT_MESSAGE_COUNT = motivationalMessages.length;

function normalizeImpactIndex(index: number) {
  return (index + IMPACT_MESSAGE_COUNT) % IMPACT_MESSAGE_COUNT;
}

function getImpactStorageDate(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function getDailyImpactIndex(date = new Date()) {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - startOfYear) / 86_400_000);

  return normalizeImpactIndex(dayOfYear);
}

function getInitialImpactIndex() {
  if (typeof window === "undefined") return getDailyImpactIndex();

  try {
    const storedValue = window.sessionStorage.getItem(IMPACT_SESSION_STORAGE_KEY);
    if (storedValue) {
      const stored = JSON.parse(storedValue) as { date?: string; index?: number };
      if (stored.date === getImpactStorageDate() && Number.isInteger(stored.index)) {
        return normalizeImpactIndex(stored.index ?? 0);
      }
    }
  } catch {
    // Ignore unavailable storage or legacy values and fall back to the daily index.
  }

  return getDailyImpactIndex();
}

function saveImpactIndex(index: number) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      IMPACT_SESSION_STORAGE_KEY,
      JSON.stringify({ date: getImpactStorageDate(), index: normalizeImpactIndex(index) }),
    );
  } catch {
    // Session storage can be unavailable in restricted environments.
  }
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
  const [activeImpactIndex, setActiveImpactIndex] = React.useState(getInitialImpactIndex);
  const [impactDragOffset, setImpactDragOffset] = React.useState(0);
  const [isImpactDragging, setIsImpactDragging] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const pointerStartXRef = React.useRef<number | null>(null);
  const impactSnapTimeoutRef = React.useRef<number | null>(null);
  const activeImpactDotIndex = activeImpactIndex % impactSlides.length;
  const activeImpact = impactSlides[activeImpactDotIndex] ?? impactSlides[0];
  const activeImpactText = motivationalMessages[activeImpactIndex] ?? motivationalMessages[0];
  const ImpactIcon = activeImpact.icon;
  const impactDragProgress = Math.min(1, Math.abs(impactDragOffset) / IMPACT_DRAG_MAX_OFFSET_PX);
  const impactDragStyle = {
    "--nc-impact-drag-x": `${Math.round(impactDragOffset * 0.84)}px`,
    "--nc-impact-card-drag-x": `${Math.round(impactDragOffset * 0.18)}px`,
    "--nc-impact-plant-drag-x": `${Math.round(impactDragOffset * 0.32)}px`,
    "--nc-impact-drag-tilt": `${impactDragOffset * 0.018}deg`,
    "--nc-impact-drag-progress": impactDragProgress,
  } as React.CSSProperties;

  const clearImpactSnapTimeout = () => {
    if (impactSnapTimeoutRef.current === null) return;
    window.clearTimeout(impactSnapTimeoutRef.current);
    impactSnapTimeoutRef.current = null;
  };

  React.useEffect(() => clearImpactSnapTimeout, []);

  React.useEffect(() => {
    saveImpactIndex(activeImpactIndex);
  }, [activeImpactIndex]);

  const showImpactSlide = (index: number) => {
    clearImpactSnapTimeout();
    setImpactDragOffset(0);
    setIsImpactDragging(false);
    setActiveImpactIndex(normalizeImpactIndex(activeImpactIndex - activeImpactDotIndex + index));
  };

  const showPreviousImpactSlide = () => {
    setActiveImpactIndex((index) => normalizeImpactIndex(index - 1));
  };

  const showNextImpactSlide = () => {
    setActiveImpactIndex((index) => normalizeImpactIndex(index + 1));
  };

  const handleImpactPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return;
    if ((event.target as HTMLElement).closest("button")) return;
    clearImpactSnapTimeout();
    pointerStartXRef.current = event.clientX;
    setImpactDragOffset(0);
    setIsImpactDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleImpactPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const startX = pointerStartXRef.current;
    if (startX === null) return;

    const deltaX = event.clientX - startX;
    const limitedOffset = Math.max(-IMPACT_DRAG_MAX_OFFSET_PX, Math.min(IMPACT_DRAG_MAX_OFFSET_PX, deltaX));
    setImpactDragOffset(limitedOffset);
  };

  const handleImpactPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const startX = pointerStartXRef.current;
    pointerStartXRef.current = null;
    setIsImpactDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (startX === null) return;

    const deltaX = event.clientX - startX;
    if (Math.abs(deltaX) < IMPACT_DRAG_THRESHOLD_PX) {
      setImpactDragOffset(0);
      return;
    }

    const movingToPrevious = deltaX > 0;
    const snapOffset = movingToPrevious ? IMPACT_DRAG_MAX_OFFSET_PX : -IMPACT_DRAG_MAX_OFFSET_PX;
    setImpactDragOffset(snapOffset);
    impactSnapTimeoutRef.current = window.setTimeout(() => {
      if (movingToPrevious) showPreviousImpactSlide();
      else showNextImpactSlide();
      setImpactDragOffset(0);
      impactSnapTimeoutRef.current = null;
    }, prefersReducedMotion ? 0 : IMPACT_SNAP_DURATION_MS);
  };

  const handleImpactPointerCancel = (event: React.PointerEvent<HTMLElement>) => {
    pointerStartXRef.current = null;
    setImpactDragOffset(0);
    setIsImpactDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside className="nc-dashboard-sidebar" aria-label="Navegación principal del dashboard">
      <div className="nc-dashboard-sidebar__brand">
        <NavLink to="/" className="nc-dashboard-sidebar__brandLink" aria-label="NutriClinica dashboard">
          <img
            className="nc-dashboard-sidebar__logo"
            src="/assets/icon.png"
            alt=""
            width="40"
            height="40"
          />
          <span className="nc-dashboard-sidebar__brandText" aria-hidden="true">
            <strong>NutriClinica</strong>
            <small>Tu clínica, su bienestar</small>
          </span>
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
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => {
                const isActiveDashboard = item.to === "/" && isActive;

                return (
                  <>
                    <span className="nc-dashboard-sidebar__itemIcon" aria-hidden="true">
                      {isActiveDashboard ? <DashboardActiveHomeIcon size={19} /> : <Icon size={19} strokeWidth={1.75} />}
                    </span>
                    <span className="nc-dashboard-sidebar__itemLabel" aria-hidden={collapsed ? "true" : undefined}>{item.label}</span>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>

      <section
        className={`nc-dashboard-impact nc-dashboard-impact--${activeImpact.theme} nc-dashboard-impact--decor-${activeImpact.decoration}${isImpactDragging ? " nc-dashboard-impact--dragging" : ""}`}
        aria-label="Galería motivacional"
        aria-hidden={collapsed ? "true" : undefined}
        style={impactDragStyle}
        onPointerDown={handleImpactPointerDown}
        onPointerMove={handleImpactPointerMove}
        onPointerUp={handleImpactPointerUp}
        onPointerCancel={handleImpactPointerCancel}
      >
        <div key={`${activeImpact.id}-${activeImpactIndex}`} className="nc-dashboard-impact__content" aria-live={collapsed ? "off" : "polite"}>
          <div className="nc-dashboard-impact__heading">
            <div className="nc-dashboard-impact__icon" aria-hidden="true">
              <ImpactIcon size={18} strokeWidth={1.8} />
            </div>
            <h2 className="nc-dashboard-impact__title">{activeImpact.title}</h2>
          </div>
          <p className="nc-dashboard-impact__text">{activeImpactText}</p>
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
              className={`nc-dashboard-impact__dot${index === activeImpactDotIndex ? " nc-dashboard-impact__dot--active" : ""}`}
              onClick={() => showImpactSlide(index)}
              aria-label={`Mostrar frase: ${slide.title}`}
              aria-current={index === activeImpactDotIndex ? "true" : undefined}
              tabIndex={collapsed ? -1 : undefined}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        className="nc-dashboard-sidebar__collapse"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
        title={collapsed ? "Expandir sidebar" : undefined}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        <span className="nc-dashboard-sidebar__collapseLabel" aria-hidden={collapsed ? "true" : undefined}>Contraer</span>
      </button>
    </aside>
  );
}
