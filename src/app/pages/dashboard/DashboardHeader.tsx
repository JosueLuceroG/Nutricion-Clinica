import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  BarChart3,
  Bell,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  LogOut,
  Plus,
  Search,
  Settings,
  Star,
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
import {
  useNotificationStore,
  type DashboardNotification,
  type NotificationAction,
  type NotificationTab,
} from "@store/notificationStore";
import { getGlobalSearchShortcutLabel } from "@app/layout/globalSearchEngine";
import { DashboardQuickAccessButton } from "@modules/dashboard-quick-access/ui";

type PeriodOfDay = "morning" | "afternoon" | "night";

interface NotificationDragState {
  id: string;
  startX: number;
  currentX: number;
  width: number;
}

declare global {
  interface Window {
    resetNutriClinicaNotificationMockData?: () => void;
  }
}

interface DashboardHeaderProps {
  onCustomizeKpis?: () => void;
  dashboardEditing?: boolean;
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

const GREETING_EMOJI_STORAGE_KEY = "nutriclinica.dashboard.greetingEmoji";
const NOTIFICATION_SWIPE_REVEAL_WIDTH = 92;
const NOTIFICATION_SWIPE_THRESHOLD = 72;

const greetingEmojisByPeriod: Record<PeriodOfDay, string[]> = {
  morning: ["🌿", "☀️", "🍎", "🩺"],
  afternoon: ["💙", "🌿", "🍎", "✨"],
  night: ["🌙", "✨", "💙", "🌿"],
};

const notificationEmptyState: Record<NotificationTab, { title: string; subtitle: string }> = {
  inbox: {
    title: "No hay mensajes de pacientes",
    subtitle: "Cuando un paciente te escriba, aparecerá aquí.",
  },
  general: {
    title: "No hay notificaciones nuevas",
    subtitle: "Tu actividad está al día por ahora.",
  },
  archived: {
    title: "No hay notificaciones archivadas",
    subtitle: "Las notificaciones que archives aparecerán aquí.",
  },
};

function getRandomIndex(max: number): number {
  if (max <= 1) return 0;
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return (values[0] ?? 0) % max;
  }

  const performanceSeed = typeof performance !== "undefined" ? Math.round(performance.now() * 1000) : 0;
  return Math.abs(Date.now() + performanceSeed) % max;
}

function getStoredGreetingEmoji(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const storedValue = window.localStorage.getItem(GREETING_EMOJI_STORAGE_KEY);
    if (!storedValue) return undefined;
    const stored = JSON.parse(storedValue) as { emoji?: string };
    return stored.emoji;
  } catch {
    return undefined;
  }
}

function saveGreetingEmoji(periodOfDay: PeriodOfDay, emoji: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(GREETING_EMOJI_STORAGE_KEY, JSON.stringify({ periodOfDay, emoji }));
  } catch {
    // Storage can be unavailable in restricted environments.
  }
}

