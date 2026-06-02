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
  Users as UsersIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { patientService } from "@services/patientService";
import { consultationService } from "@services/consultationService";
import { mealPlanService } from "@services/mealPlanService";
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

  const go = React.useCallback(
    (path: string) => () => {
      setOpen(false);
      setSearch("");
      navigate(path);
    },
    [navigate, setOpen],
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
      { id: "home", label: "Ir al panel", group: "Navegación", icon: Home, action: go("/") },
      {
        id: "patients",
        label: "Ir a pacientes",
        group: "Navegación",
        icon: UsersIcon,
        action: go("/pacientes"),
      },
      {
        id: "consultations",
        label: "Ir a consultas",
        group: "Navegación",
        icon: ClipboardList,
        action: go("/consultas"),
      },
      {
        id: "plans",
        label: "Ir a planes alimentarios",
        group: "Navegación",
        icon: UtensilsCrossed,
        action: go("/planes"),
      },
      {
        id: "laboratory",
        label: "Ir a laboratorio",
        group: "Navegación",
        icon: FlaskConical,
        action: go("/laboratorio"),
      },
      {
        id: "calculations",
        label: "Ir a cálculos clínicos",
        group: "Navegación",
        icon: Activity,
        action: go("/calculos"),
      },
      {
        id: "settings",
        label: "Ir a configuración",
        group: "Navegación",
        icon: Settings,
        action: go("/configuracion"),
      },
      {
        id: "new-patient",
        label: "Crear nuevo paciente",
        group: "Acciones",
        shortcut: "N P",
        icon: Plus,
        action: go("/pacientes/nuevo"),
      },
      {
        id: "new-consult",
        label: "Nueva consulta",
        group: "Acciones",
        icon: Stethoscope,
        action: go("/consultas/nueva"),
      },
      {
        id: "new-plan",
        label: "Nuevo plan alimentario",
        group: "Acciones",
        icon: Plus,
        action: go("/pacientes"),
      },
    ],
    [go],
  );

  const patientItems: CommandItem[] = React.useMemo(() => {
    return patients
      .filter((p) => !search || normalize(p.fullName).includes(normalize(search)))
      .slice(0, SEARCH_LIMIT)
      .map((p) => ({
        id: `patient-${p.id.toString()}`,
        label: p.fullName,
        group: "Pacientes",
        keywords: `${p.id.toString()} ${p.email?.toString() ?? ""}`,
        icon: User,
        action: go(`/pacientes/${p.id.toString()}`),
      }));
  }, [patients, search, go]);

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
        label: `Consulta #${c.consultationNumber} · ${new Intl.DateTimeFormat("es-MX", {
          dateStyle: "short",
        }).format(c.consultationDate)}`,
        group: "Consultas",
        keywords: `${c.reason} ${c.assessment ?? ""}`,
        icon: ClipboardList,
        action: go(`/consultas/${c.id.toString()}`),
      }));
  }, [consultations, search, go]);

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
        group: "Planes",
        keywords: `${p.description ?? ""} ${p.notes ?? ""}`,
        icon: UtensilsCrossed,
        action: go(`/planes/${p.id.toString()}`),
      }));
  }, [plans, search, go]);

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
          label="Paleta de comandos"
        >
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Busca pacientes, consultas, planes o escribe un comando…"
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No se encontraron resultados para &quot;{search}&quot;.
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
