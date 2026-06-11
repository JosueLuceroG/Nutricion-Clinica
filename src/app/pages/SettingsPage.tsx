import * as React from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload, Lock, ShieldAlert, Sparkles, Palette, Globe, Calendar, DollarSign, Hash } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { useUIStore } from "@store/uiStore";
import { usePreferencesStore } from "@store/preferencesStore";
import { backupService } from "@services/backup/backupService";

type PasswordMode = "export" | "import" | null;

function PreferencesCard() {
  const { t, i18n } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const { language, dateFormat, currency, decimalPlaces, setLanguage, setDateFormat, setCurrency, setDecimalPlaces } = usePreferencesStore();

  const handleLanguageChange = (value: string) => {
    setLanguage(value as "es-MX" | "en-US");
    void i18n.changeLanguage(value);
  };

  const themes = [
    { value: "light", label: "Claro", icon: "☀️" },
    { value: "dark", label: "Oscuro", icon: "🌙" },
    { value: "system", label: "Sistema", icon: "💻" },
    { value: "high-contrast", label: "Alto contraste", icon: "♿" },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          {t("settings.preferences")}
        </CardTitle>
        <CardDescription>
          {t("settings.preferences_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Tema</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {themes.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Globe className="h-4 w-4" /> Idioma</Label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="es-MX">Español (MX)</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Formato de fecha</Label>
          <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as typeof dateFormat)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
              <SelectItem value="MM/dd/yyyy">MM/dd/yyyy</SelectItem>
              <SelectItem value="yyyy-MM-dd">yyyy-MM-dd</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Moneda</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MXN">MXN ($)</SelectItem>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Hash className="h-4 w-4" /> Decimales</Label>
          <Select value={String(decimalPlaces)} onValueChange={(v) => setDecimalPlaces(parseInt(v) as 1 | 2)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 decimal</SelectItem>
              <SelectItem value="2">2 decimales</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [passwordMode, setPasswordMode] = React.useState<PasswordMode>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [aiEnabled, setAiEnabled] = React.useState(() => localStorage.getItem("ai-enabled") === "true");

  React.useEffect(() => {
    localStorage.setItem("ai-enabled", String(aiEnabled));
  }, [aiEnabled]);

  const doExport = async (pwd: string | undefined) => {
    setExporting(true);
    try {
      const result = await backupService.exportBackup(pwd);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("settings.backup_exported_size", { size: (result.sizeBytes / 1024).toFixed(1) }));
    } catch (err) {
      toast.error(t("settings.export_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExporting(false);
    }
  };

  const doImport = async (file: File, pwd: string | undefined) => {
    setImporting(true);
    try {
      const result = await backupService.importBackup(file, pwd);
      if (result.success) {
        toast.success(t("settings.backup_restored", { rows: result.rowCount, tables: result.tablesImported.length }));
      } else {
        toast.error(t("settings.import_errors"), {
          description: result.errors.join("\n"),
        });
      }
    } catch (err) {
      toast.error(t("settings.import_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onExportClick = (encrypt: boolean) => {
    if (encrypt) {
      setPasswordMode("export");
      setPassword("");
      setPasswordDialogOpen(true);
    } else {
      void doExport(undefined);
    }
  };

  const onPasswordSubmit = () => {
    if (!password.trim()) {
      toast.error(t("settings.password_required"));
      return;
    }
    setPasswordDialogOpen(false);
    if (passwordMode === "export") {
      void doExport(password);
    } else if (passwordMode === "import" && pendingFile) {
      setConfirmDialogOpen(true);
    }
    setPasswordMode(null);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (file.name.endsWith(".enc")) {
      setPasswordMode("import");
      setPassword("");
      setPasswordDialogOpen(true);
    } else {
      setConfirmDialogOpen(true);
    }
  };

  const onConfirmImport = () => {
    setConfirmDialogOpen(false);
    if (pendingFile) {
      void doImport(pendingFile, fileIsEncrypted(pendingFile) ? password || undefined : undefined);
    }
    setPendingFile(null);
    setPassword("");
  };

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <PageContent>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                {t("settings.data_backup")}
              </CardTitle>
              <CardDescription>
                {t("settings.export_backup_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => onExportClick(false)} disabled={exporting} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                {exporting ? t("settings.exporting") : t("settings.export_plain")}
              </Button>
              <Button onClick={() => onExportClick(true)} disabled={exporting} variant="outline" className="w-full">
                <Lock className="mr-2 h-4 w-4" />
                {exporting ? t("settings.exporting") : t("settings.export_encrypted")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t("settings.restore_backup")}
              </CardTitle>
              <CardDescription>
                {t("settings.restore_backup_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup-password">{t("settings.password_if_encrypted")}</Label>
                <Input
                  id="backup-password"
                  type="password"
                  placeholder={t("settings.password_empty_hint")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.enc"
                onChange={onImportFile}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? t("settings.importing") : t("settings.select_restore_file")}
              </Button>
            </CardContent>
          </Card>

          <PreferencesCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t("ai.title")}
              </CardTitle>
              <CardDescription>{t("ai.enable")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("ai.title")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("ai.enable_desc")}
                  </p>
                </div>
                <Switch
                  checked={aiEnabled}
                  onCheckedChange={setAiEnabled}
                  aria-label={t("ai.title")}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {passwordMode === "export" ? t("settings.encrypt_backup") : t("settings.restore_encrypted_backup")}
            </DialogTitle>
            <DialogDescription>
              {passwordMode === "export" ? t("settings.password_export_desc") : t("settings.password_import_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dialog-password">{t("auth.password")}</Label>
            <Input
              id="dialog-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordDialogOpen(false); setPassword(""); setPendingFile(null); }}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onPasswordSubmit}>{t("common.next")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.replace_data_title")}</DialogTitle>
            <DialogDescription>
              {t("settings.replace_data_desc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={onConfirmImport}>{t("settings.continue_replace")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fileIsEncrypted(file: File): boolean {
  return file.name.endsWith(".enc");
}
