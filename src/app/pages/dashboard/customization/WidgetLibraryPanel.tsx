import * as React from "react";
import { createPortal } from "react-dom";
import { Blocks, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { DASHBOARD_WIDGET_DEFINITIONS, DASHBOARD_WIDGET_ICONS } from "./dashboardWidgetRegistry";
import type { CustomKpiConfig, DashboardWidgetCategory, DashboardWidgetDefinition, DashboardWidgetDefinitionId, DashboardWidgetInstance } from "./dashboardWidgetTypes";

interface WidgetLibraryPanelProps {
  open: boolean;
  widgets: DashboardWidgetInstance[];
  customKpis: CustomKpiConfig[];
  canUseDefinition: (definition: DashboardWidgetDefinition) => boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (definitionId: DashboardWidgetDefinitionId, customKpiId?: string) => void;
  onCreateCustom: () => void;
  onEditCustom: (customKpiId: string) => void;
  onDeleteCustom: (customKpiId: string) => void;
}

interface LibraryDragSession {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: { x: number; y: number };
  initialRect: DOMRect;
}

type LibraryResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

interface LibraryResizeSession {
  pointerId: number;
  direction: LibraryResizeDirection;
  startX: number;
  startY: number;
  startOffset: { x: number; y: number };
  initialRect: DOMRect;
}

const libraryResizeHandles: Array<{ direction: LibraryResizeDirection; label: string }> = [
  { direction: "n", label: "arriba" },
  { direction: "ne", label: "esquina superior derecha" },
  { direction: "e", label: "derecha" },
  { direction: "se", label: "esquina inferior derecha" },
  { direction: "s", label: "abajo" },
  { direction: "sw", label: "esquina inferior izquierda" },
  { direction: "w", label: "izquierda" },
  { direction: "nw", label: "esquina superior izquierda" },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

const categories: Array<{ id: "all" | DashboardWidgetCategory; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "general", label: "Generales" },
  { id: "patients", label: "Pacientes" },
  { id: "consultations", label: "Consultas" },
  { id: "payments", label: "Pagos" },
  { id: "agenda", label: "Agenda" },
  { id: "plans", label: "Planes" },
  { id: "alerts", label: "Alertas" },
  { id: "activity", label: "Actividad" },
  { id: "finance", label: "Finanzas" },
  { id: "quickActions", label: "Accesos rápidos" },
  { id: "system", label: "Sistema" },
  { id: "custom", label: "Creados" },
];

export function WidgetLibraryPanel({
  open,
  widgets,
  customKpis,
  canUseDefinition,
  onOpenChange,
  onAdd,
  onCreateCustom,
  onEditCustom,
  onDeleteCustom,
}: WidgetLibraryPanelProps) {
  const [category, setCategory] = React.useState<"all" | DashboardWidgetCategory>("all");
  const [query, setQuery] = React.useState("");
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [panelSize, setPanelSize] = React.useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [resizing, setResizing] = React.useState<LibraryResizeDirection | null>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const dragSessionRef = React.useRef<LibraryDragSession | null>(null);
  const resizeSessionRef = React.useRef<LibraryResizeSession | null>(null);
  const categoriesRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = React.useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = React.useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
  const definitions = DASHBOARD_WIDGET_DEFINITIONS.filter((definition) => {
    if (definition.id === "customKpi") return false;
    if (!canUseDefinition(definition)) return false;
    if (category !== "all" && category !== definition.category) return false;
    if (!normalizedQuery) return true;
    return `${definition.name} ${definition.description}`.toLocaleLowerCase("es-MX").includes(normalizedQuery);
  });
  const visibleCustomKpis = customKpis.filter((customKpi) => {
    if (category !== "all" && category !== "custom" && category !== customKpi.category) return false;
    if (!normalizedQuery) return true;
    return `${customKpi.name} ${customKpi.description}`.toLocaleLowerCase("es-MX").includes(normalizedQuery);
  });
  const activeWidgetCount = widgets.filter((widget) => !widget.hidden).length;
  const resultCount = definitions.length + visibleCustomKpis.length;

  React.useEffect(() => {
    if (open) return;
    dragSessionRef.current = null;
    resizeSessionRef.current = null;
    setDragOffset({ x: 0, y: 0 });
    setPanelSize(null);
    setDragging(false);
    setResizing(null);
  }, [open]);

  const closeAndCreate = () => {
    onOpenChange(false);
    window.setTimeout(onCreateCustom, 0);
  };

  const updateCategoryScrollState = React.useCallback(() => {
    const scroller = categoriesRef.current;
    if (!scroller) return;
    setCanScrollCategoriesLeft(scroller.scrollLeft > 1);
    setCanScrollCategoriesRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updateCategoryScrollState);
    const scroller = categoriesRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new ResizeObserver(updateCategoryScrollState);
    observer.observe(scroller);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open, updateCategoryScrollState]);

  React.useEffect(() => {
    if (!open) return;
    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== "k") return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const fitPanelToViewport = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const maximumWidth = window.innerWidth - 16;
      const maximumHeight = window.innerHeight - 16;
      const width = Math.min(rect.width, maximumWidth);
      const height = Math.min(rect.height, maximumHeight);
      const left = clamp(rect.left, 8, window.innerWidth - 8 - width);
      const top = clamp(rect.top, 8, window.innerHeight - 8 - height);
      const baseCenterX = rect.left + rect.width / 2 - dragOffset.x;
      const baseBottom = rect.bottom - dragOffset.y;
      if (width !== rect.width || height !== rect.height) setPanelSize({ width, height });
      if (left !== rect.left || top !== rect.top || width !== rect.width || height !== rect.height) {
        setDragOffset({
          x: left - baseCenterX + width / 2,
          y: top - baseBottom + height,
        });
      }
    };
    const frame = window.requestAnimationFrame(fitPanelToViewport);
    window.addEventListener("resize", fitPanelToViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", fitPanelToViewport);
    };
  }, [dragOffset.x, dragOffset.y, open]);

  const scrollCategories = (direction: -1 | 1) => {
    categoriesRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  };

  const updateDragPosition = (clientX: number, clientY: number) => {
    const session = dragSessionRef.current;
    if (!session) return;
    const desiredX = session.startOffset.x + clientX - session.startX;
    const desiredY = session.startOffset.y + clientY - session.startY;
    const minimumX = session.startOffset.x + 8 - session.initialRect.left;
    const maximumX = session.startOffset.x + window.innerWidth - 8 - session.initialRect.right;
    const minimumY = session.startOffset.y + 8 - session.initialRect.top;
    const maximumY = session.startOffset.y + window.innerHeight - 8 - session.initialRect.bottom;
    setDragOffset({
      x: Math.max(minimumX, Math.min(maximumX, desiredX)),
      y: Math.max(minimumY, Math.min(maximumY, desiredY)),
    });
  };

  const moveWithKeyboard = (horizontal: number, vertical: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    setDragOffset((current) => ({
      x: current.x + Math.max(8 - rect.left, Math.min(window.innerWidth - 8 - rect.right, horizontal)),
      y: current.y + Math.max(8 - rect.top, Math.min(window.innerHeight - 8 - rect.bottom, vertical)),
    }));
  };

  const applyResize = (session: LibraryResizeSession, clientX: number, clientY: number) => {
    const deltaX = clientX - session.startX;
    const deltaY = clientY - session.startY;
    const minimumWidth = Math.min(420, window.innerWidth - 16);
    const minimumHeight = Math.min(300, window.innerHeight - 16);
    let width = session.initialRect.width;
    let height = session.initialRect.height;
    let left = session.initialRect.left;
    let top = session.initialRect.top;

    if (session.direction.includes("e")) {
      width = clamp(session.initialRect.width + deltaX, minimumWidth, window.innerWidth - 8 - session.initialRect.left);
    }
    if (session.direction.includes("w")) {
      width = clamp(session.initialRect.width - deltaX, minimumWidth, session.initialRect.right - 8);
      left = session.initialRect.right - width;
    }
    if (session.direction.includes("s")) {
      height = clamp(session.initialRect.height + deltaY, minimumHeight, window.innerHeight - 8 - session.initialRect.top);
    }
    if (session.direction.includes("n")) {
      height = clamp(session.initialRect.height - deltaY, minimumHeight, session.initialRect.bottom - 8);
      top = session.initialRect.bottom - height;
    }

    const baseCenterX = session.initialRect.left + session.initialRect.width / 2 - session.startOffset.x;
    const baseBottom = session.initialRect.bottom - session.startOffset.y;
    setPanelSize({ width, height });
    setDragOffset({
      x: left - baseCenterX + width / 2,
      y: top - baseBottom + height,
    });
  };

  const resizeWithKeyboard = (direction: LibraryResizeDirection, horizontal: number, vertical: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    applyResize({
      pointerId: -1,
      direction,
      startX: 0,
      startY: 0,
      startOffset: dragOffset,
      initialRect: panel.getBoundingClientRect(),
    }, horizontal, vertical);
  };

  if (!open) return null;

  return createPortal(
    <section
      ref={panelRef}
      className="nc-dashboard-widget-library"
      role="region"
      aria-labelledby="dashboard-widget-library-title"
      aria-describedby="dashboard-widget-library-description"
      data-dragging={dragging || undefined}
      data-resizing={resizing || undefined}
      style={{
        "--nc-library-drag-x": `${dragOffset.x}px`,
        "--nc-library-drag-y": `${dragOffset.y}px`,
        ...(panelSize ? { width: `${panelSize.width}px`, height: `${panelSize.height}px` } : {}),
      } as React.CSSProperties}
    >
      <button
        type="button"
        className="nc-dashboard-widget-library__grabber"
        aria-label="Mover biblioteca de widgets"
        title="Arrastrar biblioteca"
        onPointerDown={(event) => {
          if (event.button !== 0 || !panelRef.current) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragSessionRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startOffset: dragOffset,
            initialRect: panelRef.current.getBoundingClientRect(),
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (dragSessionRef.current?.pointerId === event.pointerId) updateDragPosition(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (dragSessionRef.current?.pointerId !== event.pointerId) return;
          dragSessionRef.current = null;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragSessionRef.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          const distance = event.shiftKey ? 48 : 16;
          if (event.key === "ArrowLeft") moveWithKeyboard(-distance, 0);
          else if (event.key === "ArrowRight") moveWithKeyboard(distance, 0);
          else if (event.key === "ArrowUp") moveWithKeyboard(0, -distance);
          else if (event.key === "ArrowDown") moveWithKeyboard(0, distance);
          else return;
          event.preventDefault();
        }}
      />
      <div className="nc-dashboard-widget-library__header">
        <div className="nc-dashboard-widget-library__titleBlock">
          <span className="nc-dashboard-widget-library__eyebrow"><Blocks size={13} aria-hidden="true" /><span>Panel de inserción</span></span>
          <h2 id="dashboard-widget-library-title">Biblioteca de widgets</h2>
          <p id="dashboard-widget-library-description">Agrega métricas y herramientas a tu dashboard.</p>
        </div>

        <div className="nc-dashboard-widget-library__controls">
          <label className="nc-dashboard-widget-library__search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar widgets"
              aria-label="Buscar widgets"
            />
          </label>

          <div className="nc-dashboard-widget-library__categoryNav">
            <button
              type="button"
              className="nc-dashboard-widget-library__categoryArrow"
              onClick={() => scrollCategories(-1)}
              disabled={!canScrollCategoriesLeft}
              aria-label="Ver categorías anteriores"
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <div
              ref={categoriesRef}
              className="nc-dashboard-widget-library__categories"
              role="group"
              aria-label="Categorías de widgets"
              onScroll={updateCategoryScrollState}
              onWheel={(event) => {
                if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                event.currentTarget.scrollLeft += event.deltaY;
              }}
            >
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  data-active={category === item.id || undefined}
                  onClick={(event) => {
                    setCategory(item.id);
                    event.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="nc-dashboard-widget-library__categoryArrow"
              onClick={() => scrollCategories(1)}
              disabled={!canScrollCategoriesRight}
              aria-label="Ver más categorías"
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="nc-dashboard-widget-library__headerActions">
          <span className="nc-dashboard-widget-library__activeCount"><strong>{activeWidgetCount}</strong> activos</span>
          <button type="button" className="nc-dashboard-widget-library__create" onClick={closeAndCreate}>
            <Sparkles size={16} aria-hidden="true" /> Crear KPI
          </button>
          <button type="button" className="nc-dashboard-widget-library__close" onClick={() => onOpenChange(false)} aria-label="Cerrar">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="nc-dashboard-widget-library__resultMeta" aria-live="polite">
        <span>{category === "all" ? "Colección disponible" : categories.find((item) => item.id === category)?.label}</span>
        <small>{resultCount} {resultCount === 1 ? "resultado" : "resultados"}</small>
      </div>

      <div className="nc-dashboard-widget-library__grid">
        {visibleCustomKpis.map((customKpi) => {
          const Icon = DASHBOARD_WIDGET_ICONS[customKpi.iconKey] ?? Sparkles;
          const existing = widgets.find((widget) => widget.config.customKpiId === customKpi.id);
          const added = Boolean(existing && !existing.hidden);
          return (
            <article key={customKpi.id} className="nc-dashboard-widget-library__item" data-added={added || undefined}>
              <span className="nc-dashboard-widget-library__icon" data-tone={customKpi.tone}><Icon size={20} aria-hidden="true" /></span>
              <div><strong>{customKpi.name}</strong><p>{customKpi.description || "KPI personalizado"}</p></div>
              <span className="nc-dashboard-widget-library__itemActions">
                <button type="button" onClick={() => onEditCustom(customKpi.id)} aria-label={`Editar ${customKpi.name}`}>
                  <Pencil size={15} aria-hidden="true" />
                </button>
                <button type="button" className="nc-dashboard-widget-library__delete" onClick={() => onDeleteCustom(customKpi.id)} aria-label={`Eliminar ${customKpi.name}`}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
                <button type="button" disabled={added} onClick={() => onAdd("customKpi", customKpi.id)} aria-label={`Agregar ${customKpi.name}`}>
                  {added ? <Check size={16} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
                </button>
              </span>
            </article>
          );
        })}

        {category !== "custom" && definitions.map((definition) => {
          const Icon = DASHBOARD_WIDGET_ICONS[definition.iconKey] ?? Sparkles;
          const existing = widgets.find((widget) => widget.definitionId === definition.id);
          const added = Boolean(definition.singleton && existing && !existing.hidden);
          return (
            <article key={definition.id} className="nc-dashboard-widget-library__item" data-added={added || undefined}>
              <span className="nc-dashboard-widget-library__icon" data-tone={definition.tone}><Icon size={20} aria-hidden="true" /></span>
              <div>
                <strong>{definition.name}</strong>
                <p>{definition.description}</p>
                <small>{definition.defaultSize.preset === "small" ? "KPI compacto" : "Widget adaptable"}</small>
              </div>
              <button type="button" disabled={added} onClick={() => onAdd(definition.id)} aria-label={`Agregar ${definition.name}`}>
                {added ? <Check size={16} /> : <Plus size={17} />}
              </button>
            </article>
          );
        })}

        {definitions.length === 0 && visibleCustomKpis.length === 0 && (
          <div className="nc-dashboard-widget-library__empty">No hay widgets que coincidan con esta búsqueda.</div>
        )}
      </div>
      {libraryResizeHandles.map(({ direction, label }) => (
        <span
          key={direction}
          className={`nc-dashboard-widget-library__resize nc-dashboard-widget-library__resize--${direction}`}
          role="separator"
          tabIndex={0}
          aria-label={`Cambiar tamaño de biblioteca desde ${label}`}
          onPointerDown={(event) => {
            if (event.button !== 0 || !panelRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeSessionRef.current = {
              pointerId: event.pointerId,
              direction,
              startX: event.clientX,
              startY: event.clientY,
              startOffset: dragOffset,
              initialRect: panelRef.current.getBoundingClientRect(),
            };
            setResizing(direction);
          }}
          onPointerMove={(event) => {
            const session = resizeSessionRef.current;
            if (session?.pointerId === event.pointerId) applyResize(session, event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if (resizeSessionRef.current?.pointerId !== event.pointerId) return;
            resizeSessionRef.current = null;
            setResizing(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            resizeSessionRef.current = null;
            setResizing(null);
          }}
          onKeyDown={(event) => {
            const distance = event.shiftKey ? 48 : 16;
            if (event.key === "ArrowLeft") resizeWithKeyboard(direction, -distance, 0);
            else if (event.key === "ArrowRight") resizeWithKeyboard(direction, distance, 0);
            else if (event.key === "ArrowUp") resizeWithKeyboard(direction, 0, -distance);
            else if (event.key === "ArrowDown") resizeWithKeyboard(direction, 0, distance);
            else return;
            event.preventDefault();
          }}
        />
      ))}
    </section>,
    document.body,
  );
}
