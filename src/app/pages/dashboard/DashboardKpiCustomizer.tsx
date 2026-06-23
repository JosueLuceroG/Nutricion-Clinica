import * as React from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { DashboardPremiumKpiId } from "@store/preferencesStore";
import type { DashboardKpiItem } from "./dashboardMockData";

interface DashboardKpiCustomizerProps {
  open: boolean;
  items: DashboardKpiItem[];
  hiddenIds: DashboardPremiumKpiId[];
  onClose: () => void;
  onMove: (id: DashboardPremiumKpiId, direction: -1 | 1) => void;
  onToggle: (id: DashboardPremiumKpiId) => void;
  onReset: () => void;
}

export function DashboardKpiCustomizer({
  open,
  items,
  hiddenIds,
  onClose,
  onMove,
  onToggle,
  onReset,
}: DashboardKpiCustomizerProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const hidden = new Set(hiddenIds);
  const visibleCount = items.filter((item) => !hidden.has(item.id)).length;

  return (
    <div className="nc-dashboard-kpi-customizer" role="dialog" aria-modal="true" aria-labelledby="nc-dashboard-kpi-customizer-title">
      <button type="button" className="nc-dashboard-kpi-customizer__backdrop" onClick={onClose} aria-label="Cerrar personalización de KPIs" />

      <section className="nc-dashboard-kpi-customizer__panel">
        <header className="nc-dashboard-kpi-customizer__header">
          <span className="nc-dashboard-kpi-customizer__icon" aria-hidden="true">
            <SlidersHorizontal size={20} strokeWidth={2} />
          </span>
          <span>
            <h2 id="nc-dashboard-kpi-customizer-title">Personalizar KPIs</h2>
            <p>Reordena u oculta las métricas principales del dashboard.</p>
          </span>
          <button type="button" className="nc-dashboard-kpi-customizer__close" onClick={onClose} aria-label="Cerrar">
            <X size={19} strokeWidth={2} />
          </button>
        </header>

        <div className="nc-dashboard-kpi-customizer__list" aria-label="KPIs disponibles">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isHidden = hidden.has(item.id);
            const hidingLastVisible = !isHidden && visibleCount <= 1;

            return (
              <article key={item.id} className={`nc-dashboard-kpi-customizer__item${isHidden ? " nc-dashboard-kpi-customizer__item--hidden" : ""}`}>
                <span className={`nc-dashboard-kpi-customizer__metricIcon nc-dashboard-kpi-customizer__metricIcon--${item.tone}`} aria-hidden="true">
                  <Icon size={21} strokeWidth={1.9} />
                </span>

                <span className="nc-dashboard-kpi-customizer__metricText">
                  <strong>{item.label}</strong>
                  <small>{isHidden ? "Oculto" : item.hint}</small>
                </span>

                <span className="nc-dashboard-kpi-customizer__controls">
                  <button type="button" onClick={() => onMove(item.id, -1)} disabled={index === 0} aria-label={`Subir ${item.label}`}>
                    <ArrowUp size={16} strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => onMove(item.id, 1)} disabled={index === items.length - 1} aria-label={`Bajar ${item.label}`}>
                    <ArrowDown size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="nc-dashboard-kpi-customizer__visibility"
                    onClick={() => onToggle(item.id)}
                    disabled={hidingLastVisible}
                    aria-pressed={!isHidden}
                    aria-label={isHidden ? `Mostrar ${item.label}` : `Ocultar ${item.label}`}
                  >
                    {isHidden ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                    <span>{isHidden ? "Mostrar" : "Visible"}</span>
                  </button>
                </span>
              </article>
            );
          })}
        </div>

        <footer className="nc-dashboard-kpi-customizer__footer">
          <button type="button" className="nc-dashboard-kpi-customizer__reset" onClick={onReset}>
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            Restaurar orden
          </button>
          <button type="button" className="nc-dashboard-kpi-customizer__done" onClick={onClose}>
            Listo
          </button>
        </footer>
      </section>
    </div>
  );
}
