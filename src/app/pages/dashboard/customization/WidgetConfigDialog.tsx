import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import type { DashboardWidgetConfig, DashboardWidgetInstance, DashboardWidgetPosition, DashboardWidgetSizePreset, DashboardWidgetTone } from "./dashboardWidgetTypes";
import { getDashboardWidgetDefinition, getDashboardWidgetSize } from "./dashboardWidgetRegistry";

interface WidgetConfigDialogProps {
  widget: DashboardWidgetInstance | null;
  position: DashboardWidgetPosition | null;
  onOpenChange: (open: boolean) => void;
  onSave: (instanceId: string, config: DashboardWidgetConfig, size?: DashboardWidgetSizePreset) => void;
}

const sizeLabels: Record<DashboardWidgetSizePreset, string> = {
  small: "Pequeño",
  wide: "Ancho",
  medium: "Mediano",
  large: "Grande",
  fullWidth: "Ancho completo",
  doubleHeight: "Alto doble",
  custom: "Personalizado",
};

const tones: Array<{ value: DashboardWidgetTone; label: string }> = [
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "purple", label: "Morado" },
  { value: "orange", label: "Naranja" },
  { value: "cyan", label: "Turquesa" },
  { value: "rose", label: "Rosa" },
  { value: "slate", label: "Neutro" },
];

export function WidgetConfigDialog({ widget, position, onOpenChange, onSave }: WidgetConfigDialogProps) {
  const definition = widget ? getDashboardWidgetDefinition(widget.definitionId) : null;
  const [title, setTitle] = React.useState("");
  const [tone, setTone] = React.useState<DashboardWidgetTone>("blue");
  const [size, setSize] = React.useState<DashboardWidgetSizePreset>("small");
  const [sizeChanged, setSizeChanged] = React.useState(false);
  const [limit, setLimit] = React.useState(6);
  const isKpi = definition?.kind === "kpi" || definition?.kind === "customKpi";
  const supportsLimit = definition?.kind === "upcomingConsultations" || definition?.kind === "alerts" || definition?.kind === "recentPayments" || definition?.kind === "quickActions";

  React.useEffect(() => {
    if (!widget || !definition) return;
    setTitle(widget.config.title ?? "");
    setTone(widget.config.tone ?? definition.tone);
    const matchingSize = position
      ? definition.allowedSizes.find((preset) => {
          const candidate = getDashboardWidgetSize(definition.id, preset);
          return candidate.w === position.w && candidate.h === position.h;
        })
      : null;
    setSize(matchingSize ?? definition.defaultSize.preset);
    setSizeChanged(false);
    setLimit(widget.config.limit ?? 6);
  }, [definition, position, widget]);

  return (
    <Dialog open={Boolean(widget)} onOpenChange={onOpenChange}>
      <DialogContent className="nc-dashboard-widget-config">
        <DialogHeader>
          <DialogTitle>Configurar widget</DialogTitle>
          <DialogDescription>{definition?.name}</DialogDescription>
        </DialogHeader>

        <label>
          <span>Título personalizado</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={definition?.name} maxLength={80} />
        </label>
        {isKpi && (
          <label>
            <span>Acento visual</span>
            <select value={tone} onChange={(event) => setTone(event.target.value as DashboardWidgetTone)}>
              {tones.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        )}
        {supportsLimit && (
          <label>
            <span>Elementos visibles</span>
            <input type="number" min={1} max={10} value={limit} onChange={(event) => setLimit(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} />
          </label>
        )}
        <fieldset>
          <legend>Tamaño</legend>
          <div className="nc-dashboard-widget-config__sizes">
            {definition?.allowedSizes.map((preset) => (
              <button key={preset} type="button" aria-pressed={size === preset} data-active={size === preset || undefined} onClick={() => { setSize(preset); setSizeChanged(true); }}>
                {sizeLabels[preset]}
              </button>
            ))}
          </div>
        </fieldset>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="button"
            onClick={() => {
              if (!widget) return;
              onSave(widget.instanceId, {
                title: title.trim() || undefined,
                ...(isKpi ? { tone } : {}),
                ...(supportsLimit ? { limit } : {}),
              }, sizeChanged ? size : undefined);
              onOpenChange(false);
            }}
          >
            Aplicar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
