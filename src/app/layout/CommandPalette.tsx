import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Search,
  User,
  ClipboardList,
  UtensilsCrossed,
  Stethoscope,
  FlaskConical,
  Activity,
  Settings,
  Home,
  Plus,
  Sun,
  Moon,
  Monitor,
  Users as UsersIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { patientService } from "@services/patientService";
import { consultationService } from "@services/consultationService";
import { mealPlanService } from "@services/mealPlanService";
import { useTheme } from "@app/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { MealPlan } from "@modules/mealplan/domain/MealPlan";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

const SEARCH_LIMIT = 8;

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [plans, setPlans] = React.useState<MealPlan[]>([]);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    const t = setTimeout(() => {
      void Promise.all([
        patientService.list.execute({ limit: 100 }),
        consultationService.list.execute({ limit: 50 }),
        mealPlanService.list.execute({ limit: 50 }),
      ]).then(([p, c, m]) => {
        setPatients(p.items);
        setConsultations(c.items);
        setPlans(m.items);
      });
    }, 100);
    return () => clearTimeout(t);
  }, [open]);

  const { setTheme } = useTheme();
  const { t, i18n } = useTranslation();

  const go = React.useCallback(
    (path: string) => () => {
      setOpen(false);
      setSearch("");
      navigate(path);
    },
    [navigate, setOpen],
  );

  const switchTheme = React.useCallback(
    (t: "light" | "dark" | "system") => () => {
      setTheme(t);
      setOpen(false);
      setSearch("");
    },
    [setTheme, setOpen],
  );

  const switchLanguage = React.useCallback(
    (lang: string) => () => {
      void i18n.changeLanguage(lang);
      setOpen(false);
      setSearch("");
    },
    [i18n, setOpen],
  );

  const filterBySearch = <T extends { label: string; keywords?: string }>(
    items: T[],
    query: string,
  ): T[] => {
    if (!query) return items;
    const q = normalize(query);
    return items.filter((it) => {
      const haystack = normalize(`${it.label} ${it.keywords ?? ""}`);
      return haystack.includes(q);
    });
  };

  const staticItems: CommandItem[] = React.useMemo(
    () => [
      { id: "home", label: t("command.go_dashboard"), group: t("command.navigation"), icon: Home, action: go("/") },
      {
        id: "patients",
        label: t("command.go_patients"),
        group: t("command.navigation"),
        icon: UsersIcon,
        action: go("/pacientes"),
      },
      {
        id: "consultations",
        label: t("command.go_consultations"),
        group: t("command.navigation"),
        icon: ClipboardList,
        action: go("/consultas"),
      },
      {
        id: "plans",
        label: t("command.go_meal_plans"),
        group: t("command.navigation"),
        icon: UtensilsCrossed,
        action: go("/planes"),
      },
      {
        id: "laboratory",
        label: t("command.go_laboratory"),
        group: t("command.navigation"),
        icon: FlaskConical,
        action: go("/laboratorio"),
      },
      {
        id: "calculations",
        label: t("command.go_calculations"),
        group: t("command.navigation"),
        icon: Activity,
        action: go("/calculos"),
      },
      {
        id: "settings",
        label: t("command.go_settings"),
        group: t("command.navigation"),
        icon: Settings,
        action: go("/configuracion"),
      },
      {
        id: "new-patient",
        label: t("command.create_patient"),
        group: t("command.actions"),
        shortcut: "N P",
        icon: Plus,
        action: go("/pacientes/nuevo"),
      },
      {
        id: "new-consult",
        label: t("consultation.new"),
        group: t("command.actions"),
        icon: Stethoscope,
        action: go("/consultas/nueva"),
      },
      {
        id: "new-plan",
        label: t("command.new_meal_plan"),
        group: t("command.actions"),
        icon: Plus,
        action: go("/pacientes"),
      },
      {
        id: "theme-light",
        label: t("theme.theme_light"),
        group: t("command.actions"),
        icon: Sun,
        action: switchTheme("light"),
      },
      {
        id: "theme-dark",
        label: t("theme.theme_dark"),
        group: t("command.actions"),
        icon: Moon,
        action: switchTheme("dark"),
      },
      {
        id: "theme-system",
        label: t("theme.theme_system"),
        group: t("command.actions"),
        icon: Monitor,
        action: switchTheme("system"),
      },
      {
        id: "lang-es",
        label: t("command.language_es_mx"),
        group: t("command.actions"),
        icon: Globe,
        action: switchLanguage("es-MX"),
      },
      {
        id: "lang-en",
        label: "English (US)",
        group: t("command.actions"),
        icon: Globe,
        action: switchLanguage("en-US"),
      },
    ],
    [go, switchLanguage, switchTheme, t],
  );

  const patientItems: CommandItem[] = React.useMemo(() => {
    return patients
      .filter((p) => !search || normalize(p.fullName).includes(normalize(search)))
      .slice(0, SEARCH_LIMIT)
      .map((p) => ({
        id: `patient-${p.id.toString()}`,
        label: p.fullName,
        group: t("patient.title"),
        keywords: `${p.id.toString()} ${p.email?.toString() ?? ""}`,
        icon: User,
        action: go(`/pacientes/${p.id.toString()}`),
      }));
  }, [patients, search, go, t]);

  const consultationItems: CommandItem[] = React.useMemo(() => {
    return consultations
      .filter((c) => {
        if (!search) return true;
        const q = normalize(search);
        return (
          normalize(c.reason).includes(q) ||
          normalize(c.assessment ?? "").includes(q) ||
          c.patientId.toString().includes(q)
        );
      })
      .slice(0, SEARCH_LIMIT)
      .map((c) => ({
        id: `consultation-${c.id.toString()}`,
        label: `${t("consultation.consultation_number", { number: c.consultationNumber })} · ${new Intl.DateTimeFormat("es-MX", {
          dateStyle: "short",
        }).format(c.consultationDate)}`,
        group: t("consultation.title"),
        keywords: `${c.reason} ${c.assessment ?? ""}`,
        icon: ClipboardList,
        action: go(`/consultas/${c.id.toString()}`),
      }));
  }, [consultations, search, go, t]);

  const planItems: CommandItem[] = React.useMemo(() => {
    return plans
      .filter((p) => {
        if (!search) return true;
        const q = normalize(search);
        return (
          normalize(p.name).includes(q) ||
          normalize(p.description ?? "").includes(q) ||
          p.patientId.toString().includes(q)
        );
      })
      .slice(0, SEARCH_LIMIT)
      .map((p) => ({
        id: `plan-${p.id.toString()}`,
        label: `${p.name} · ${p.kcalTarget} kcal`,
        group: t("mealplan.title"),
        keywords: `${p.description ?? ""} ${p.notes ?? ""}`,
        icon: UtensilsCrossed,
        action: go(`/planes/${p.id.toString()}`),
      }));
  }, [plans, search, go, t]);

  const allItems = React.useMemo(
    () =>
      filterBySearch(staticItems, search).concat(
        patientItems,
        consultationItems,
        planItems,
      ),
    [staticItems, patientItems, consultationItems, planItems, search],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          label={t("command.label")}
        >
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t("command.placeholder")}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {t("command.no_results", { search })}
            </Command.Empty>
            {Object.entries(
              allItems.reduce<Record<string, CommandItem[]>>((acc, item) => {
                (acc[item.group] ??= []).push(item);
                return acc;
              }, {}),
            ).map(([group, list]) => (
              <Command.Group
                key={group}
                heading={group}
                className="overflow-hidden p-1 text-foreground"
              >
                {list.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={item.action}
                      className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="ml-auto inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
