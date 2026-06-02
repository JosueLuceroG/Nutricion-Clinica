import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Search, Moon, Sun, MonitorSmartphone, User } from "lucide-react";
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

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
      <div className="relative max-w-md flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => openCommand(true)}
          className="flex h-9 w-full items-center rounded-md border border-input bg-transparent pl-9 pr-12 text-left text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Búsqueda global (Ctrl+K)"
        >
          Buscar pacientes, consultas, alimentos…
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
          aria-label={`Cambiar tema (actual: ${theme})`}
          title={`Tema: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/notificaciones")}
          aria-label={`Notificaciones (${unread} sin leer)`}
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
              aria-label="Menú de usuario"
              className="rounded-full"
            >
              {user ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user.name
                    .split(" ")
                    .map((p) => p[0])
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
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracion")}>
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
