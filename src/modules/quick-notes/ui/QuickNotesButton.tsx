import { StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@components/ui/tooltip";
import { useQuickNotesStore } from "@store/quickNotesStore";
import { cn } from "@utils/cn";

interface QuickNotesButtonProps {
  variant?: "standard" | "dashboard";
}

export function QuickNotesButton({
  variant = "standard",
}: QuickNotesButtonProps) {
  const { t } = useTranslation();
  const notes = useQuickNotesStore((state) => state.notes);
  const panelOpen = useQuickNotesStore((state) => state.panelOpen);
  const hydrationStatus = useQuickNotesStore((state) => state.hydrationStatus);
  const togglePanel = useQuickNotesStore((state) => state.togglePanel);
  const activeCount = notes.filter((note) => !note.completed).length;
  const label = t("quick_notes.launcher");

  const commonProps = {
    "aria-controls": "quick-notes-panel",
    "aria-expanded": panelOpen,
    "aria-label":
      variant !== "dashboard" && activeCount > 0
        ? t("quick_notes.launcher_with_count", { count: activeCount })
        : label,
    "data-quick-notes-trigger": "",
    disabled: hydrationStatus !== "ready",
    onClick: togglePanel,
    type: "button" as const,
  };

  const trigger =
    variant === "dashboard" ? (
      <button
        {...commonProps}
        className={cn(
          "nc-dashboard-bottom-chip nc-dashboard-bottom-chip--button nc-dashboard-quick-notes-trigger",
          panelOpen && "nc-dashboard-quick-notes-trigger--active",
        )}
      >
        <StickyNote size={15} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
      </button>
    ) : (
      <Button
        {...commonProps}
        variant="ghost"
        size="sm"
        className={cn(
          "min-h-7 gap-1.5 px-2 text-[10px]",
          panelOpen && "bg-accent text-accent-foreground",
        )}
      >
        <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        {activeCount > 0 && (
          <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-primary/12 px-1 text-[9px] font-bold text-primary">
            {activeCount}
          </span>
        )}
      </Button>
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
