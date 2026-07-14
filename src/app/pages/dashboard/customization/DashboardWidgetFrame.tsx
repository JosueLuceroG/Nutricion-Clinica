import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  EyeOff,
  GripVertical,
  Settings2,
  Trash2,
} from "lucide-react";

export type DashboardResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const resizeHandles: Array<{ direction: DashboardResizeDirection; label: string }> = [
  { direction: "n", label: "arriba" },
  { direction: "ne", label: "esquina superior derecha" },
  { direction: "e", label: "derecha" },
  { direction: "se", label: "esquina inferior derecha" },
  { direction: "s", label: "abajo" },
  { direction: "sw", label: "esquina inferior izquierda" },
  { direction: "w", label: "izquierda" },
  { direction: "nw", label: "esquina superior izquierda" },
];

interface DashboardWidgetFrameProps {
  title: string;
  editing: boolean;
  canConfigure: boolean;
  canDuplicate: boolean;
  showDragHandle: boolean;
  isFirst: boolean;
  isLast: boolean;
  children: ReactNode;
  onConfigure: () => void;
  onDuplicate: () => void;
  onHide: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeStart: (direction: DashboardResizeDirection, event: React.PointerEvent<HTMLElement>) => void;
  onResizeStep: (direction: DashboardResizeDirection, widthDelta: number, heightDelta: number) => void;
}

export function DashboardWidgetFrame({
  title,
  editing,
  canConfigure,
  canDuplicate,
  showDragHandle,
  isFirst,
  isLast,
  children,
  onConfigure,
  onDuplicate,
  onHide,
  onRemove,
  onMove,
  onDragStart,
  onResizeStart,
  onResizeStep,
}: DashboardWidgetFrameProps) {
  return (
    <div
      className="nc-dashboard-widget-frame"
      data-editing={editing || undefined}
      data-draggable={editing && showDragHandle || undefined}
      onPointerDown={(event) => {
        if (!editing || !showDragHandle) return;
        const target = event.target as HTMLElement;
        if (target.closest("button,a,input,select,textarea,[role='separator']")) return;
        onDragStart(event);
      }}
    >
      {editing && (
        <div className="nc-dashboard-widget-frame__controls" aria-label={`Controles de ${title}`}>
          {showDragHandle && (
            <span
              className="nc-dashboard-widget-frame__drag"
              aria-hidden="true"
              title={`Arrastrar ${title}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onDragStart(event);
              }}
            >
              <GripVertical size={16} aria-hidden="true" />
            </span>
          )}
          <span className="nc-dashboard-widget-frame__name">{title}</span>
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label={`Subir ${title}`} title="Subir">
            <ArrowUp size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label={`Bajar ${title}`} title="Bajar">
            <ArrowDown size={15} aria-hidden="true" />
          </button>
          {canConfigure && (
            <button type="button" onClick={onConfigure} aria-label={`Configurar ${title}`} title="Configurar">
              <Settings2 size={15} aria-hidden="true" />
            </button>
          )}
          {canDuplicate && (
            <button type="button" onClick={onDuplicate} aria-label={`Duplicar ${title}`} title="Duplicar">
              <Copy size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={onHide} aria-label={`Ocultar ${title}`} title="Ocultar">
            <EyeOff size={15} aria-hidden="true" />
          </button>
          <button type="button" className="nc-dashboard-widget-frame__remove" onClick={onRemove} aria-label={`Eliminar ${title}`} title="Eliminar">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="nc-dashboard-widget-frame__content">{children}</div>
      {editing && showDragHandle && resizeHandles.map(({ direction, label }) => (
        <span
          key={direction}
          className={`nc-dashboard-widget-frame__resize nc-dashboard-widget-frame__resize--${direction}`}
          role="separator"
          tabIndex={0}
          aria-label={`Redimensionar ${title} desde ${label}`}
          {...(direction === "n" || direction === "s"
            ? { "aria-orientation": "horizontal" as const }
            : direction === "e" || direction === "w"
              ? { "aria-orientation": "vertical" as const }
              : {})}
          onPointerDown={(event) => {
            event.stopPropagation();
            onResizeStart(direction, event);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") onResizeStep(direction, 1, 0);
            else if (event.key === "ArrowLeft") onResizeStep(direction, -1, 0);
            else if (event.key === "ArrowDown") onResizeStep(direction, 0, 1);
            else if (event.key === "ArrowUp") onResizeStep(direction, 0, -1);
            else return;
            event.preventDefault();
          }}
        />
      ))}
    </div>
  );
}