function getGreetingEmoji(periodOfDay: PeriodOfDay): string {
  const emojis = greetingEmojisByPeriod[periodOfDay];
  const previousEmoji = getStoredGreetingEmoji();
  const candidates = emojis.filter((emoji) => emoji !== previousEmoji);
  const availableEmojis = candidates.length > 0 ? candidates : emojis;

  return availableEmojis[getRandomIndex(availableEmojis.length)] ?? emojis[0] ?? "👋";
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

export function DashboardHeader({ onCustomizeKpis, dashboardEditing }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const activeNotificationTab = useNotificationStore((state) => state.activeTab);
  const notifications = useNotificationStore((state) => state.items);
  const setActiveNotificationTab = useNotificationStore((state) => state.setActiveTab);
  const markNotificationRead = useNotificationStore((state) => state.markRead);
  const archiveVisibleNotifications = useNotificationStore((state) => state.archiveVisible);
  const resolveNotificationAction = useNotificationStore((state) => state.resolveAction);
  const archiveNotification = useNotificationStore((state) => state.archive);
  const resetNotificationMockData = useNotificationStore((state) => state.resetMockData);
  const [swipedNotificationId, setSwipedNotificationId] = React.useState<string | null>(null);
  const [notificationDragState, setNotificationDragState] = React.useState<NotificationDragState | null>(null);
  const suppressNotificationClickRef = React.useRef(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = React.useState(false);
  const openCommand = useCommandPaletteStore((state) => state.setOpen);
  const searchShortcutLabel = getGlobalSearchShortcutLabel();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const displayName = user?.nombreCompleto?.trim() || "Administrador";
  const firstName = getFirstName(displayName);
  const [headerDate, setHeaderDate] = React.useState(() => new Date());
  const periodOfDay = getPeriodOfDay(headerDate);
  const greeting = getGreetingForPeriod(periodOfDay);
  const [greetingEmojiState, setGreetingEmojiState] = React.useState(() => ({
    periodOfDay,
    emoji: getGreetingEmoji(periodOfDay),
  }));
  const greetingEmoji = greetingEmojiState.emoji;
  const initials = getInitials(displayName);
  const inboxNotifications = notifications.filter((item) => item.type === "patient_message" && !item.archived);
  const generalNotifications = notifications.filter((item) => !item.archived);
  const archivedNotifications = notifications.filter((item) => item.archived);
  const visibleNotificationItems =
    activeNotificationTab === "inbox" ? inboxNotifications : activeNotificationTab === "general" ? generalNotifications : archivedNotifications;
  const notificationTabs: Array<{
    key: NotificationTab;
    label: string;
    count: number;
  }> = [
    { key: "inbox", label: "Bandeja", count: inboxNotifications.length },
    { key: "general", label: "General", count: generalNotifications.length },
    {
      key: "archived",
      label: "Archivadas",
      count: archivedNotifications.length,
    },
  ];
  const notificationCount = generalNotifications.filter((item) => !item.read).length;
  const hasVisibleNotifications = visibleNotificationItems.length > 0;
  const hasMarkableNotifications = visibleNotificationItems.some((item) => !item.archived);
  const markAllDisabled = activeNotificationTab === "archived" || !hasMarkableNotifications;
  const activeEmptyState = notificationEmptyState[activeNotificationTab];
  const canSwipeNotifications = activeNotificationTab !== "archived";
  const getNotificationSwipeOffset = (id: string) => {
    if (notificationDragState?.id === id) {
      return Math.max(Math.min(notificationDragState.currentX - notificationDragState.startX, 0), -NOTIFICATION_SWIPE_REVEAL_WIDTH);
    }

    return swipedNotificationId === id ? -NOTIFICATION_SWIPE_REVEAL_WIDTH : 0;
  };
  const openPatientConversation = (notification: DashboardNotification) => {
    void notification;
    // Placeholder until the patient chat screen exists.
  };
  const openNotificationTarget = (notification: DashboardNotification) => {
    void notification;
    // Placeholder until detail screens are wired per notification type.
  };
  const handleMarkAllNotifications = () => {
    if (markAllDisabled) return;
    archiveVisibleNotifications(activeNotificationTab);
    setSwipedNotificationId(null);
  };
  const handleNotificationClick = (notification: DashboardNotification) => {
    if (suppressNotificationClickRef.current) return;

    if (swipedNotificationId === notification.id) {
      setSwipedNotificationId(null);
      return;
    }

    if (notification.type === "patient_message") {
      openPatientConversation(notification);
    } else {
      openNotificationTarget(notification);
    }

    markNotificationRead(notification.id);
  };
  const handleNotificationKeyDown = (event: React.KeyboardEvent<HTMLElement>, notification: DashboardNotification) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleNotificationClick(notification);
  };
  const handleNotificationAction = (id: string, action: NotificationAction) => {
    resolveNotificationAction(id, action);
    setSwipedNotificationId(null);
  };
  const handleArchiveNotification = (id: string) => {
    archiveNotification(id);
    setSwipedNotificationId(null);
  };
  const handleNotificationPointerDown = (event: React.PointerEvent<HTMLElement>, id: string) => {
    if (!canSwipeNotifications) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest("button")) return;

    setSwipedNotificationId((current) => (current === id ? current : null));
    setNotificationDragState({
      id,
      startX: event.clientX,
      currentX: event.clientX,
      width: event.currentTarget.getBoundingClientRect().width,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleNotificationPointerMove = (event: React.PointerEvent<HTMLElement>, id: string) => {
    setNotificationDragState((current) => (current?.id === id ? { ...current, currentX: event.clientX } : current));
  };
  const finishNotificationSwipe = (event: React.PointerEvent<HTMLElement>, id: string) => {
    if (notificationDragState?.id !== id) return;

    const dragDistance = notificationDragState.currentX - notificationDragState.startX;
    const shouldRevealArchive = dragDistance <= -Math.min(NOTIFICATION_SWIPE_THRESHOLD, notificationDragState.width * 0.35);
    const movedEnoughToSuppressClick = Math.abs(dragDistance) > 6;

    if (movedEnoughToSuppressClick) {
      suppressNotificationClickRef.current = true;
      window.setTimeout(() => {
        suppressNotificationClickRef.current = false;
      }, 0);
    }

    setSwipedNotificationId(shouldRevealArchive ? id : null);
    setNotificationDragState(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  React.useEffect(() => {
    const intervalId = window.setInterval(() => setHeaderDate(new Date()), 15 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    setGreetingEmojiState((current) => {
      if (current.periodOfDay === periodOfDay) return current;
      return { periodOfDay, emoji: getGreetingEmoji(periodOfDay) };
    });
  }, [periodOfDay]);

  React.useEffect(() => {
    saveGreetingEmoji(greetingEmojiState.periodOfDay, greetingEmojiState.emoji);
  }, [greetingEmojiState]);

  React.useEffect(() => {
    setSwipedNotificationId(null);
    setNotificationDragState(null);
  }, [activeNotificationTab]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    window.resetNutriClinicaNotificationMockData = () => {
      resetNotificationMockData();
      setSwipedNotificationId(null);
      setNotificationDragState(null);
    };

    return () => {
      delete window.resetNutriClinicaNotificationMockData;
    };
  }, [resetNotificationMockData]);

  React.useEffect(() => {
    if (!notificationsOpen && !avatarMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (notificationsOpen && swipedNotificationId && !target.closest(".nc-dashboard-notification-menu__swipeItem")) {
        setSwipedNotificationId(null);
      }

      if (notificationsOpen && !target.closest(".nc-dashboard-notification-menu") && !target.closest(".nc-dashboard-header__notification")) {
        setNotificationsOpen(false);
      }

      if (avatarMenuOpen && !target.closest(".nc-dashboard-avatar-menu") && !target.closest(".nc-dashboard-header__avatar")) {
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
  }, [avatarMenuOpen, notificationsOpen, swipedNotificationId]);

  return (
    <header className="nc-dashboard-header" data-quick-notes-header>
      <div className="nc-dashboard-header__inner">
        <section className="nc-dashboard-header__intro" aria-label="Resumen del día">
          <h1 className="nc-dashboard-header__title">
            <span className="nc-dashboard-header__greetingText">
              {greeting}, {firstName}
            </span>
            <span className="nc-dashboard-header__greetingEmoji" aria-hidden="true">
              {greetingEmoji}
            </span>
          </h1>
          <p className="nc-dashboard-header__subtitle">Aquí tienes el resumen de tu clínica hoy.</p>
        </section>

        <div className="nc-dashboard-header__searchSlot">
          <button
            type="button"
            className="nc-dashboard-search"
            onClick={() => openCommand(true)}
            aria-label={t("layout.global_search_placeholder")}
            aria-haspopup="dialog"
          >
            <Search className="nc-dashboard-search__icon" size={19} strokeWidth={2} aria-hidden="true" />
            <span className="nc-dashboard-search__placeholder">{t("layout.global_search_placeholder")}</span>
            <kbd className="nc-dashboard-search__kbd">{searchShortcutLabel}</kbd>
          </button>
        </div>

        <div className="nc-dashboard-header__actions">
          <div className="nc-dashboard-header__ctaGroup" aria-label="Acciones rápidas del dashboard">
            <DashboardQuickAccessButton
              onCustomizeDashboard={onCustomizeKpis}
              dashboardEditing={dashboardEditing}
            />
            <button type="button" className="nc-dashboard-button nc-dashboard-button--soft" onClick={() => navigate("/consultas/nueva")}>
              <CalendarPlus size={17} strokeWidth={2} aria-hidden="true" />
              <span>Nueva consulta</span>
            </button>
            <button type="button" className="nc-dashboard-button nc-dashboard-button--primary" onClick={() => navigate("/pacientes/nuevo")}>
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
              <DropdownMenuContent align="end" sideOffset={10} className="nc-dashboard-notification-menu">
                <DropdownMenuLabel className="nc-dashboard-notification-menu__header">
                  <span className="nc-dashboard-notification-menu__title">Notificaciones</span>
                  <span className="nc-dashboard-notification-menu__headerActions">
                    <button type="button" className="nc-dashboard-notification-menu__markAll" disabled={markAllDisabled} onClick={handleMarkAllNotifications}>
                      Marcar todas
                    </button>
                    <button
                      type="button"
                      className="nc-dashboard-notification-menu__settings"
                      aria-label="Configurar notificaciones"
                      onClick={() => navigate("/configuracion")}
                    >
                      <Settings size={17} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </span>
                </DropdownMenuLabel>
                <div className="nc-dashboard-notification-menu__tabs" role="tablist" aria-label="Secciones de notificaciones">
                  {notificationTabs.map((tab) => {
                    const isActive = activeNotificationTab === tab.key;

                    return (
                      <button
                        type="button"
                        className={`nc-dashboard-notification-menu__tab${isActive ? " nc-dashboard-notification-menu__tab--active" : ""}`}
                        role="tab"
                        aria-selected={isActive}
                        key={tab.key}
                        onClick={() => setActiveNotificationTab(tab.key)}
                      >
                        <span>{tab.label}</span>
                        {tab.count > 0 && <strong>{tab.count > 99 ? "99+" : tab.count}</strong>}
                      </button>
                    );
                  })}
                </div>
                {hasVisibleNotifications ? (
                  <div className="nc-dashboard-notification-menu__body" role="list">
                    {visibleNotificationItems.map((item) => {
                      const swipeOffset = getNotificationSwipeOffset(item.id);
                      const showArchiveAction = canSwipeNotifications;

                      return (
                        <div className="nc-dashboard-notification-menu__swipeItem" key={item.id}>
                          {showArchiveAction && (
                            <div className="nc-dashboard-notification-menu__archiveReveal" aria-hidden={false}>
                              <button
                                type="button"
                                className="nc-dashboard-notification-menu__archiveButton"
                                aria-label={`Archivar notificación${item.personName ? ` de ${item.personName}` : ""}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleArchiveNotification(item.id);
                                }}
                              >
                                <Archive size={15} strokeWidth={2.1} aria-hidden="true" />
                                <span>Archivar</span>
                              </button>
                            </div>
                          )}
                          <article
                            className="nc-dashboard-notification-menu__item"
                            role="listitem"
                            tabIndex={0}
                            style={{
                              transform: `translateX(${swipeOffset}px)`,
                            }}
                            onClick={() => handleNotificationClick(item)}
                            onKeyDown={(event) => handleNotificationKeyDown(event, item)}
                            onPointerDown={(event) => handleNotificationPointerDown(event, item.id)}
                            onPointerMove={(event) => handleNotificationPointerMove(event, item.id)}
                            onPointerUp={(event) => finishNotificationSwipe(event, item.id)}
                            onPointerCancel={(event) => finishNotificationSwipe(event, item.id)}
                          >
                            <span className="nc-dashboard-notification-menu__avatar" data-tone={item.tone} aria-hidden="true">
                              {item.initials}
                              <span className="nc-dashboard-notification-menu__avatarStatus" />
                            </span>
                            <span className="nc-dashboard-notification-menu__content">
                              <span className="nc-dashboard-notification-menu__message">
                                {item.personName ? <strong>{item.personName}</strong> : null}
                                {item.personName ? " " : null}
                                {item.message}
                                {item.subject ? <strong>{item.subject}</strong> : null}
                                {item.suffix ?? null}
                              </span>
                              <span className="nc-dashboard-notification-menu__meta">
                                {item.timeAgo} • {item.category}
                              </span>
                              {item.requiresAction && item.actions && !item.read && !item.archived && (
                                <span className="nc-dashboard-notification-menu__itemActions" aria-label="Acciones de notificación">
                                  {item.actions.includes("reject") && (
                                    <button
                                      type="button"
                                      className="nc-dashboard-notification-menu__actionButton"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleNotificationAction(item.id, "reject");
                                      }}
                                    >
                                      Rechazar
                                    </button>
                                  )}
                                  {item.actions.includes("accept") && (
                                    <button
                                      type="button"
                                      className="nc-dashboard-notification-menu__actionButton nc-dashboard-notification-menu__actionButton--primary"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleNotificationAction(item.id, "accept");
                                      }}
                                    >
                                      Aceptar
                                    </button>
                                  )}
                                </span>
                              )}
                            </span>
                            {!item.read && !item.archived ? (
                              <span className="nc-dashboard-notification-menu__unreadDot" aria-label="Sin leer" />
                            ) : (
                              <span aria-hidden="true" />
                            )}
                          </article>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="nc-dashboard-notification-menu__body nc-dashboard-notification-menu__body--empty">
                    <div className="nc-dashboard-notification-menu__empty" role="status">
                      <span className="nc-dashboard-notification-menu__emptyIcon" aria-hidden="true">
                        <Bell size={42} strokeWidth={1.8} />
                      </span>
                      <strong>{activeEmptyState.title}</strong>
                      <small>{activeEmptyState.subtitle}</small>
                      <span className="nc-dashboard-notification-menu__emptyChip">
                        <CheckCircle2 size={18} strokeWidth={2.3} aria-hidden="true" />
                        Todo al día
                      </span>
                    </div>
                  </div>
                )}
                <div className="nc-dashboard-notification-menu__footer">
                  <button type="button" className="nc-dashboard-notification-menu__footerAction" onClick={() => navigate("/notificaciones")}>
                    <span>Ver todas las notificaciones</span>
                    <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={avatarMenuOpen} onOpenChange={setAvatarMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="nc-dashboard-header__avatar" aria-label="Abrir menú de usuario" aria-expanded={avatarMenuOpen}>
                  <span className="nc-dashboard-header__avatarFallback">{initials || <UserPlus size={18} aria-hidden="true" />}</span>
                  <span className="nc-dashboard-header__avatarStatus" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="nc-dashboard-avatar-menu">
                <DropdownMenuLabel className="nc-dashboard-avatar-menu__profile">
                  <span className="nc-dashboard-avatar-menu__initials" aria-hidden="true">
                    AG
                  </span>
                  <span className="nc-dashboard-avatar-menu__identity">
                    <strong>Administrador General</strong>
                    <span className="nc-dashboard-avatar-menu__roleLine">
                      <small>Director de clínica</small>
                      <span className="nc-dashboard-avatar-menu__badge">NORMAL</span>
                    </span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/perfil")}>
                  <User size={14} strokeWidth={1.85} aria-hidden="true" />
                  <span>Ver perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/reportes")}>
                  <BarChart3 size={14} strokeWidth={1.85} aria-hidden="true" />
                  <span>Analíticas y datos</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/ayuda")}>
                  <HelpCircle size={14} strokeWidth={1.85} aria-hidden="true" />
                  <span>Centro de ayuda</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/configuracion")}>
                  <Settings size={14} strokeWidth={1.85} aria-hidden="true" />
                  <span>Configuración de la cuenta</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="nc-dashboard-avatar-menu__separator" />
                <DropdownMenuItem className="nc-dashboard-avatar-menu__item" onClick={() => navigate("/billing")}>
                  <Star size={14} strokeWidth={1.85} aria-hidden="true" />
                  <span>Mejorar plan</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="nc-dashboard-avatar-menu__item nc-dashboard-avatar-menu__item--danger"
                  onClick={() => {
                    logout();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut size={14} strokeWidth={1.85} aria-hidden="true" />
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
