import { useTranslation } from "react-i18next";
import { type SaveStatus } from "@hooks/useAutoSave";

const STATUS_CONFIG: Record<SaveStatus, { className: string; i18nKey: string }> = {
  idle: { className: "text-transparent", i18nKey: "" },
  unsaved: { className: "text-amber-500", i18nKey: "save.unsaved" },
  saving: { className: "text-blue-500", i18nKey: "save.saving" },
  saved: { className: "text-green-600", i18nKey: "save.saved" },
  error: { className: "text-destructive", i18nKey: "save.error" },
};

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const { t } = useTranslation();
  if (status === "idle") return null;
  const config = STATUS_CONFIG[status];
  const label = t(config.i18nKey);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.className}`} aria-live="polite">
      <span className="inline-block h-1.5 w-1.5 rounded-full currentColor" />
      {label}
    </span>
  );
}
