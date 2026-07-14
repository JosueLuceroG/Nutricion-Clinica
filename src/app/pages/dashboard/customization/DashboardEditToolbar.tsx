import { Check, LayoutGrid, Library, Minus, Plus, RotateCcw, X } from "lucide-react";

interface DashboardEditToolbarProps {
  dirty: boolean;
  rowsMode: "auto" | "manual";
  minRows: number;
  onOpenLibrary: () => void;
  onOpenPresets: () => void;
  onReset: () => void;
  onRowsModeChange: (mode: "auto" | "manual") => void;
  onAdjustRows: (delta: -1 | 1) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function DashboardEditToolbar({
  dirty,
  rowsMode,
  minRows,
  onOpenLibrary,
  onOpenPresets,
  onReset,
  onRowsModeChange,
  onAdjustRows,
  onCancel,
  onSave,
}: DashboardEditToolbarProps) {
  return (
    <section className="nc-dashboard-edit-toolbar" aria-label="Edición del dashboard">
      <div className="nc-dashboard-edit-toolbar__status">
        <span><LayoutGrid size={17} aria-hidden="true" /></span>
        <div>
          <strong>Editando dashboard</strong>
          <small>{dirty ? "Tienes cambios sin guardar" : "Acomoda y configura tus widgets"}</small>
        </div>
      </div>
      <div className="nc-dashboard-edit-toolbar__actions">
        <button type="button" onClick={onOpenLibrary}>
          <Library size={16} aria-hidden="true" /> Agregar widgets
        </button>
        <button type="button" onClick={onOpenPresets}>Plantillas</button>
        <span className="nc-dashboard-edit-toolbar__rows">
          <button type="button" onClick={() => onAdjustRows(-1)} disabled={rowsMode === "auto"} aria-label="Quitar una fila vacía">
            <Minus size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onRowsModeChange(rowsMode === "auto" ? "manual" : "auto")}>
            Filas: {rowsMode === "auto" ? "Auto" : minRows}
          </button>
          <button type="button" onClick={() => onAdjustRows(1)} aria-label="Agregar una fila">
            <Plus size={14} aria-hidden="true" />
          </button>
        </span>
        <button type="button" onClick={onReset}>
          <RotateCcw size={16} aria-hidden="true" /> Restaurar
        </button>
        <button type="button" onClick={onCancel}>
          <X size={16} aria-hidden="true" /> Cancelar
        </button>
        <button type="button" className="nc-dashboard-edit-toolbar__save" onClick={onSave}>
          <Check size={16} aria-hidden="true" /> Guardar
        </button>
      </div>
    </section>
  );
}
