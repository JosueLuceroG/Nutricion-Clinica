import * as React from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, Info, Stethoscope, AlertCircle } from "lucide-react";
import { Button } from "@components/ui/button";
import { useUIStore } from "@store/uiStore";
import { cn } from "@utils/cn";

export function ContextPanel() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.contextPanelOpen);
  const setOpen = useUIStore((s) => s.setContextPanelOpen);
  const location = useLocation();

  const ctx = React.useMemo(() => {
    if (location.pathname.startsWith("/pacientes")) {
      return {
        title: t("layout.context_patient_title"),
        description: t("layout.context_patient_desc"),
        icon: Stethoscope,
      };
    }
    if (location.pathname.startsWith("/consultas")) {
      return {
        title: t("layout.context_smae_title"),
        description: t("layout.context_smae_desc"),
        icon: Info,
      };
    }
    return {
      title: t("layout.context_title"),
      description: t("layout.context_desc"),
      icon: Info,
    };
  }, [location.pathname, t]);

  if (!open) return null;
  const Icon = ctx.icon;

  return (
    <aside
      className="hidden w-80 shrink-0 flex-col border-l bg-muted/20 lg:flex"
      aria-label={t("layout.context_panel")}
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
          aria-label={t("layout.close_context_panel")}
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
          <span>{t("layout.offline_hint")}</span>
        </div>
      </div>
    </aside>
  );
}
