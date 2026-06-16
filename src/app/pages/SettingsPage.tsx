import * as React from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload, Lock, ShieldAlert, Sparkles, Palette, Globe, Calendar, DollarSign, Hash, Stethoscope, LayoutDashboard, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { Checkbox } from "@components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { useUIStore } from "@store/uiStore";
import { usePreferencesStore, DEFAULT_CLINICAL_SECTION_IDS, DEFAULT_DASHBOARD_WIDGET_IDS, type ClinicalSectionId } from "@store/preferencesStore";
import { WIDGET_DEFINITIONS } from "@app/hooks/dashboardWidgetConfig";
import { backupService } from "@services/backup/backupService";
import { aiService } from "@services/ai";
import { RequireRole } from "@modules/auth/RequireRole";
import { authApi } from "@services/api/authApi";
import { ALL_ROLES, type Role } from "@nutriclinica/shared";
import { PriceCatalogDialog } from "@modules/pricing/ui/PriceCatalogDialog";

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

function WorkspaceCard() {
  const { t } = useTranslation();
  const {
    usageMode,
    subscriptionPlan,
    pdfBrandingEnabled,
    clinicDisplayName,
    setUsageMode,
    setSubscriptionPlan,
    setPdfBrandingEnabled,
    setClinicDisplayName,
  } = usePreferencesStore();

  const handlePlanChange = (value: string) => {
    const plan = value as typeof subscriptionPlan;
    setSubscriptionPlan(plan);
    if (plan === "free") setPdfBrandingEnabled(true);
  };

  const effectivePdfBranding = subscriptionPlan === "free" || pdfBrandingEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          {t("settings.workspace_title")}
        </CardTitle>
        <CardDescription>
          {t("settings.workspace_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{t("settings.usage_mode")}</Label>
          <Select value={usageMode} onValueChange={(value) => setUsageMode(value as typeof usageMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t("settings.usage_mode_normal")}</SelectItem>
              <SelectItem value="beginner">{t("settings.usage_mode_beginner")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("settings.usage_mode_hint")}
          </p>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {usageMode === "beginner" ? t("settings.usage_mode_beginner") : t("settings.usage_mode_normal")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {usageMode === "beginner" ? t("settings.usage_mode_beginner_desc") : t("settings.usage_mode_normal_desc")}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("settings.plan")}</Label>
          <Select value={subscriptionPlan} onValueChange={handlePlanChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">{t("settings.plan_free")}</SelectItem>
              <SelectItem value="premium">{t("settings.plan_premium")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clinic-display-name">{t("settings.clinic_display_name")}</Label>
          <Input
            id="clinic-display-name"
            value={clinicDisplayName}
            onChange={(event) => setClinicDisplayName(event.target.value)}
            placeholder="NutriClinica"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label>{t("settings.pdf_platform_branding")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("settings.pdf_platform_branding_desc")}
            </p>
          </div>
          <Switch
            checked={effectivePdfBranding}
            disabled={subscriptionPlan === "free"}
            onCheckedChange={setPdfBrandingEnabled}
            aria-label={t("settings.pdf_platform_branding")}
          />
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
  const aiEnabled = usePreferencesStore((s) => s.aiEnabled);
  const setAiEnabled = usePreferencesStore((s) => s.setAiEnabled);
  const aiProvider = usePreferencesStore((s) => s.aiProvider);
  const setAiProvider = usePreferencesStore((s) => s.setAiProvider);
  const openAiApiKey = usePreferencesStore((s) => s.openAiApiKey);
  const setOpenAiApiKey = usePreferencesStore((s) => s.setOpenAiApiKey);
  const openAiModel = usePreferencesStore((s) => s.openAiModel);
  const setOpenAiModel = usePreferencesStore((s) => s.setOpenAiModel);
  const aiEnvironmentEnabled = aiService.isEnvironmentEnabled();

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

          <WorkspaceCard />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t("ai.title")}
              </CardTitle>
              <CardDescription>{t("ai.enable")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t("ai.title")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("ai.enable_desc")}
                  </p>
                  <p className={`mt-1 text-xs ${aiEnvironmentEnabled ? "text-muted-foreground" : "text-amber-600"}`}>
                    {aiEnvironmentEnabled
                      ? (aiEnabled ? t("ai.enabled_for_user") : t("ai.disabled_by_user"))
                      : t("ai.disabled_by_environment")}
                  </p>
                </div>
                <Switch
                  checked={aiEnabled}
                  onCheckedChange={setAiEnabled}
                  aria-label={t("ai.title")}
                />
              </div>

              {aiEnabled && aiEnvironmentEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>{t("ai.provider")}</Label>
                    <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as "ollama" | "openai")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">Ollama (local, gratuito)</SelectItem>
                        <SelectItem value="openai">OpenAI (ChatGPT, requiere API key)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {aiProvider === "openai" && (
                    <>
                      <div className="space-y-2">
                        <Label>{t("ai.api_key")}</Label>
                        <Input
                          type="password"
                          value={openAiApiKey}
                          onChange={(e) => setOpenAiApiKey(e.target.value)}
                          placeholder="sk-..."
                        />
                        <p className="text-xs text-muted-foreground">{t("ai.api_key_desc")}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("ai.model")}</Label>
                        <Select value={openAiModel} onValueChange={setOpenAiModel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (rápido, económico)</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o (más preciso)</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (más económico)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {aiProvider === "ollama" && (
                    <p className="text-xs text-muted-foreground">{t("ai.ollama_hint")}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <DashboardWidgetsCard />

          <ClinicalSectionsCard />

          <PricingCard />

          <AdminCard />
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

function AdminCard() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("nutriologa");
  const [selectedSucursalIds, setSelectedSucursalIds] = React.useState<string[]>([]);
  const [sucursales, setSucursales] = React.useState<{ id: string; nombre: string }[]>([]);

  React.useEffect(() => {
    authApi.listSucursales().then((r) => setSucursales(r.sucursales)).catch((err) => { console.error("[SettingsPage] Failed to load sucursales", err); });
  }, []);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await authApi.register({
        nombreCompleto: name,
        email,
        password,
        rol: role,
        sucursalIds: selectedSucursalIds,
      });
      toast.success(t("settings.user_created"));
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("nutriologa");
      setSelectedSucursalIds([]);
    } catch (err) {
      toast.error(t("settings.user_create_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequireRole roles={["admin"]}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("settings.admin_title")}
          </CardTitle>
          <CardDescription>{t("settings.admin_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("settings.create_user")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.create_user")}</DialogTitle>
            <DialogDescription>{t("settings.create_user_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.user_name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.user_email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.user_password")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.user_role")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{t(`auth.role_${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.user_sucursales")}</Label>
              <div className="grid grid-cols-1 gap-2">
                {sucursales.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                )}
                {sucursales.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedSucursalIds.includes(s.id)}
                      onCheckedChange={(val) => {
                        setSelectedSucursalIds((prev) =>
                          val ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                        );
                      }}
                    />
                    <span>{s.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {busy ? t("common.loading") : t("settings.create_user")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RequireRole>
  );
}

function DashboardWidgetsCard() {
  const { t } = useTranslation();
  const widgetIds = usePreferencesStore((s) => s.dashboardWidgetIds);
  const setDashboardWidgetIds = usePreferencesStore((s) => s.setDashboardWidgetIds);
  const resetDashboardWidgets = usePreferencesStore((s) => s.resetDashboardWidgets);
  const activeIds = widgetIds.length > 0 ? widgetIds : DEFAULT_DASHBOARD_WIDGET_IDS;
  const activeSet = new Set(activeIds);

  const toggleWidget = (id: string, checked: boolean) => {
    if (checked) {
      setDashboardWidgetIds([...activeIds, id as typeof activeIds[number]]);
    } else {
      setDashboardWidgetIds(activeIds.filter((w) => w !== id));
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          {t("settings.dashboard_widgets_title")}
        </CardTitle>
        <CardDescription>
          {t("settings.dashboard_widgets_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {WIDGET_DEFINITIONS.map((def) => {
            const checked = activeSet.has(def.id);
            return (
              <label key={def.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => toggleWidget(def.id, val === true)}
                  aria-label={t(def.labelKey)}
                />
                <span>{t(def.labelKey)}</span>
              </label>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={resetDashboardWidgets}>
          {t("settings.dashboard_widgets_reset")}
        </Button>
      </CardContent>
    </Card>
  );
}

const SECTION_ID_TO_I18N_KEY: Record<ClinicalSectionId, string> = {
  allergies: "clinical_record.allergies",
  medications: "clinical_record.medications",
  clinicalEvents: "clinical_record.clinical_events",
  familyHistory: "clinical_record.family_history",
  personalHistory: "clinical_record.personal_history",
  habits: "clinical_record.habits",
  physicalActivity: "clinical_record.physical_activity",
  dietHistory: "clinical_record.diet_history",
  intolerances: "clinical_record.intolerances",
  surgeries: "clinical_record.surgeries",
  hospitalizations: "clinical_record.hospitalizations",
  supplements: "clinical_record.supplements",
  foodFrequency: "clinical_record.food_frequency",
  giSymptoms: "clinical_record.gi_symptoms",
  aiConsent: "clinical_record.ai_consent",
};

function ClinicalSectionsCard() {
  const { t } = useTranslation();
  const clinicalSectionIds = usePreferencesStore((s) => s.clinicalSectionIds);
  const setClinicalSectionIds = usePreferencesStore((s) => s.setClinicalSectionIds);
  const resetClinicalSections = usePreferencesStore((s) => s.resetClinicalSections);
  const allSections = DEFAULT_CLINICAL_SECTION_IDS;
  const activeSet = new Set(clinicalSectionIds);

  const toggleSection = (id: ClinicalSectionId, checked: boolean) => {
    if (checked) {
      setClinicalSectionIds([...clinicalSectionIds, id]);
    } else {
      setClinicalSectionIds(clinicalSectionIds.filter((s) => s !== id));
    }
  };

  const noSelection = clinicalSectionIds.length === 0;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" />
          {t("settings.clinical_sections_title")}
        </CardTitle>
        <CardDescription>
          {t("settings.clinical_sections_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {noSelection && (
          <p className="text-sm text-amber-600">{t("settings.clinical_sections_no_selection")}</p>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          {allSections.map((id) => {
            const checked = activeSet.has(id);
            return (
              <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => toggleSection(id, val === true)}
                  aria-label={t(SECTION_ID_TO_I18N_KEY[id])}
                />
                <span>{t(SECTION_ID_TO_I18N_KEY[id])}</span>
              </label>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={resetClinicalSections}>
          {t("settings.clinical_sections_reset")}
        </Button>
      </CardContent>
    </Card>
  );
}

function PricingCard() {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4" />
            {t("pricing.catalog_title")}
          </CardTitle>
          <CardDescription>{t("pricing.catalog_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <DollarSign className="mr-2 h-4 w-4" />
            {t("pricing.add_price")}
          </Button>
        </CardContent>
      </Card>
      <PriceCatalogDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function fileIsEncrypted(file: File): boolean {
  return file.name.endsWith(".enc");
}
