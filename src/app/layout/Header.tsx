import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, Search, Moon, Sun, MonitorSmartphone, User, Menu } from "lucide-react";
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
import { useUIStore, type Theme } from "@store/uiStore";
import { useAuthStore } from "@store/authStore";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { useNotificationStore } from "@store/notificationStore";

export function Header() {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const openCommand = useCommandPaletteStore((s) => s.setOpen);
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationStore((s) => s.unread);
  const navigate = useNavigate();

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openCommand(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCommand]);

  const cycleTheme = () => {
    const order: Theme[] = ["light", "dark", "system", "high-contrast"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const ThemeIcon =
    theme === "light" ? Sun : theme === "dark" ? Moon : MonitorSmartphone;

  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={toggleMobileSidebar}
        aria-label={t("layout.open_menu")}
      >
        <Menu className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={() => openCommand(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent text-muted-foreground hover:bg-accent sm:hidden"
        aria-label={t("layout.global_search_aria")}
      >
        <Search className="h-4 w-4" />
      </button>
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => openCommand(true)}
          className="flex h-9 w-full items-center rounded-md border border-input bg-transparent pl-9 pr-12 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={t("layout.global_search_aria")}
        >
          {t("layout.global_search_placeholder")}
        </button>
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={cycleTheme}
          aria-label={t("theme.change_theme")}
          title={t("layout.theme_title", { theme })}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/notificaciones")}
          aria-label={t("layout.notifications_aria", { count: unread })}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("layout.user_menu")}
              className="rounded-full"
            >
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
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              {t("layout.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracion")}>
              {t("settings.title")}
            </DropdownMenuItem>
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
