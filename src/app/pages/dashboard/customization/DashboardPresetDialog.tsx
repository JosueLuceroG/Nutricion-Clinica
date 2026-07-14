import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Check, LayoutDashboard } from "lucide-react";
import { DASHBOARD_PRESET_META } from "./dashboardPresets";
import type { DashboardPresetId } from "./dashboardWidgetTypes";

interface DashboardPresetDialogProps {
  open: boolean;
  activePresetId: DashboardPresetId | null;
  onOpenChange: (open: boolean) => void;
  onApply: (presetId: DashboardPresetId) => void;
}

export function DashboardPresetDialog({ open, activePresetId, onOpenChange, onApply }: DashboardPresetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="nc-dashboard-presets">
        <DialogHeader>
          <DialogTitle>Elegir plantilla</DialogTitle>
          <DialogDescription>La plantilla modifica el borrador actual. Se aplicará definitivamente al guardar.</DialogDescription>
        </DialogHeader>
        <div className="nc-dashboard-presets__grid">
          {DASHBOARD_PRESET_META.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={activePresetId === preset.id}
              data-active={activePresetId === preset.id || undefined}
              onClick={() => {
                onApply(preset.id);
                onOpenChange(false);
              }}
            >
              <span><LayoutDashboard size={20} aria-hidden="true" /></span>
              <div><strong>{preset.name}</strong><small>{preset.description}</small></div>
              {activePresetId === preset.id && <Check size={17} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
