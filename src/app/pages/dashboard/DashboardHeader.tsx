import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarPlus,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
} from "lucide-react";
import { useAuthStore } from "@store/authStore";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { useNotificationStore } from "@store/notificationStore";

interface DashboardHeaderProps {
  onCustomizeKpis?: () => void;
}

function getFirstName(fullName?: string | null): string {
  const trimmed = fullName?.trim();
  if (!trimmed) return "Admin";
  return trimmed.split(/\s+/)[0] ?? "Admin";
}

function getGreetingForHour(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
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
  const openCommand = useCommandPaletteStore((state) => state.setOpen);
  const user = useAuthStore((state) => state.user);
  const unread = useNotificationStore((state) => state.unread);
  const displayName = user?.nombreCompleto?.trim() || "Admin";
  const firstName = getFirstName(displayName);
  const greeting = getGreetingForHour();
  const initials = getInitials(displayName);
  const notificationCount = unread > 0 ? unread : 3;

  return (
    <header className="nc-dashboard-header">
      <div className="nc-dashboard-header__inner">
        <div className="nc-dashboard-header__intro">
          <h1 className="nc-dashboard-header__title">{greeting}, {firstName} <span aria-hidden="true">👋</span></h1>
          <p className="nc-dashboard-header__subtitle">Aquí tienes el resumen de tu clínica hoy.</p>
          <button type="button" className="nc-dashboard-header__metricsAction" onClick={onCustomizeKpis}>
            <SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" />
            <span>Reordenar / ocultar métricas</span>
          </button>
        </div>

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

        <div className="nc-dashboard-header__actions">
          <button type="button" className="nc-dashboard-button nc-dashboard-button--outline" onClick={onCustomizeKpis}>
            <SlidersHorizontal size={17} strokeWidth={2} aria-hidden="true" />
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
          <button
            type="button"
            className="nc-dashboard-header__notification"
            onClick={() => navigate("/notificaciones")}
            aria-label={`Notificaciones (${notificationCount})`}
          >
            <Bell size={21} strokeWidth={1.9} aria-hidden="true" />
            <span className="nc-dashboard-header__badge">{notificationCount}</span>
          </button>
          <button
            type="button"
            className="nc-dashboard-header__avatar"
            onClick={() => navigate("/perfil")}
            aria-label="Abrir perfil"
          >
            <span className="nc-dashboard-header__avatarFallback">
              {initials || <UserPlus size={18} aria-hidden="true" />}
            </span>
            <span className="nc-dashboard-header__avatarStatus" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
