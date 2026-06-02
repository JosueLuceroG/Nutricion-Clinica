import * as React from "react";
import { useLocation } from "react-router-dom";
import { X, Info, Stethoscope, AlertCircle } from "lucide-react";
import { Button } from "@components/ui/button";
import { useUIStore } from "@store/uiStore";
import { cn } from "@utils/cn";

export function ContextPanel() {
  const open = useUIStore((s) => s.contextPanelOpen);
  const setOpen = useUIStore((s) => s.setContextPanelOpen);
  const location = useLocation();

  const ctx = React.useMemo(() => {
    if (location.pathname.startsWith("/pacientes")) {
      return {
        title: "Información del paciente",
        description: "Los datos personales se cifran localmente antes de persistir.",
        icon: Stethoscope,
      };
    }
    if (location.pathname.startsWith("/consultas")) {
      return {
        title: "Reglas SMAE",
        description: "Las recomendaciones siguen SMAE 5ª edición.",
        icon: Info,
      };
    }
    return {
      title: "Contexto",
      description: "Información contextual de la sección actual.",
      icon: Info,
    };
  }, [location.pathname]);

  if (!open) return null;
  const Icon = ctx.icon;

  return (
    <aside
      className="hidden w-80 shrink-0 flex-col border-l bg-muted/20 lg:flex"
      aria-label="Panel contextual"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">{ctx.title}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(false)}
          aria-label="Cerrar panel contextual"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-sm">
        <p className="text-muted-foreground">{ctx.description}</p>
        <div
          className={cn(
            "mt-4 flex items-start gap-2 rounded-md border border-info/30 bg-info/5 p-3 text-xs",
          )}
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-info" aria-hidden />
          <span>
            Esta aplicación funciona sin conexión. Los cambios se sincronizan
            automáticamente cuando se restablece la conexión.
          </span>
        </div>
      </div>
    </aside>
  );
}
