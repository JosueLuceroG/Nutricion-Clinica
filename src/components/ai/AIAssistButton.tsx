import * as React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@components/ui/button";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import type { CapabilityId } from "@services/ai";
import { aiService, getCapabilityDef } from "@services/ai";
import { usePreferencesStore } from "@store/preferencesStore";
import { ConsentService } from "@modules/auth/PatientConsentService";

interface AIAssistButtonProps {
  capability: CapabilityId;
  busy?: boolean;
  disabled?: boolean;
  patientId?: string;
  onClick: () => void;
}

export function AIAssistButton({ capability, busy, disabled, patientId, onClick }: AIAssistButtonProps) {
  const { t } = useTranslation();
  const def = getCapabilityDef(capability);
  const aiEnabled = usePreferencesStore((s) => s.aiEnabled);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [needConsent, setNeedConsent] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!patientId) {
      setNeedConsent(null);
      return;
    }
    ConsentService.isConsentActive(patientId, "ai_opt_in").then(setNeedConsent).catch(() => setNeedConsent(false));
  }, [patientId]);

  const disabledReason: string | undefined = !aiService.isEnvironmentEnabled()
    ? t("ai.disabled_by_environment")
    : !aiEnabled
      ? t("ai.disabled_by_user")
      : patientId && needConsent === false
        ? t("ai.disabled_by_consent")
        : undefined;

  const handleClick = () => {
    if (patientId && needConsent !== false) {
      setConfirmOpen(true);
    } else {
      onClick();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy || Boolean(disabledReason) || needConsent === null}
        onClick={handleClick}
        aria-label={def ? t(def.descriptionKey) : undefined}
        title={disabledReason}
      >
        {busy ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-3 w-3" />
        )}
        {def ? t(def.nameKey) : capability}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("ai.confirm_dialog.title")}
        description={t("ai.confirm_dialog.description")}
        confirmLabel={t("ai.confirm_dialog.confirm")}
        cancelLabel={t("ai.confirm_dialog.cancel")}
        tone="info"
        onConfirm={() => {
          setConfirmOpen(false);
          onClick();
        }}
      />
    </>
  );
}
