import * as React from "react";
import { GridLayout, moveElement, useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { toast } from "sonner";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import type { DashboardPreferences, DashboardWidgetInstance, DashboardWidgetPosition } from "./dashboardWidgetTypes";
import { getDashboardWidgetDefinition } from "./dashboardWidgetRegistry";
import { DashboardWidgetFrame, type DashboardResizeDirection } from "./DashboardWidgetFrame";

interface EditableDashboardGridProps {
  preferences: DashboardPreferences;
  editing: boolean;
  highlightedWidgetId?: string | null;
  renderWidget: (widget: DashboardWidgetInstance) => React.ReactNode;
  onLayoutChange: (layout: DashboardWidgetPosition[]) => void;
  onConfigure: (instanceId: string) => void;
  onDuplicate: (instanceId: string) => void;
  onHide: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
  onMove: (instanceId: string, direction: -1 | 1) => void;
}

interface PointerSession {
  type: "drag" | "resize";
  instanceId: string;
  startX: number;
  startY: number;
  initial: DashboardWidgetPosition;
  title: string;
  resizeDirection?: DashboardResizeDirection;
}

interface ResizeResult {
  position: DashboardWidgetPosition;
  constrained: boolean;
}

const GRID_CONSTRAINT_TOAST_ID = "dashboard-grid-constraint";

function showGridConstraintToast(title: string, description: string): void {
  toast.error(title, {
    id: GRID_CONSTRAINT_TOAST_ID,
    className: "nc-dashboard-grid-constraint-toast",
    description,
    duration: 3800,
  });
}

function toDashboardLayout(layout: Layout): DashboardWidgetPosition[] {
  return layout.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
  }));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function resizePosition(
  initial: DashboardWidgetPosition,
  direction: DashboardResizeDirection,
  widthDelta: number,
  heightDelta: number,
  maxRows: number,
): ResizeResult {
  const minimumWidth = initial.minW ?? 1;
  const minimumHeight = initial.minH ?? 1;
  const maximumWidth = Math.min(initial.maxW ?? 12, 12);
  const maximumHeight = Math.min(initial.maxH ?? maxRows, maxRows);
  const initialRight = initial.x + initial.w;
  const initialBottom = initial.y + initial.h;
  let x = initial.x;
  let y = initial.y;
  let width = initial.w;
  let height = initial.h;
  let constrained = false;

  if (direction.includes("e")) {
    const desiredWidth = initial.w + widthDelta;
    width = clamp(desiredWidth, minimumWidth, Math.min(maximumWidth, 12 - initial.x));
    constrained ||= width !== desiredWidth;
  }
  if (direction.includes("w")) {
    const desiredX = initial.x + widthDelta;
    x = clamp(desiredX, Math.max(0, initialRight - maximumWidth), initialRight - minimumWidth);
    width = initialRight - x;
    constrained ||= x !== desiredX;
  }
  if (direction.includes("s")) {
    const desiredHeight = initial.h + heightDelta;
    height = clamp(desiredHeight, minimumHeight, Math.min(maximumHeight, maxRows - initial.y));
    constrained ||= height !== desiredHeight;
  }
  if (direction.includes("n")) {
    const desiredY = initial.y + heightDelta;
    y = clamp(desiredY, Math.max(0, initialBottom - maximumHeight), initialBottom - minimumHeight);
    height = initialBottom - y;
    constrained ||= y !== desiredY;
  }

  return { position: { ...initial, x, y, w: width, h: height }, constrained };
}

