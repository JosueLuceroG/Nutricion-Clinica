import * as React from "react";
import { Link, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  UtensilsCrossed,
  Calculator,
  FlaskConical,
  ClipboardList,
  Settings,
  HelpCircle,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { Button } from "@components/ui/button";
import { Separator } from "@components/ui/separator";
import { Badge } from "@components/ui/badge";
import { cn } from "@utils/cn";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const primaryNav: NavItem[] = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/pacientes", label: "Pacientes", icon: Users, badge: "12" },
  { to: "/consultas", label: "Consultas", icon: ClipboardList },
  { to: "/agenda", label: "Agenda", icon: Calendar },
];

const clinicalNav: NavItem[] = [
  { to: "/laboratorio", label: "Laboratorio", icon: FlaskConical },
  { to: "/calculos", label: "Cálculos clínicos", icon: Calculator },
];

const planningNav: NavItem[] = [
  { to: "/planes", label: "Planes alimentarios", icon: UtensilsCrossed },
];

const secondaryNav: NavItem[] = [
  { to: "/configuracion", label: "Configuración", icon: Settings },
  { to: "/ayuda", label: "Ayuda", icon: HelpCircle },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-72",
      )}
      aria-label="Navegación principal"
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-2")}>
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm">NutriClinica</span>
              <span className="text-[10px] text-muted-foreground">v0.1.0</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <NavSection title="General" items={primaryNav} collapsed={collapsed} />
        <Separator className="my-3" />
        <NavSection title="Clínica" items={clinicalNav} collapsed={collapsed} />
        <Separator className="my-3" />
        <NavSection title="Planificación" items={planningNav} collapsed={collapsed} />
        <Separator className="my-3" />
        <NavSection title="" items={secondaryNav} collapsed={collapsed} />
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="w-full justify-center"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Colapsar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

function NavSection({
  title,
  items,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <div className="space-y-1">
      {!collapsed && title && (
        <h2 className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      )}
      {items.map((item) => (
        <NavItemLink key={item.to} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          collapsed && "justify-center",
        )
      }
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
          {item.badge}
        </Badge>
      )}
    </NavLink>
  );
}
