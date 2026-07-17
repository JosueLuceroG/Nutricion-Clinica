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
  Receipt,
  DollarSign,
  BookOpen,
  Target,
  HeartPulse,
  FileText,
  CalendarRange,
  Pill,
  BarChart3,
  Database,
  Upload,
  Video,
  Shield,
  Sparkles,
} from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { useAuthStore } from "@store/authStore";
import { Button } from "@components/ui/button";
import { Separator } from "@components/ui/separator";
import { Badge } from "@components/ui/badge";
import { ThemeToggle } from "@components/ui/ThemeToggle";
import { LanguageSwitcher } from "@components/ui/LanguageSwitcher";
import { cn } from "@utils/cn";
import { db } from "@services/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { isBillingRole } from "@modules/auth/authRoles";

interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Si está, se suscribe al live count desde Dexie. */
  liveCountFrom?: "patients" | "consultations" | "anthropometry" | "lab_panels" | "meal_plans" | "pending_payments" | "appointments";
}

const primaryNav: NavItem[] = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/pacientes", labelKey: "nav.patients", icon: Users, liveCountFrom: "patients" },
  { to: "/consultas", labelKey: "nav.consultations", icon: ClipboardList },
  { to: "/agenda", labelKey: "nav.agenda", icon: Calendar, liveCountFrom: "appointments" },
];

const clinicalNav: NavItem[] = [
  { to: "/laboratorio", labelKey: "nav.laboratory", icon: FlaskConical },
  { to: "/calculos", labelKey: "nav.calculations", icon: Calculator },
  { to: "/objetivos", labelKey: "nav.goals", icon: Target },
  { to: "/adherencia", labelKey: "nav.adherence", icon: HeartPulse },
  { to: "/medicamentos", labelKey: "nav.medications", icon: Pill },
  { to: "/telemedicina", labelKey: "nav.telemedicina", icon: Video },
];

const planningNav: NavItem[] = [
  { to: "/planes", labelKey: "nav.meal_plans", icon: UtensilsCrossed },
  { to: "/plan-semanal", labelKey: "nav.meal_plans", icon: CalendarRange },
  { to: "/recetas", labelKey: "nav.recipes", icon: BookOpen },
  { to: "/documentos", labelKey: "nav.documents", icon: FileText },
];

const reportsNav: NavItem[] = [
  { to: "/reportes", labelKey: "nav.reports", icon: BarChart3 },
];

const secondaryNav: NavItem[] = [
  { to: "/smae", labelKey: "nav.smae_catalog", icon: Database },
  { to: "/importar", labelKey: "nav.import", icon: Upload },
  { to: "/seguridad/2fa", labelKey: "nav.security", icon: Shield },
  { to: "/configuracion", labelKey: "nav.settings", icon: Settings },
  { to: "/ayuda", labelKey: "nav.help", icon: HelpCircle },
];

export function Sidebar({ onUsePremiumLayout }: { onUsePremiumLayout?: () => void }) {
  const { t } = useTranslation();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const mobileOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const userRole = useAuthStore((s) => s.user?.rol ?? null);
  const showBilling = isBillingRole(userRole);

  const billingNav: NavItem[] = showBilling
    ? [
        {
          to: "/billing",
          labelKey: "nav.billing",
          icon: Receipt,
          liveCountFrom: "pending_payments",
        },
        {
          to: "/billing/payments",
          labelKey: "nav.payments",
          icon: DollarSign,
        },
        {
          to: "/billing/expenses",
          labelKey: "nav.expenses",
          icon: Receipt,
        },
      ]
    : [];

  const sidebarContent = (
    <>
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-2")}>
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm">{t("common.app_name")}</span>
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
        <NavSection title={t("nav.general")} items={primaryNav} collapsed={collapsed} />
        {billingNav.length > 0 && (
          <>
            <Separator className="my-3" />
            <NavSection title={t("nav.finance")} items={billingNav} collapsed={collapsed} />
          </>
        )}
        <Separator className="my-3" />
        <NavSection title={t("nav.consultations")} items={clinicalNav} collapsed={collapsed} />
        <Separator className="my-3" />
        <NavSection title={t("nav.meal_plans")} items={planningNav} collapsed={collapsed} />
        <Separator className="my-3" />
        <NavSection title={t("nav.reports")} items={reportsNav} collapsed={collapsed} />
        <Separator className="my-3" />
        <NavSection title="" items={secondaryNav} collapsed={collapsed} />
      </nav>

      <div className="border-t p-2">
        {onUsePremiumLayout && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMobileOpen(false);
              onUsePremiumLayout();
            }}
            className={cn("mb-1 w-full gap-2", collapsed ? "justify-center px-0" : "justify-start px-2")}
            aria-label="Volver al diseño nuevo"
            title={collapsed ? "Volver al diseño nuevo" : undefined}
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && <span>Volver al diseño nuevo</span>}
          </Button>
        )}
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <ThemeToggle collapsed />
            <LanguageSwitcher collapsed />
            <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-center" aria-label={t("nav.expand")}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <ThemeToggle />
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start gap-2 px-2" aria-label={t("nav.collapse")}>
              <ChevronsLeft className="h-4 w-4" />
              <span>{t("nav.collapse")}</span>
            </Button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-72",
        )}
        aria-label={t("nav.main_menu")}
        data-layout-sidebar="legacy"
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className={cn(
               "fixed inset-y-0 left-0 z-50 flex h-full max-w-[calc(100vw-2rem)] flex-col border-r bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200",
               collapsed ? "w-16" : "w-72",
            )}
            aria-label={t("nav.main_menu")}
            data-layout-sidebar="legacy"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
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

function NavItemLinkImpl({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(item.labelKey);
  // Switch explícito (en vez de `db[item.liveCountFrom]`) para que Dexie
  // pueda observar correctamente cada tabla y para que filtremos
  // soft-deleted (que es la causa del "número fijo" en el badge: el
  // count sin filtro incluye filas con deletedAt seteado).
  const count = useLiveQuery(
    async () => {
      switch (item.liveCountFrom) {
        case "patients":
          return db.patients.filter((r) => r.deleted_at === null).count();
        case "consultations":
          return db.consultations.filter((r) => r.deleted_at === null).count();
        case "anthropometry":
          return db.anthropometry.filter((r) => r.deleted_at === null).count();
        case "lab_panels":
          return db.lab_panels.filter((r) => r.deleted_at === null).count();
        case "meal_plans":
          return db.meal_plans.filter((r) => r.deleted_at === null).count();
        case "appointments":
          return db.appointments
            .filter((r) => r.status === "scheduled" || r.status === "confirmed")
            .count();
        case "pending_payments":
          return db.consultations
            .filter((r) => r.deleted_at === null && !r.paid && r.cost > 0)
            .count();
        default:
          return 0;
      }
    },
    [item.liveCountFrom],
    null,
  );
  const badge = count !== null && count !== undefined ? String(count) : undefined;
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
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge && (
        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
          {badge}
        </Badge>
      )}
    </NavLink>
  );
}

// React.memo: el sidebar tiene ~5-6 NavItemLink suscritos a useLiveQuery.
// Sin memo, cualquier re-render del Sidebar (e.g. al cambiar el tema o
// al actualizarse el syncStore cada 5s) re-renderiza TODOS los items y
// dispara 5-6 queries nuevas contra Dexie aunque sus inputs no hayan
// cambiado. Con memo, cada item sólo re-renderiza si su `item` o
// `collapsed` cambian, y useLiveQuery se queda con su valor cacheado.
const NavItemLink = React.memo(NavItemLinkImpl);
