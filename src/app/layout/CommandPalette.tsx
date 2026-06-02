import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { useCommandPaletteStore } from "@store/commandPaletteStore";

interface CommandItem {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");

  const go = React.useCallback(
    (path: string) => () => {
      setOpen(false);
      setSearch("");
      navigate(path);
    },
    [navigate, setOpen],
  );

  const items: CommandItem[] = React.useMemo(
    () => [
      { id: "home", label: "Ir al panel", group: "Navegación", action: go("/") },
      { id: "patients", label: "Ir a pacientes", group: "Navegación", action: go("/pacientes") },
      { id: "consultations", label: "Ir a consultas", group: "Navegación", action: go("/consultas") },
      { id: "plans", label: "Ir a planes alimentarios", group: "Navegación", action: go("/planes") },
      { id: "calculations", label: "Ir a cálculos clínicos", group: "Navegación", action: go("/calculos") },
      { id: "settings", label: "Ir a configuración", group: "Navegación", action: go("/configuracion") },
      { id: "new-patient", label: "Crear nuevo paciente", group: "Acciones", shortcut: "N P", action: go("/pacientes/nuevo") },
      { id: "new-consult", label: "Nueva consulta", group: "Acciones", action: go("/consultas/nueva") },
      { id: "new-plan", label: "Nuevo plan alimentario", group: "Acciones", action: go("/planes/nuevo") },
    ],
    [go],
  );

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

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
              placeholder="Escribe un comando o busca…"
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No se encontraron resultados.
            </Command.Empty>
            {Object.entries(
              items.reduce<Record<string, CommandItem[]>>((acc, item) => {
                (acc[item.group] ??= []).push(item);
                return acc;
              }, {}),
            ).map(([group, list]) => (
              <Command.Group key={group} heading={group} className="overflow-hidden p-1 text-foreground">
                {list.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label}
                    onSelect={item.action}
                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  >
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="ml-auto inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
