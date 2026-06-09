import { useTranslation } from "react-i18next";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@components/ui/button";
import type { CapabilityId } from "@services/ai";
import { getCapabilityDef } from "@services/ai";

interface AIAssistButtonProps {
  capability: CapabilityId;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function AIAssistButton({ capability, busy, disabled, onClick }: AIAssistButtonProps) {
  const { t } = useTranslation();
  const def = getCapabilityDef(capability);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || busy}
      onClick={onClick}
      aria-label={def ? t(def.descriptionKey) : undefined}
    >
      {busy ? (
        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-3 w-3" />
      )}
      {def ? t(def.nameKey) : capability}
    </Button>
  );
}
