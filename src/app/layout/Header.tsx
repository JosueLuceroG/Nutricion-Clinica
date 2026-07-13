import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Check, Search, Moon, Sun, Palette, User, Menu } from "lucide-react";
import { useTheme } from "@app/providers/ThemeProvider";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import { useUIStore } from "@store/uiStore";
import { useAuthStore } from "@store/authStore";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { useNotificationStore } from "@store/notificationStore";
import { getGlobalSearchShortcutLabel } from "./globalSearchEngine";

const THEME_LONG_PRESS_MS = 1000;
const headerThemeOptions = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "alternative", label: "Alternativo", icon: Palette },
] as const;

type HeaderSelectableTheme = (typeof headerThemeOptions)[number]["value"];

export function Header() {
  const { t } = useTranslation();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const openCommand = useCommandPaletteStore((s) => s.setOpen);
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationStore((s) => s.unread);
  const navigate = useNavigate();
  const [themeMenuOpen, setThemeMenuOpen] = React.useState(false);
  const themePickerRef = React.useRef<HTMLDivElement>(null);
  const longPressTimerRef = React.useRef<number | null>(null);
  const longPressOpenedRef = React.useRef(false);
  const activeHeaderTheme: HeaderSelectableTheme = theme === "alternative" ? "alternative" : resolvedTheme === "dark" ? "dark" : "light";
  const searchShortcutLabel = getGlobalSearchShortcutLabel();

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const cycleTheme = () => {
    const activeIndex = headerThemeOptions.findIndex((option) => option.value === activeHeaderTheme);
    const nextOption = headerThemeOptions[(activeIndex + 1) % headerThemeOptions.length] ?? headerThemeOptions[0];
    setTheme(nextOption.value);
  };

  const ThemeIcon = activeHeaderTheme === "light" ? Sun : activeHeaderTheme === "dark" ? Moon : Palette;

  React.useEffect(() => clearLongPressTimer, []);

  React.useEffect(() => {
    if (!themeMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && themePickerRef.current?.contains(target)) return;
      setThemeMenuOpen(false);
    };

    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [themeMenuOpen]);

  const handleThemePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressOpenedRef.current = false;
    clearLongPressTimer();
    event.currentTarget.setPointerCapture(event.pointerId);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressOpenedRef.current = true;
      longPressTimerRef.current = null;
      setThemeMenuOpen(true);
    }, THEME_LONG_PRESS_MS);
  };

  const handleThemePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearLongPressTimer();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (longPressOpenedRef.current) return;
    setThemeMenuOpen(false);
    cycleTheme();
  };

  const handleThemePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    clearLongPressTimer();
    longPressOpenedRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleThemeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setThemeMenuOpen(false);
      cycleTheme();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setThemeMenuOpen(true);
    }
    if (event.key === "Escape") {
      setThemeMenuOpen(false);
    }
  };

  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);

  return (
    <header className="flex h-14 min-w-0 items-center gap-2 border-b bg-background px-3 sm:gap-3 sm:px-4">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={toggleMobileSidebar} aria-label={t("nav.open_menu")}>
        <Menu className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={() => openCommand(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground hover:bg-accent sm:hidden"
        aria-label={t("layout.global_search_aria")}
        aria-haspopup="dialog"
      >
        <Search className="h-4 w-4" />
      </button>
      <div className="relative hidden min-w-0 max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <button
          type="button"
          onClick={() => openCommand(true)}
          className="flex h-9 w-full items-center rounded-md border border-input bg-transparent pl-9 pr-12 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={t("layout.global_search_aria")}
          aria-haspopup="dialog"
        >
          {t("layout.global_search_placeholder")}
        </button>
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          {searchShortcutLabel}
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="relative" ref={themePickerRef}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            aria-label={`${t("theme.change_theme")}. Mantén presionado 1 segundo para elegir tema.`}
            title={`${t("layout.theme_title", { theme })}. Click para cambiar, mantener presionado 1 segundo para opciones.`}
            onPointerDown={handleThemePointerDown}
            onPointerUp={handleThemePointerUp}
            onPointerCancel={handleThemePointerCancel}
            onLostPointerCapture={handleThemePointerCancel}
            onKeyDown={handleThemeKeyDown}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          {themeMenuOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-2 min-w-40 rounded-xl border border-border/80 bg-popover/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur"
              role="menu"
              aria-label="Seleccionar tema"
            >
              {headerThemeOptions.map((option) => {
                const OptionIcon = option.icon;
                const isActive = activeHeaderTheme === option.value;

                return (
                  <button
                    type="button"
                    key={option.value}
                    role="menuitemradio"
                    aria-checked={isActive}
                    className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground active:scale-[0.985]"
                    onClick={() => {
                      setTheme(option.value);
                      setThemeMenuOpen(false);
                    }}
                  >
                    <OptionIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">{option.label}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/notificaciones")}
          aria-label={t("layout.notifications_aria", { count: unread })}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("layout.user_menu")} className="rounded-full">
              {user ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user.nombreCompleto
                    .split(" ")
                    .map((p: string) => p[0])
                    .slice(0, 2)
                    .join("")}
                </div>
              ) : (
                <User className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.nombreCompleto}</span>
                    <span className="text-xs text-muted-foreground">{user.rol}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/perfil")}>{t("layout.profile")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracion")}>{t("settings.title")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                useAuthStore.getState().logout();
                navigate("/login", { replace: true });
              }}
            >
              {t("nav.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
