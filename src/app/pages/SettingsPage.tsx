import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Copy, DollarSign, Download, Eye, Globe, Hash, Heart, Layers, LayoutDashboard, Lock, Palette, PanelLeft, RotateCcw, Save, ShieldAlert, SlidersHorizontal, Sparkles, Stethoscope, Type, Undo2, Upload, Users, UserPlus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { Checkbox } from "@components/ui/checkbox";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
import {
  DEFAULT_ALTERNATIVE_THEME_CONFIG,
  isValidHexColor,
  normalizeAlternativeThemeConfig,
  readAlternativeThemeConfig,
  resetAlternativeThemeConfig,
  saveAlternativeThemeConfig,
  type AlternativeThemeConfig,
  type AlternativeThemeBorderWidth,
  type AlternativeThemeDensity,
  type AlternativeThemeFontSize,
  type AlternativeThemeMotivationalIconStyle,
  type AlternativeThemeMotivationalTextSize,
  type AlternativeThemeRadiusScale,
  type AlternativeThemeShadowIntensity,
  type AlternativeThemeVisualWeight,
} from "@app/theme/alternativeTheme";
import { useUIStore } from "@store/uiStore";
import { usePreferencesStore, DEFAULT_CLINICAL_SECTION_IDS, type ClinicalSectionId } from "@store/preferencesStore";
import { backupService } from "@services/backup/backupService";
import { aiService } from "@services/ai";
import { RequireRole } from "@modules/auth/RequireRole";
import { authApi } from "@services/api/authApi";
import { ALL_ROLES, type Role } from "@nutriclinica/shared";
import { PriceCatalogDialog } from "@modules/pricing/ui/PriceCatalogDialog";
import { DashboardQuickAccessSettingsCard } from "@modules/dashboard-quick-access/ui";

type PasswordMode = "export" | "import" | null;

type AlternativeThemeColorGroup = "colors" | "surfaces" | "sidebar" | "motivationalCard";

interface AlternativeThemeColorField {
  group: AlternativeThemeColorGroup;
  key: string;
  label: string;
  description: string;
  critical?: boolean;
}

const alternativeThemePrimaryColorFields: AlternativeThemeColorField[] = [
  { group: "colors", key: "primary", label: "Color primario", description: "Acciones principales y elementos activos.", critical: true },
  { group: "colors", key: "secondary", label: "Color secundario", description: "Variantes de botones y acentos secundarios.", critical: true },
  { group: "colors", key: "accent", label: "Color de acento", description: "Detalles cyan, indicadores y gráficos.", critical: true },
  { group: "colors", key: "success", label: "Color de éxito", description: "Estados sincronizados o completados.", critical: true },
  { group: "colors", key: "warning", label: "Color de advertencia", description: "Alertas suaves y pendientes.", critical: true },
  { group: "colors", key: "danger", label: "Color de error", description: "Errores y acciones destructivas.", critical: true },
];

const alternativeThemeSurfaceFields: AlternativeThemeColorField[] = [
  { group: "surfaces", key: "main", label: "Fondo principal", description: "Área general del contenido.", critical: true },
  { group: "surfaces", key: "card", label: "Fondo de cards", description: "Tarjetas, menús y paneles.", critical: true },
  { group: "surfaces", key: "elevated", label: "Fondo elevado", description: "Superficies flotantes y zonas destacadas.", critical: true },
  { group: "surfaces", key: "cardBorder", label: "Borde de cards", description: "Líneas de separación y contornos.", critical: true },
  { group: "surfaces", key: "textPrimary", label: "Texto principal", description: "Títulos y contenido prioritario.", critical: true },
  { group: "surfaces", key: "textSecondary", label: "Texto secundario", description: "Ayudas, descripciones y metadatos.", critical: true },
];

const alternativeThemeSidebarFields: AlternativeThemeColorField[] = [
  { group: "sidebar", key: "background", label: "Color del sidebar", description: "Fondo base de navegación.", critical: true },
  { group: "sidebar", key: "activeItem", label: "Item activo", description: "Selección actual del menú.", critical: true },
  { group: "sidebar", key: "hoverItem", label: "Hover del sidebar", description: "Respuesta al pasar el cursor.", critical: true },
  { group: "sidebar", key: "topbar", label: "Barra superior", description: "Chrome superior del tema alternativo.", critical: true },
  { group: "sidebar", key: "bottomBar", label: "Barra inferior", description: "Status bar integrada al sidebar.", critical: true },
  { group: "sidebar", key: "text", label: "Textos en sidebar", description: "Etiquetas y marca lateral.", critical: true },
  { group: "sidebar", key: "icon", label: "Iconos en sidebar", description: "Iconografía de navegación.", critical: true },
];

