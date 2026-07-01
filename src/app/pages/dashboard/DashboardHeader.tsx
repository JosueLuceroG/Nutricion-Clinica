import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarPlus,
  ChevronRight,
  Inbox,
  LogOut,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  User,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { useAuthStore } from "@store/authStore";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { useNotificationStore } from "@store/notificationStore";

type PeriodOfDay = "morning" | "afternoon" | "night";

interface DashboardHeaderProps {
  onCustomizeKpis?: () => void;
}

function getFirstName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Administrador";
  return trimmed.split(/\s+/)[0] ?? "Administrador";
}

function getPeriodOfDay(date = new Date()): PeriodOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

function getGreetingForPeriod(periodOfDay: PeriodOfDay): string {
  if (periodOfDay === "morning") return "Buen día";
  if (periodOfDay === "afternoon") return "Buena tarde";
  return "Buena noche";
}

function getGreetingEmoji(periodOfDay: PeriodOfDay, date = new Date()): string {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - startOfYear) / 86_400_000);
  const emojiByPeriod: Record<PeriodOfDay, string[]> = {
    morning: ["☀️", "🌿", "🍎", "🥗", "🩺", "🤝", "✨"],
    afternoon: ["🌤️", "💙", "🥗", "🍊", "🩺", "🌱", "✨"],
    night: ["🌙", "🍵", "💙", "🫶", "🩺", "🌿", "✨"],
  };
  const periodOffset: Record<PeriodOfDay, number> = {
    morning: 0,
    afternoon: 1,
    night: 2,
  };
  const emojis = emojiByPeriod[periodOfDay];
  const index = (dayOfYear + periodOffset[periodOfDay]) % emojis.length;

  return emojis[index] ?? "👋";
}

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardHeader({ onCustomizeKpis }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = React.useState(false);
  const openCommand = useCommandPaletteStore((state) => state.setOpen);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const unread = useNotificationStore((state) => state.unread);
  const displayName = user?.nombreCompleto?.trim() || "Administrador";
  const firstName = getFirstName(displayName);
  const [headerDate, setHeaderDate] = React.useState(() => new Date());
  const periodOfDay = getPeriodOfDay(headerDate);
  const greeting = getGreetingForPeriod(periodOfDay);
  const greetingEmoji = getGreetingEmoji(periodOfDay, headerDate);
  const initials = getInitials(displayName);
  const notificationCount = unread > 0 ? unread : 0;
  const hasUnreadNotifications = notificationCount > 0;
  const userRole = user?.rol ?? "admin";
  const userEmail = user?.email ?? "";

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setHeaderDate(new Date()), 15 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (!notificationsOpen && !avatarMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        notificationsOpen &&
        !target.closest(".nc-dashboard-notification-menu") &&
        !target.closest(".nc-dashboard-header__notification")
      ) {
        setNotificationsOpen(false);
      }

      if (
        avatarMenuOpen &&
        !target.closest(".nc-dashboard-avatar-menu") &&
        !target.closest(".nc-dashboard-header__avatar")
      ) {
        setAvatarMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setNotificationsOpen(false);
      setAvatarMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [avatarMenuOpen, notificationsOpen]);

  return (
    <header className="nc-dashboard-header">
      <div className="nc-dashboard-header__inner">
        <section className="nc-dashboard-header__intro" aria-label="Resumen del día">
          <h1 className="nc-dashboard-header__title">
            <span className="nc-dashboard-header__greetingText">{greeting}, {firstName}</span>
            <span className="nc-dashboard-header__greetingEmoji" aria-hidden="true">{greetingEmoji}</span>
          </h1>
          <p className="nc-dashboard-header__subtitle">Aquí tienes el resumen de tu clínica hoy.</p>
        </section>

        <div className="nc-dashboard-header__searchSlot">
          <button
            type="button"
            className="nc-dashboard-search"
            onClick={() => openCommand(true)}
            aria-label="Buscar pacientes, consultas, alimentos"
          >
            <Search className="nc-dashboard-search__icon" size={19} strokeWidth={2} aria-hidden="true" />
            <span className="nc-dashboard-search__placeholder">Buscar pacientes, consultas, alimentos...</span>
            <kbd className="nc-dashboard-search__kbd">Ctrl K</kbd>
          </button>
        </div>

        <div className="nc-dashboard-header__actions">
          <div className="nc-dashboard-header__ctaGroup" aria-label="Acciones rápidas del dashboard">
            <button type="button" className="nc-dashboard-button nc-dashboard-button--outline" onClick={onCustomizeKpis}>
              <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
              <span>Personalizar KPIs</span>
            </button>
            <button
              type="button"
              className="nc-dashboard-button nc-dashboard-button--soft"
              onClick={() => navigate("/consultas/nueva")}
            >
              <CalendarPlus size={17} strokeWidth={2} aria-hidden="true" />
              <span>Nueva consulta</span>
            </button>
            <button
              type="button"
              className="nc-dashboard-button nc-dashboard-button--primary"
              onClick={() => navigate("/pacientes/nuevo")}
            >
              <Plus size={18} strokeWidth={2.2} aria-hidden="true" />
              <span>Agregar paciente</span>
            </button>
          </div>

          <div className="nc-dashboard-header__utilityGroup" aria-label="Notificaciones y cuenta">
            <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="nc-dashboard-header__notification"
                  aria-label={`Notificaciones (${notificationCount})`}
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={19} strokeWidth={1.55} aria-hidden="true" />
                  {notificationCount > 0 && <span className="nc-dashboard-header__badge">{notificationCount}</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="nc-dashboard-notification-menu">
                <DropdownMenuLabel className="nc-dashboard-menu__label">
                  <span>Notificaciones</span>
                  {hasUnreadNotifications && <strong>{notificationCount > 99 ? "99+" : notificationCount}</strong>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="nc-dashboard-menu__separator" />
                {hasUnreadNotifications ? (
                  <div className="nc-dashboard-notification-menu__item" role="status">
                    <span className="nc-dashboard-notification-menu__icon" aria-hidden="true">
                      <Bell size={16} strokeWidth={2} />
                    </span>
                    <span>
                      <strong>Notificaciones pendientes</strong>
                      <small>Tienes {notificationCount} aviso{notificationCount === 1 ? "" : "s"} por revisar.</small>
                    </span>
                  </div>
                ) : (
                  <div className="nc-dashboard-notification-menu__empty" role="status">
                    <span className="nc-dashboard-notification-menu__emptyIcon" aria-hidden="true">
                      <Inbox size={18} strokeWidth={1.9} />
                    </span>
                    <strong>No hay notificaciones nuevas</strong>
                    <small>Te avisaremos aquí cuando haya algo importante.</small>
                  </div>
                )}
                <DropdownMenuSeparator className="nc-dashboard-menu__separator" />
                <DropdownMenuItem className="nc-dashboard-menu__action" onClick={() => navigate("/notificaciones")}>
                  <span>Ver todas</span>
                  <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="nc-dashboard-header__avatar"
                  aria-label="Abrir menú de usuario"
                  aria-expanded={avatarMenuOpen}
                >
                  <span className="nc-dashboard-header__avatarFallback">
                    {initials || <UserPlus size={18} aria-hidden="true" />}
                  </span>
                  <span className="nc-dashboard-header__avatarStatus" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="nc-dashboard-avatar-menu">
                <DropdownMenuLabel className="nc-dashboard-avatar-menu__profile">
                  <span className="nc-dashboard-avatar-menu__initials" aria-hidden="true">
                    {initials || "AD"}
                  </span>
                  <span className="nc-dashboard-avatar-menu__identity">
                    <strong>{displayName}</strong>
                    <small>{userEmail || userRole}</small>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="nc-dashboard-menu__separator" />
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/perfil")}>
                  <User size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/configuracion")}>
                  <Settings size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Configuración</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="nc-dashboard-menu__separator" />
                <DropdownMenuItem
                  className="nc-dashboard-avatar-menu__item nc-dashboard-avatar-menu__item--danger"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut size={15} strokeWidth={2} aria-hidden="true" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </div>
    </header>
  );
}