export function EditableDashboardGrid({
  preferences,
  editing,
  highlightedWidgetId,
  renderWidget,
  onLayoutChange,
  onConfigure,
  onDuplicate,
  onHide,
  onRemove,
  onMove,
}: EditableDashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [pendingRemoval, setPendingRemoval] = React.useState<DashboardWidgetInstance | null>(null);
  const [pointerSession, setPointerSession] = React.useState<PointerSession | null>(null);
  const [layoutPreview, setLayoutPreview] = React.useState<DashboardWidgetPosition[] | null>(null);
  const layoutPreviewRef = React.useRef<DashboardWidgetPosition[] | null>(null);
  const pointerMovementRef = React.useRef({ x: 0, y: 0 });
  const constraintReachedRef = React.useRef(false);
  const visibleWidgets = React.useMemo(() => {
    const byId = new Map(preferences.widgets.filter((widget) => !widget.hidden).map((widget) => [widget.instanceId, widget]));
    const ordered = preferences.smallScreenOrder
      .map((id) => byId.get(id))
      .filter((widget): widget is DashboardWidgetInstance => Boolean(widget));
    for (const widget of byId.values()) {
      if (!ordered.some((item) => item.instanceId === widget.instanceId)) ordered.push(widget);
    }
    return ordered;
  }, [preferences.smallScreenOrder, preferences.widgets]);
  const visibleIds = React.useMemo(() => new Set(visibleWidgets.map((widget) => widget.instanceId)), [visibleWidgets]);
  const desktopLayout = React.useMemo(
    () => preferences.layout.filter((item) => visibleIds.has(item.i)).map((item) => ({ ...item })),
    [preferences.layout, visibleIds],
  );
  const renderedLayout = layoutPreview ?? desktopLayout;
  const useInteractiveGrid = width >= 920;

  const previewLayout = React.useCallback((layout: DashboardWidgetPosition[]) => {
    layoutPreviewRef.current = layout;
    setLayoutPreview(layout);
  }, []);

  React.useEffect(() => {
    if (!pointerSession) return;
    const handlePointerMove = (event: PointerEvent) => {
      const pointerX = event.clientX - pointerSession.startX;
      const pointerY = event.clientY - pointerSession.startY;
      pointerMovementRef.current = { x: pointerX, y: pointerY };
      if (pointerSession.type === "drag") {
        const columnWidth = (width - 18 * 11) / 12;
        const desiredX = pointerSession.initial.x + Math.round(pointerX / (columnWidth + 18));
        const desiredY = pointerSession.initial.y + Math.round(pointerY / 42);
        const x = clamp(desiredX, 0, 12 - pointerSession.initial.w);
        const y = clamp(desiredY, 0, preferences.grid.maxRows - pointerSession.initial.h);
        const constrained = x !== desiredX || y !== desiredY;
        constraintReachedRef.current ||= constrained;
        const cloned = desktopLayout.map((item) => ({ ...item }));
        const item = cloned.find((position) => position.i === pointerSession.instanceId);
        if (!item) return;
        const moved = moveElement(cloned, item, x, y, true, false, "vertical", 12, false);
        previewLayout(toDashboardLayout(verticalCompactor.compact(moved, 12)));
        return;
      }

      const columnWidth = (width - 18 * 11) / 12;
      const widthDelta = Math.round(pointerX / (columnWidth + 18));
      const heightDelta = Math.round(pointerY / 42);
      const result = resizePosition(
        pointerSession.initial,
        pointerSession.resizeDirection ?? "se",
        widthDelta,
        heightDelta,
        preferences.grid.maxRows,
      );
      constraintReachedRef.current ||= result.constrained;
      const resized = desktopLayout.map((item) => item.i === pointerSession.instanceId
        ? result.position
        : { ...item });
      previewLayout(toDashboardLayout(verticalCompactor.compact(resized, 12)));
    };
    const finishPointerSession = () => {
      const finalLayout = layoutPreviewRef.current;
      if (finalLayout) onLayoutChange(finalLayout);
      const finalPosition = finalLayout?.find((position) => position.i === pointerSession.instanceId);
      const pointerDistance = Math.hypot(pointerMovementRef.current.x, pointerMovementRef.current.y);
      if (pointerDistance > 12 && finalPosition) {
        const changed = pointerSession.type === "drag"
          ? finalPosition.x !== pointerSession.initial.x || finalPosition.y !== pointerSession.initial.y
          : finalPosition.x !== pointerSession.initial.x || finalPosition.y !== pointerSession.initial.y || finalPosition.w !== pointerSession.initial.w || finalPosition.h !== pointerSession.initial.h;
        if (!changed || constraintReachedRef.current) {
          showGridConstraintToast(
            `${pointerSession.title} no puede continuar en esa dirección.`,
            pointerSession.type === "resize"
              ? "Se mantuvo el tamaño mínimo que conserva el contenido completo."
              : "Se mantuvo la última posición disponible; puedes moverlo en otra dirección.",
          );
        }
      }
      layoutPreviewRef.current = null;
      pointerMovementRef.current = { x: 0, y: 0 };
      constraintReachedRef.current = false;
      setLayoutPreview(null);
      setPointerSession(null);
    };
    const cancelPointerSession = () => {
      layoutPreviewRef.current = null;
      pointerMovementRef.current = { x: 0, y: 0 };
      constraintReachedRef.current = false;
      setLayoutPreview(null);
      setPointerSession(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPointerSession, { once: true });
    window.addEventListener("pointercancel", cancelPointerSession, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerSession);
      window.removeEventListener("pointercancel", cancelPointerSession);
    };
  }, [desktopLayout, onLayoutChange, pointerSession, preferences.grid.maxRows, previewLayout, width]);

  const startPointerSession = (
    type: PointerSession["type"],
    instanceId: string,
    title: string,
    event: React.PointerEvent<HTMLElement>,
    resizeDirection?: DashboardResizeDirection,
  ) => {
    if (event.button !== 0) return;
    const position = desktopLayout.find((item) => item.i === instanceId);
    if (!position) return;
    event.preventDefault();
    layoutPreviewRef.current = desktopLayout;
    pointerMovementRef.current = { x: 0, y: 0 };
    constraintReachedRef.current = false;
    setPointerSession({
      type,
      instanceId,
      startX: event.clientX,
      startY: event.clientY,
      initial: { ...position },
      title,
      resizeDirection,
    });
  };

  const resizeByKeyboard = (instanceId: string, title: string, direction: DashboardResizeDirection, widthDelta: number, heightDelta: number) => {
    const position = desktopLayout.find((item) => item.i === instanceId);
    if (!position) return;
    const result = resizePosition(position, direction, widthDelta, heightDelta, preferences.grid.maxRows);
    if (result.position.x === position.x && result.position.y === position.y && result.position.w === position.w && result.position.h === position.h) {
      showGridConstraintToast(
        `${title} no puede continuar en esa dirección.`,
        "Se mantuvo el tamaño mínimo que conserva el contenido completo.",
      );
      return;
    }
    const resized = desktopLayout.map((item) => item.i === instanceId ? result.position : { ...item });
    onLayoutChange(toDashboardLayout(verticalCompactor.compact(resized, 12)));
  };

  const renderFrame = (widget: DashboardWidgetInstance, index: number) => {
    const definition = getDashboardWidgetDefinition(widget.definitionId);
    const title = widget.config.title || definition.name;
    return (
      <DashboardWidgetFrame
        title={title}
        editing={editing}
        canConfigure={definition.configurable}
        canDuplicate={!definition.singleton}
        showDragHandle={useInteractiveGrid}
        isFirst={index === 0}
        isLast={index === visibleWidgets.length - 1}
        onConfigure={() => onConfigure(widget.instanceId)}
        onDuplicate={() => onDuplicate(widget.instanceId)}
        onHide={() => onHide(widget.instanceId)}
        onRemove={() => setPendingRemoval(widget)}
        onMove={(direction) => onMove(widget.instanceId, direction)}
        onDragStart={(event) => startPointerSession("drag", widget.instanceId, title, event)}
        onResizeStart={(direction, event) => startPointerSession("resize", widget.instanceId, title, event, direction)}
        onResizeStep={(direction, widthDelta, heightDelta) => resizeByKeyboard(widget.instanceId, title, direction, widthDelta, heightDelta)}
      >
        {renderWidget(widget)}
      </DashboardWidgetFrame>
    );
  };

  return (
    <div
      ref={containerRef}
      className="nc-dashboard-editable-grid-shell"
      data-editing={editing || undefined}
      data-dragging={pointerSession?.type === "drag" || undefined}
      data-resizing={pointerSession?.type === "resize" || undefined}
      style={preferences.grid.rowsMode === "manual"
        ? { minHeight: preferences.grid.minRows * 42 - 18 }
        : undefined}
    >
      {visibleWidgets.length === 0 ? (
        <div className="nc-dashboard-editable-grid__empty">
          <strong>Tu dashboard está vacío</strong>
          <span>Agrega widgets desde la biblioteca para construir tu vista.</span>
        </div>
      ) : mounted && useInteractiveGrid ? (
        <GridLayout
          width={width}
          layout={renderedLayout}
          gridConfig={{
            cols: 12,
            rowHeight: 24,
            margin: [18, 18],
            containerPadding: [0, 0],
            maxRows: preferences.grid.maxRows,
          }}
          dragConfig={{ enabled: false }}
          resizeConfig={{ enabled: false }}
          compactor={verticalCompactor}
          className="nc-dashboard-editable-grid"
        >
          {visibleWidgets.map((widget, index) => (
            <div
              key={widget.instanceId}
              data-dashboard-widget-id={widget.instanceId}
              data-highlighted={highlightedWidgetId === widget.instanceId || undefined}
            >
              {renderFrame(widget, index)}
            </div>
          ))}
        </GridLayout>
      ) : (
        <div className="nc-dashboard-editable-grid nc-dashboard-editable-grid--stacked">
          {visibleWidgets.map((widget, index) => (
            <div
              key={widget.instanceId}
              className="nc-dashboard-editable-grid__stacked-item"
              data-widget-kind={getDashboardWidgetDefinition(widget.definitionId).kind}
              data-dashboard-widget-id={widget.instanceId}
              data-highlighted={highlightedWidgetId === widget.instanceId || undefined}
            >
              {renderFrame(widget, index)}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title="¿Eliminar este widget?"
        description={pendingRemoval
          ? `${getDashboardWidgetDefinition(pendingRemoval.definitionId).name} dejará de aparecer en el dashboard. Podrás agregarlo nuevamente desde la biblioteca.`
          : undefined}
        confirmLabel="Eliminar widget"
        onConfirm={() => {
          if (pendingRemoval) onRemove(pendingRemoval.instanceId);
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
