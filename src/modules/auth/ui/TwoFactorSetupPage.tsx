import * as React from "react";
import { useTranslation } from "react-i18next";
import { Shield, ShieldOff, Smartphone, AlertCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { twoFactorApi } from "@services/api/twoFactorApi";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Separator } from "@components/ui/separator";
import { cn } from "@utils/cn";

export function TwoFactorSetupPage() {
  const { t } = useTranslation();

  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [setupData, setSetupData] = React.useState<{ secret: string; uri: string; qrCode: string } | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [disableCode, setDisableCode] = React.useState("");
  const [disabling, setDisabling] = React.useState(false);

  React.useEffect(() => {
    void loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { enabled: isEnabled } = await twoFactorApi.status();
      setEnabled(isEnabled);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setError(null);
    try {
      const data = await twoFactorApi.setup();
      setSetupData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar configuraci\u00f3n");
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    setError(null);
    setVerifying(true);
    try {
      await twoFactorApi.enable(setupData.secret, totpCode);
      setEnabled(true);
      setSetupData(null);
      setTotpCode("");
      toast.success(t("auth.2fa_enabled"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "C\u00f3digo inv\u00e1lido");
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDisabling(true);
    try {
      await twoFactorApi.disable(disableCode);
      setEnabled(false);
      setDisableCode("");
      toast.success(t("auth.2fa_disabled"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "C\u00f3digo inv\u00e1lido");
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.secret).then(() => {
      toast.success(t("common.copied"));
    });
  };

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t("common.loading")}</div>
      </PageContent>
    );
  }

  return (
    <>
      <PageHeader title={t("auth.2fa_title")} description={t("auth.2fa_page_desc")} />

      <PageContent>
        <div className="mx-auto max-w-lg space-y-6">
          {error && (
            <div
              role="alert"
              className={cn(
                "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive",
              )}
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {enabled ? <Shield className="h-5 w-5 text-green-500" /> : <ShieldOff className="h-5 w-5 text-muted-foreground" />}
                {enabled ? t("auth.2fa_status_enabled") : t("auth.2fa_status_disabled")}
              </CardTitle>
              <CardDescription>
                {enabled ? t("auth.2fa_enabled_desc") : t("auth.2fa_disabled_desc")}
              </CardDescription>
            </CardHeader>
          </Card>

          {enabled ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("auth.2fa_disable_title")}</CardTitle>
                <CardDescription>{t("auth.2fa_disable_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDisable} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="disable-totp">{t("auth.2fa_code")}</Label>
                    <Input
                      id="disable-totp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      className="text-center text-lg tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                  <Button type="submit" variant="destructive" className="w-full" disabled={disabling || disableCode.length !== 6}>
                    {disabling ? t("auth.disabling") : t("auth.2fa_disable_button")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : !setupData ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  {t("auth.2fa_setup_title")}
                </CardTitle>
                <CardDescription>{t("auth.2fa_setup_desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleSetup} className="w-full">
                  {t("auth.2fa_setup_button")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  {t("auth.2fa_scan_title")}
                </CardTitle>
                <CardDescription>{t("auth.2fa_scan_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(setupData.qrCode)}`}
                    alt={t("auth.2fa_qr_alt")}
                    className="h-48 w-48 rounded-lg border"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("auth.2fa_secret")}</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs font-mono">{setupData.secret}</code>
                    <Button variant="outline" size="sm" onClick={copySecret} aria-label={t("common.copy")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <form onSubmit={handleEnable} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="enable-totp">{t("auth.2fa_verify_code")}</Label>
                    <Input
                      id="enable-totp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      className="text-center text-lg tracking-widest"
                      placeholder="000000"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={verifying || totpCode.length !== 6}>
                    {verifying ? t("auth.verifying") : t("auth.2fa_enable_button")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>
    </>
  );
}