const alternativeThemeMotivationalColorFields: AlternativeThemeColorField[] = [
  { group: "motivationalCard", key: "backgroundPrimary", label: "Fondo principal", description: "Base del degradado de la card.", critical: true },
  { group: "motivationalCard", key: "backgroundSecondary", label: "Degradado secundario", description: "Profundidad final del degradado.", critical: true },
  { group: "motivationalCard", key: "titleColor", label: "Color del título", description: "Título principal de la card.", critical: true },
  { group: "motivationalCard", key: "textColor", label: "Color del texto", description: "Frase o descripción motivacional.", critical: true },
  { group: "motivationalCard", key: "iconBg", label: "Contenedor del ícono", description: "Color de la cápsula circular.", critical: true },
  { group: "motivationalCard", key: "iconColor", label: "Color del ícono", description: "Corazón/ícono interno.", critical: true },
  { group: "motivationalCard", key: "decorationColor", label: "Decoraciones", description: "Hojas y ornamentos inferiores.", critical: true },
  { group: "motivationalCard", key: "borderColor", label: "Color del borde", description: "Contorno de la card.", critical: true },
  { group: "motivationalCard", key: "indicatorActive", label: "Indicador activo", description: "Punto activo inferior.", critical: true },
  { group: "motivationalCard", key: "indicatorInactive", label: "Indicador inactivo", description: "Puntos inactivos inferiores.", critical: true },
];

const allAlternativeThemeColorFields = [
  ...alternativeThemePrimaryColorFields,
  ...alternativeThemeSurfaceFields,
  ...alternativeThemeSidebarFields,
  ...alternativeThemeMotivationalColorFields,
];

const typographySizeOptions: Array<{ value: AlternativeThemeFontSize; label: string; description: string }> = [
  { value: "small", label: "Pequeño", description: "Más contenido visible." },
  { value: "normal", label: "Normal", description: "Balance clínico." },
  { value: "large", label: "Grande", description: "Mayor lectura." },
];

const visualWeightOptions: Array<{ value: AlternativeThemeVisualWeight; label: string; description: string }> = [
  { value: "soft", label: "Suave", description: "Menos presencia." },
  { value: "normal", label: "Normal", description: "Equilibrado." },
  { value: "strong", label: "Fuerte", description: "Más énfasis." },
];

const densityOptions: Array<{ value: AlternativeThemeDensity; label: string; description: string }> = [
  { value: "compact", label: "Compacta", description: "Espacios reducidos." },
  { value: "normal", label: "Normal", description: "Ritmo estándar." },
  { value: "comfortable", label: "Cómoda", description: "Más respiración." },
];

const radiusOptions: Array<{ value: AlternativeThemeRadiusScale; label: string; description: string }> = [
  { value: "subtle", label: "Sutil", description: "Bordes discretos." },
  { value: "normal", label: "Normal", description: "Redondeo base." },
  { value: "rounded", label: "Redondeado", description: "Look más amable." },
  { value: "pill", label: "Muy redondeado", description: "Estilo premium suave." },
];

const shadowOptions: Array<{ value: AlternativeThemeShadowIntensity; label: string; description: string }> = [
  { value: "none", label: "Sin sombra", description: "Plano y limpio." },
  { value: "soft", label: "Suave", description: "Elevación ligera." },
  { value: "normal", label: "Normal", description: "Profundidad balanceada." },
  { value: "premium", label: "Premium", description: "Más profundidad visual." },
];

const borderWidthOptions: Array<{ value: AlternativeThemeBorderWidth; label: string; description: string }> = [
  { value: "thin", label: "Fino", description: "Contornos ligeros." },
  { value: "normal", label: "Normal", description: "Contornos más presentes." },
];

const motivationalTextSizeOptions: Array<{ value: AlternativeThemeMotivationalTextSize; label: string; description: string }> = [
  { value: "small", label: "Pequeño", description: "Más discreto." },
  { value: "normal", label: "Normal", description: "Balanceado." },
  { value: "large", label: "Grande", description: "Más protagonista." },
];

const motivationalIconStyleOptions: Array<{ value: AlternativeThemeMotivationalIconStyle; label: string; description: string }> = [
  { value: "soft", label: "Suave", description: "Ícono limpio." },
  { value: "normal", label: "Normal", description: "Estilo base." },
  { value: "highlight", label: "Destacado", description: "Más presencia." },
];

const alternativeThemeFontOptions = [
  { value: DEFAULT_ALTERNATIVE_THEME_CONFIG.typography.fontFamily, label: "Inter / Sistema" },
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: "Sistema moderno" },
  { value: '"Segoe UI", Inter, system-ui, sans-serif', label: "Segoe UI" },
] as const;

