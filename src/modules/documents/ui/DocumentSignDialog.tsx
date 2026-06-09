import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";

interface DocumentSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle?: string;
  documentType?: string;
  onSigned: () => Promise<void>;
}

export function DocumentSignDialog({ open, onOpenChange, documentId, documentTitle, documentType, onSigned }: DocumentSignDialogProps) {
  const { t } = useTranslation();
  const [signing, setSigning] = React.useState(false);
  const [signed, setSigned] = React.useState(false);

  React.useEffect(() => {
    if (open) setSigned(false);
  }, [open]);

  const handleSign = async () => {
    setSigning(true);
    try {
      await onSigned();
      setSigned(true);
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t("documents.sign_dialog.title")}</DialogTitle>
          <DialogDescription>
            {signed
              ? t("documents.sign_dialog.signed_message")
              : t("documents.sign_dialog.confirm_message", { title: documentTitle ?? documentId })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {documentType && (
            <p className="text-sm text-muted-foreground">
              {t("documents.sign_dialog.type_label")} <span className="font-medium">{documentType}</span>
            </p>
          )}
          {signed ? (
            <div className="flex justify-end gap-2">
              <Button onClick={() => onOpenChange(false)}>{t("documents.sign_dialog.close")}</Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("documents.sign_dialog.cancel")}</Button>
              <Button onClick={handleSign} disabled={signing}>
                {signing ? t("documents.sign_dialog.signing") : t("documents.sign_dialog.sign")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