function getAlternativeThemeColor(config: AlternativeThemeConfig, field: AlternativeThemeColorField) {
  return (config[field.group] as Record<string, string>)[field.key] ?? "";
}

function setAlternativeThemeColor(config: AlternativeThemeConfig, field: AlternativeThemeColorField, value: string): AlternativeThemeConfig {
  return {
    ...config,
    [field.group]: {
      ...config[field.group],
      [field.key]: value,
    },
  } as AlternativeThemeConfig;
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

function hexToRgb(hex: string) {
  if (!isValidHexColor(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function getRelativeLuminance(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function getContrastRatio(foreground: string, background: string) {
  const fg = getRelativeLuminance(foreground);
  const bg = getRelativeLuminance(background);
  if (fg === null || bg === null) return null;
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function getAlternativeThemeColorErrors(config: AlternativeThemeConfig) {
  return allAlternativeThemeColorFields.reduce<Record<string, string>>((errors, field) => {
    const value = getAlternativeThemeColor(config, field).trim();
    if (!value) {
      errors[`${field.group}.${field.key}`] = "Campo requerido";
      return errors;
    }
    if (!isValidHexColor(value)) {
      errors[`${field.group}.${field.key}`] = "Usa un hexadecimal valido, ej. #2563EB";
    }
    return errors;
  }, {});
}

function getAlternativeThemeContrastWarnings(config: AlternativeThemeConfig) {
  const checks = [
    {
      label: "Texto principal sobre cards",
      foreground: config.surfaces.textPrimary,
      background: config.surfaces.card,
      minimum: 4.5,
    },
    {
      label: "Texto secundario sobre fondo principal",
      foreground: config.surfaces.textSecondary,
      background: config.surfaces.main,
      minimum: 3,
    },
    {
      label: "Texto del sidebar sobre sidebar",
      foreground: config.sidebar.text,
      background: config.sidebar.background,
      minimum: 4.5,
    },
    {
      label: "Iconos del sidebar sobre sidebar",
      foreground: config.sidebar.icon,
      background: config.sidebar.background,
      minimum: 3,
    },
    {
      label: "Título de card motivacional sobre fondo",
      foreground: config.motivationalCard.titleColor,
      background: config.motivationalCard.backgroundPrimary,
      minimum: 4.5,
    },
    {
      label: "Texto de card motivacional sobre fondo",
      foreground: config.motivationalCard.textColor,
      background: config.motivationalCard.backgroundSecondary,
      minimum: 3,
    },
  ];

  return checks.flatMap((check) => {
    const ratio = getContrastRatio(check.foreground, check.background);
    if (ratio === null || ratio >= check.minimum) return [];
    return [`${check.label}: contraste ${ratio.toFixed(1)}:1. Este color puede afectar la legibilidad.`];
  });
}

function areAlternativeThemeConfigsEqual(a: AlternativeThemeConfig, b: AlternativeThemeConfig) {
  return JSON.stringify(normalizeAlternativeThemeConfig(a)) === JSON.stringify(normalizeAlternativeThemeConfig(b));
}

function AlternativeThemeSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card/95 p-4 shadow-sm ring-1 ring-black/[0.02]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function AlternativeThemeColorControl({
  field,
  value,
  error,
  onChange,
}: {
  field: AlternativeThemeColorField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = isValidHexColor(value) ? value : getAlternativeThemeColor(DEFAULT_ALTERNATIVE_THEME_CONFIG, field);

  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor={`alternative-theme-${field.group}-${field.key}`} className="text-xs font-semibold">
            {field.label}
          </Label>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{field.description}</p>
        </div>
        <span
          className="h-8 w-8 shrink-0 rounded-full border shadow-inner"
          style={{ backgroundColor: isValidHexColor(value) ? value : "transparent" }}
          aria-hidden="true"
        />
      </div>
      <div className="flex gap-2">
        <Input
          id={`alternative-theme-${field.group}-${field.key}`}
          type="color"
          value={pickerValue}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-14 shrink-0 cursor-pointer p-1"
          aria-label={field.label}
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          placeholder="#2563EB"
          className={`font-mono text-xs ${error ? "border-destructive focus-visible:ring-destructive" : ""}`}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function AlternativeThemeSegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; description: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/10 text-primary shadow-sm" : "bg-background/70 text-foreground hover:border-primary/40 hover:bg-primary/5"}`}
            aria-pressed={active}
          >
            <span className="block text-xs font-semibold">{option.label}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

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
    { value: "alternative", label: "Alternativo", icon: "🎨" },
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

function AlternativeThemeCard() {
  const initialConfig = React.useMemo(() => readAlternativeThemeConfig(), []);
  const [savedConfig, setSavedConfig] = React.useState<AlternativeThemeConfig>(initialConfig);
  const [config, setConfig] = React.useState<AlternativeThemeConfig>(initialConfig);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [importValue, setImportValue] = React.useState("");
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const colorErrors = React.useMemo(() => getAlternativeThemeColorErrors(config), [config]);
  const contrastWarnings = React.useMemo(() => getAlternativeThemeContrastWarnings(config), [config]);
  const hasColorErrors = Object.keys(colorErrors).length > 0;
  const isDirty = !areAlternativeThemeConfigsEqual(config, savedConfig);
  const radiusPx = { subtle: 14, normal: 20, rounded: 24, pill: 28 }[config.radius.scale];
  const densityPadding = { compact: "10px", normal: "14px", comfortable: "18px" }[config.typography.density];
  const fontSize = { small: "12.5px", normal: "13.5px", large: "15px" }[config.typography.baseSize];
  const fontWeight = { soft: 500, normal: 580, strong: 680 }[config.typography.visualWeight];
  const borderWidth = { thin: "1px", normal: "1.5px" }[config.shadows.borderWidth];
  const previewShadow = {
    none: "none",
    soft: "0 10px 24px rgba(15, 23, 42, 0.045)",
    normal: "0 14px 34px rgba(15, 23, 42, 0.06)",
    premium: "0 20px 52px rgba(15, 23, 42, 0.10)",
  }[config.shadows.intensity];
  const motivationalCard = config.motivationalCard;
  const motivationalTitleSize = { small: "18px", normal: "19.7px", large: "21.5px" }[motivationalCard.titleSize];
  const motivationalTextSize = { small: "12.8px", normal: "13.8px", large: "14.8px" }[motivationalCard.textSize];
  const motivationalIconShadow = {
    soft: "inset 0 1px 0 rgba(255, 255, 255, 0.14)",
    normal: "inset 0 1px 0 rgba(255, 255, 255, 0.22)",
    highlight: "0 0 0 6px rgba(255, 255, 255, 0.10), 0 12px 24px rgba(2, 8, 23, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.24)",
  }[motivationalCard.iconStyle];
  const motivationalShadow = {
    none: "inset 0 1px 0 rgba(255, 255, 255, 0.16)",
    soft: "0 10px 22px rgba(2, 8, 23, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
    normal: "0 14px 30px rgba(2, 8, 23, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
    premium: "0 18px 40px rgba(2, 8, 23, 0.24), 0 0 28px rgba(14, 165, 233, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
  }[motivationalCard.shadowLevel];
  const motivationalGradient = `radial-gradient(circle at 20% 12%, color-mix(in srgb, ${motivationalCard.backgroundSecondary} ${motivationalCard.gradientStrength}%, transparent), transparent 30%), radial-gradient(circle at 94% 8%, color-mix(in srgb, ${motivationalCard.backgroundPrimary} 22%, transparent), transparent 30%), linear-gradient(154deg, ${motivationalCard.backgroundPrimary} 0%, color-mix(in srgb, ${motivationalCard.backgroundPrimary} ${Math.max(24, 100 - motivationalCard.gradientStrength / 2)}%, ${motivationalCard.backgroundSecondary}) 44%, ${motivationalCard.backgroundSecondary} 100%)`;
  const motivationalPreviewTitle = motivationalCard.titles[0] || motivationalCard.defaultTitle;
  const motivationalPreviewText = motivationalCard.phrases[0] || motivationalCard.defaultText;

  const updateColor = (field: AlternativeThemeColorField, value: string) => {
    setConfig((current) => setAlternativeThemeColor(current, field, value));
  };

  const updateMotivationalCard = <K extends keyof AlternativeThemeConfig["motivationalCard"]>(
    key: K,
    value: AlternativeThemeConfig["motivationalCard"][K],
  ) => {
    setConfig((current) => ({
      ...current,
      motivationalCard: {
        ...current.motivationalCard,
        [key]: value,
      },
    }));
  };

  const renderColorControls = (fields: AlternativeThemeColorField[]) => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => {
        const errorKey = `${field.group}.${field.key}`;
        return (
          <AlternativeThemeColorControl
            key={errorKey}
            field={field}
            value={getAlternativeThemeColor(config, field)}
            error={colorErrors[errorKey]}
            onChange={(value) => updateColor(field, value)}
          />
        );
      })}
    </div>
  );

  const handleSave = () => {
    if (hasColorErrors) {
      toast.error("Corrige los colores invalidos antes de guardar.");
      return;
    }

    const nextConfig = normalizeAlternativeThemeConfig(config);
    saveAlternativeThemeConfig(nextConfig);
    setConfig(nextConfig);
    setSavedConfig(nextConfig);
    setSavedAt(new Date());
    toast.success("Tema alternativo guardado");
  };

  const handleCancel = () => {
    setConfig(savedConfig);
    toast.info("Cambios descartados");
  };

  const handleResetConfirmed = () => {
    resetAlternativeThemeConfig();
    setConfig(DEFAULT_ALTERNATIVE_THEME_CONFIG);
    setSavedConfig(DEFAULT_ALTERNATIVE_THEME_CONFIG);
    setSavedAt(new Date());
    setResetDialogOpen(false);
    toast.success("Tema alternativo restaurado por defecto");
  };

  const handleExportTheme = async () => {
    const exportedTheme = JSON.stringify(normalizeAlternativeThemeConfig(config), null, 2);
    try {
      await navigator.clipboard.writeText(exportedTheme);
      toast.success("Tema copiado al portapapeles");
    } catch {
      const blob = new Blob([exportedTheme], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nutriclinica-tema-alternativo.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Tema descargado como JSON");
    }
  };

  const handleImportTheme = () => {
    try {
      const parsed = JSON.parse(importValue) as unknown;
      const importedConfig = normalizeAlternativeThemeConfig(parsed);
      setConfig(importedConfig);
      setImportDialogOpen(false);
      setImportValue("");
      toast.success("Tema importado. Revisa la vista previa y guarda los cambios.");
    } catch {
      toast.error("JSON invalido. Revisa el contenido e intenta de nuevo.");
    }
  };

  const previewStyle = {
    color: config.surfaces.textPrimary,
    background: config.surfaces.main,
    borderColor: config.surfaces.cardBorder,
    borderRadius: `${radiusPx}px`,
    borderWidth,
    fontFamily: config.typography.fontFamily,
    fontSize,
    fontWeight,
  } as React.CSSProperties;

  return (
    <>
      <Card className="overflow-hidden border-primary/10 md:col-span-2">
        <CardHeader className="border-b bg-gradient-to-br from-primary/10 via-background to-info/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Palette className="h-5 w-5 text-primary" />
                Personalización del tema alternativo
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm">
                <span className="block font-medium text-foreground">Tema alternativo</span>
                Personaliza los colores y estilo visual del tema alternativo. Estos cambios solo aplican al tema Alternativo.
              </CardDescription>
            </div>
            <div className="rounded-full border bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              {isDirty ? "Cambios sin guardar" : savedAt ? "Guardado hace un momento" : "Sin cambios pendientes"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-4 md:p-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="space-y-5">
              <AlternativeThemeSection
                title="Colores principales"
                description="Define la paleta base para acciones, estados y acentos clinicos."
                icon={Sparkles}
              >
                {renderColorControls(alternativeThemePrimaryColorFields)}
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Superficies y fondos"
                description="Controla fondos, cards, bordes y jerarquia de texto."
                icon={Layers}
              >
                {renderColorControls(alternativeThemeSurfaceFields)}
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Sidebar y barras"
                description="Ajusta sidebar, barra superior, status bar y colores de navegacion."
                icon={PanelLeft}
              >
                {renderColorControls(alternativeThemeSidebarFields)}
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Tipografia"
                description="Ajustes controlados de escala, peso y densidad visual."
                icon={Type}
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label>Tamaño base de fuente</Label>
                    <AlternativeThemeSegmentedControl
                      value={config.typography.baseSize}
                      options={typographySizeOptions}
                      onChange={(value) => setConfig((current) => ({ ...current, typography: { ...current.typography, baseSize: value } }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso visual</Label>
                    <AlternativeThemeSegmentedControl
                      value={config.typography.visualWeight}
                      options={visualWeightOptions}
                      onChange={(value) => setConfig((current) => ({ ...current, typography: { ...current.typography, visualWeight: value } }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Densidad visual</Label>
                    <AlternativeThemeSegmentedControl
                      value={config.typography.density}
                      options={densityOptions}
                      onChange={(value) => setConfig((current) => ({ ...current, typography: { ...current.typography, density: value } }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Familia tipografica</Label>
                    <Select value={config.typography.fontFamily} onValueChange={(value) => setConfig((current) => ({ ...current, typography: { ...current.typography, fontFamily: value } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {alternativeThemeFontOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Bordes y sombras"
                description="Controla la presencia visual de cards, botones, inputs, dropdowns y paneles."
                icon={SlidersHorizontal}
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label>Radio de bordes</Label>
                    <AlternativeThemeSegmentedControl
                      value={config.radius.scale}
                      options={radiusOptions}
                      onChange={(value) => setConfig((current) => ({ ...current, radius: { scale: value } }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Intensidad de sombra</Label>
                    <AlternativeThemeSegmentedControl
                      value={config.shadows.intensity}
                      options={shadowOptions}
                      onChange={(value) => setConfig((current) => ({ ...current, shadows: { ...current.shadows, intensity: value } }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Grosor de borde</Label>
                    <AlternativeThemeSegmentedControl
                      value={config.shadows.borderWidth}
                      options={borderWidthOptions}
                      onChange={(value) => setConfig((current) => ({ ...current, shadows: { ...current.shadows, borderWidth: value } }))}
                    />
                  </div>
                </div>
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Card motivacional"
                description="Personaliza la card del sidebar alternativo sin cambiar su estructura ni posicion."
                icon={Heart}
              >
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Fondo, textos e icono</h4>
                      <p className="mt-1 text-[11px] text-muted-foreground">Ajusta el degradado, colores internos e indicadores visuales principales.</p>
                    </div>
                    {renderColorControls(alternativeThemeMotivationalColorFields)}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label htmlFor="alternative-impact-gradient-strength">Intensidad del degradado: {motivationalCard.gradientStrength}%</Label>
                      <Input
                        id="alternative-impact-gradient-strength"
                        type="range"
                        min="0"
                        max="100"
                        value={motivationalCard.gradientStrength}
                        onChange={(event) => updateMotivationalCard("gradientStrength", Number(event.target.value))}
                      />
                    </div>

                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label htmlFor="alternative-impact-decoration-opacity">Opacidad de decoraciones: {Math.round(motivationalCard.decorationOpacity * 100)}%</Label>
                      <Input
                        id="alternative-impact-decoration-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={motivationalCard.decorationOpacity}
                        onChange={(event) => updateMotivationalCard("decorationOpacity", Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tamaño del título</Label>
                      <AlternativeThemeSegmentedControl
                        value={motivationalCard.titleSize}
                        options={motivationalTextSizeOptions}
                        onChange={(value) => updateMotivationalCard("titleSize", value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tamaño del texto secundario</Label>
                      <AlternativeThemeSegmentedControl
                        value={motivationalCard.textSize}
                        options={motivationalTextSizeOptions}
                        onChange={(value) => updateMotivationalCard("textSize", value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Estilo visual del ícono</Label>
                    <AlternativeThemeSegmentedControl
                      value={motivationalCard.iconStyle}
                      options={motivationalIconStyleOptions}
                      onChange={(value) => updateMotivationalCard("iconStyle", value)}
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <Label>Decoraciones sutiles</Label>
                          <p className="mt-1 text-[11px] text-muted-foreground">Muestra u oculta hojas y ornamentos inferiores.</p>
                        </div>
                        <Switch
                          checked={motivationalCard.showDecorations}
                          onCheckedChange={(checked) => updateMotivationalCard("showDecorations", checked)}
                          aria-label="Mostrar decoraciones de la card motivacional"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label>Intensidad de sombra</Label>
                      <Select value={motivationalCard.shadowLevel} onValueChange={(value) => updateMotivationalCard("shadowLevel", value as AlternativeThemeShadowIntensity)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {shadowOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label htmlFor="alternative-impact-radius">Radio de bordes: {motivationalCard.borderRadius}px</Label>
                      <Input
                        id="alternative-impact-radius"
                        type="range"
                        min="16"
                        max="30"
                        value={motivationalCard.borderRadius}
                        onChange={(event) => updateMotivationalCard("borderRadius", Number(event.target.value))}
                      />
                    </div>

                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label htmlFor="alternative-impact-border-width">Grosor del borde: {motivationalCard.borderWidth}px</Label>
                      <Input
                        id="alternative-impact-border-width"
                        type="range"
                        min="0"
                        max="3"
                        step="0.5"
                        value={motivationalCard.borderWidth}
                        onChange={(event) => updateMotivationalCard("borderWidth", Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label htmlFor="alternative-impact-dot-size">Tamaño de indicadores: {motivationalCard.indicatorSize}px</Label>
                      <Input
                        id="alternative-impact-dot-size"
                        type="range"
                        min="4"
                        max="9"
                        value={motivationalCard.indicatorSize}
                        onChange={(event) => updateMotivationalCard("indicatorSize", Number(event.target.value))}
                      />
                    </div>

                    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
                      <Label htmlFor="alternative-impact-dot-gap">Separación entre indicadores: {motivationalCard.indicatorGap}px</Label>
                      <Input
                        id="alternative-impact-dot-gap"
                        type="range"
                        min="4"
                        max="12"
                        value={motivationalCard.indicatorGap}
                        onChange={(event) => updateMotivationalCard("indicatorGap", Number(event.target.value))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border bg-background/70 p-4">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">Contenido de la card</h4>
                      <p className="mt-1 text-[11px] text-muted-foreground">Estos textos se usan en la rotación motivacional del tema alternativo.</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="alternative-impact-default-title">Título principal</Label>
                        <Input
                          id="alternative-impact-default-title"
                          value={motivationalCard.defaultTitle}
                          onChange={(event) => updateMotivationalCard("defaultTitle", event.target.value)}
                          placeholder="Nutrir también es cuidar"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="alternative-impact-default-text">Texto descriptivo</Label>
                        <Input
                          id="alternative-impact-default-text"
                          value={motivationalCard.defaultText}
                          onChange={(event) => updateMotivationalCard("defaultText", event.target.value)}
                          placeholder="Cada seguimiento puede marcar diferencia."
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="alternative-impact-titles">Títulos cortos motivacionales</Label>
                        <Textarea
                          id="alternative-impact-titles"
                          value={joinLines(motivationalCard.titles)}
                          onChange={(event) => updateMotivationalCard("titles", splitLines(event.target.value))}
                          className="min-h-32 text-xs"
                          placeholder="Tu impacto hoy\nProgreso real\nNutrir también es cuidar"
                        />
                        <p className="text-[11px] text-muted-foreground">Un título por línea.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="alternative-impact-phrases">Frases motivacionales</Label>
                        <Textarea
                          id="alternative-impact-phrases"
                          value={joinLines(motivationalCard.phrases)}
                          onChange={(event) => updateMotivationalCard("phrases", splitLines(event.target.value))}
                          className="min-h-32 text-xs"
                          placeholder="Cada seguimiento puede marcar diferencia.\nLa calma ayuda a sostener mejores hábitos."
                        />
                        <p className="text-[11px] text-muted-foreground">Una frase por línea.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </AlternativeThemeSection>
            </div>

            <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
              <AlternativeThemeSection
                title="Vista previa"
                description="Los cambios se previsualizan aqui; se aplican al sistema al guardar."
                icon={Eye}
              >
                <div className="overflow-hidden border bg-background" style={previewStyle}>
                  <div className="flex h-11 items-center justify-between px-4 text-white" style={{ background: config.sidebar.topbar }}>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: config.colors.accent }} />
                      <span className="text-xs font-bold">NutriClinica</span>
                    </div>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px]">Alternativo</span>
                  </div>

                  <div className="grid grid-cols-[94px_1fr]">
                    <div className="min-h-[260px] p-3 text-[11px]" style={{ background: config.sidebar.background, color: config.sidebar.text }}>
                      <div className="mb-4 text-xs font-bold">NC</div>
                      <div className="space-y-2">
                        <div className="rounded-xl px-2 py-2 text-white" style={{ background: config.sidebar.activeItem }}>Dashboard</div>
                        <div className="rounded-xl px-2 py-2" style={{ color: config.sidebar.icon }}>Pacientes</div>
                        <div className="rounded-xl px-2 py-2" style={{ background: config.sidebar.hoverItem, color: config.sidebar.text }}>Consultas</div>
                      </div>
                    </div>

                    <div className="space-y-3" style={{ padding: densityPadding, background: config.surfaces.main }}>
                      <div>
                        <p className="leading-tight" style={{ color: config.surfaces.textPrimary, fontWeight }}>Panel clinico</p>
                        <p className="mt-1 text-xs" style={{ color: config.surfaces.textSecondary }}>Vista alternativa personalizada</p>
                      </div>

                      <div
                        className="border p-3"
                        style={{
                          background: config.surfaces.card,
                          borderColor: config.surfaces.cardBorder,
                          borderRadius: `${Math.max(10, radiusPx - 5)}px`,
                          borderWidth,
                          boxShadow: previewShadow,
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs" style={{ color: config.surfaces.textSecondary }}>Pacientes activos</p>
                            <p className="text-2xl font-bold" style={{ color: config.surfaces.textPrimary }}>128</p>
                          </div>
                          <span className="rounded-full px-2 py-1 text-[10px] font-semibold text-white" style={{ background: config.colors.success }}>+12%</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: config.surfaces.elevated }}>
                          <div className="h-2 w-2/3 rounded-full" style={{ background: config.colors.accent }} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: config.colors.primary }}>
                          Primario
                        </button>
                        <button type="button" className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: config.surfaces.cardBorder, color: config.colors.secondary, background: config.surfaces.card }}>
                          Secundario
                        </button>
                        <span className="rounded-full px-3 py-2 text-xs font-semibold" style={{ background: config.surfaces.elevated, color: config.colors.warning }}>
                          Pendiente
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-10 items-center justify-between px-4 text-[11px] font-semibold" style={{ background: config.sidebar.bottomBar, color: config.sidebar.text }}>
                    <span>Sincronizado</span>
                    <span style={{ color: config.colors.success }}>En linea</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Preview de card motivacional</p>
                  <div
                    className="relative min-h-[190px] overflow-hidden p-4"
                    style={{
                      background: motivationalGradient,
                      border: `${motivationalCard.borderWidth}px solid ${motivationalCard.borderColor}`,
                      borderRadius: `${motivationalCard.borderRadius}px`,
                      boxShadow: motivationalShadow,
                    }}
                  >
                    {motivationalCard.showDecorations && (
                      <>
                        <span
                          className="absolute -bottom-14 -left-16 h-36 w-48 rounded-t-full"
                          style={{ background: motivationalCard.decorationColor, opacity: motivationalCard.decorationOpacity * 0.22 }}
                          aria-hidden="true"
                        />
                        <span
                          className="absolute -bottom-12 -right-10 h-32 w-32 rounded-full"
                          style={{ background: motivationalCard.decorationColor, opacity: motivationalCard.decorationOpacity * 0.18 }}
                          aria-hidden="true"
                        />
                      </>
                    )}
                    <div className="relative z-10 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ background: motivationalCard.iconBg, color: motivationalCard.iconColor, boxShadow: motivationalIconShadow }}
                        >
                          <Heart className="h-4 w-4" />
                        </span>
                        <strong
                          className="leading-tight tracking-[-0.02em]"
                          style={{ color: motivationalCard.titleColor, fontSize: motivationalTitleSize }}
                        >
                          {motivationalPreviewTitle}
                        </strong>
                      </div>
                      <p
                        className="mt-4 leading-relaxed"
                        style={{ color: motivationalCard.textColor, fontSize: motivationalTextSize }}
                      >
                        {motivationalPreviewText}
                      </p>
                    </div>
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2" style={{ gap: `${motivationalCard.indicatorGap}px` }} aria-hidden="true">
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={index}
                          className="rounded-full"
                          style={{
                            width: index === 0 ? Math.max(motivationalCard.indicatorSize * 3.4, motivationalCard.indicatorSize + 8) : motivationalCard.indicatorSize,
                            height: motivationalCard.indicatorSize,
                            background: index === 0 ? motivationalCard.indicatorActive : motivationalCard.indicatorInactive,
                            opacity: index === 0 ? 1 : 0.52,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Validaciones"
                description="Revisa errores y alertas de legibilidad antes de guardar."
                icon={AlertTriangle}
              >
                <div className="space-y-3">
                  {hasColorErrors ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                      Hay {Object.keys(colorErrors).length} color(es) con formato invalido.
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Todos los colores tienen formato hexadecimal valido.
                    </div>
                  )}

                  {contrastWarnings.length > 0 ? (
                    <div className="space-y-2">
                      {contrastWarnings.map((warning) => (
                        <div key={warning} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                      Sin advertencias de contraste relevantes.
                    </div>
                  )}
                </div>
              </AlternativeThemeSection>

              <AlternativeThemeSection
                title="Acciones"
                description="Guarda, descarta, restaura o comparte tu tema."
                icon={Save}
              >
                <div className="space-y-3">
                  <Button onClick={handleSave} disabled={hasColorErrors} className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Guardar cambios
                  </Button>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Button variant="outline" onClick={handleCancel} disabled={!isDirty}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      Cancelar cambios
                    </Button>
                    <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restaurar tema por defecto
                    </Button>
                    <Button variant="outline" onClick={handleExportTheme}>
                      <Copy className="mr-2 h-4 w-4" />
                      Exportar tema
                    </Button>
                    <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Importar tema
                    </Button>
                  </div>
                </div>
              </AlternativeThemeSection>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar tema alternativo por defecto</DialogTitle>
            <DialogDescription>
              Esto regresara el tema alternativo a la base premium de referencia: sidebar navy, barras navy, contenido claro, cards blancas y acentos azul/cyan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetConfirmed}>Restaurar tema por defecto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar tema alternativo</DialogTitle>
            <DialogDescription>
              Pega un JSON de alternativeThemeConfig. Se cargara en la vista previa y podras guardarlo cuando lo revises.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importValue}
            onChange={(event) => setImportValue(event.target.value)}
            placeholder='{"colors":{"primary":"#2563EB"}}'
            className="min-h-64 font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleImportTheme} disabled={!importValue.trim()}>Importar tema</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

          <AlternativeThemeCard />

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

          <DashboardQuickAccessSettingsCard />

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
  const navigate = useNavigate();

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
        <p className="text-sm text-muted-foreground">
          {t("settings.dashboard_widgets_help")}
        </p>
        <Button type="button" onClick={() => navigate("/?customize=1")}>
          <SlidersHorizontal className="h-4 w-4" />
          {t("settings.dashboard_widgets_open")}
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
