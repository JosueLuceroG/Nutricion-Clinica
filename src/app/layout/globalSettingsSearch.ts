import {
  AlertTriangle,
  BellRing,
  DollarSign,
  Download,
  Eye,
  Hash,
  Heart,
  Layers,
  LayoutDashboard,
  Palette,
  PanelLeft,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Type,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { GlobalSearchResult, GlobalSearchTone } from "./globalSearchTypes";

interface LocalizedText {
  es: string;
  en: string;
}

interface SettingsSectionDefinition {
  id: string;
  title?: LocalizedText;
  titleKey?: string;
  description?: LocalizedText;
  descriptionKey?: string;
  parent?: LocalizedText;
  keywords: string;
  icon: LucideIcon;
  tone: GlobalSearchTone;
  adminOnly?: boolean;
}

interface BuildSettingsSearchResultsOptions {
  locale: string;
  isAdmin: boolean;
  translate: (key: string) => string;
}

const ALTERNATIVE_THEME_PARENT: LocalizedText = {
  es: "Tema alternativo",
  en: "Alternative theme",
};

const SETTINGS_SECTIONS: SettingsSectionDefinition[] = [
  {
    id: "data-backup",
    titleKey: "settings.data_backup",
    descriptionKey: "settings.export_backup_desc",
    keywords:
      "respaldo exportar export backup copia datos json cifrar encrypt contraseña password",
    icon: Download,
    tone: "blue",
    adminOnly: true,
  },
  {
    id: "restore-backup",
    titleKey: "settings.restore_backup",
    descriptionKey: "settings.restore_backup_desc",
    keywords:
      "restaurar importar import restore backup respaldo archivo json enc reemplazar datos",
    icon: Upload,
    tone: "blue",
    adminOnly: true,
  },
  {
    id: "preferences",
    titleKey: "settings.preferences",
    descriptionKey: "settings.preferences_desc",
    keywords:
      "preferencias ajustes tema claro oscuro sistema alto contraste idioma language fecha date moneda currency decimales decimals",
    icon: SlidersHorizontal,
    tone: "slate",
  },
  {
    id: "alternative-theme",
    title: {
      es: "Personalización del tema alternativo",
      en: "Alternative theme customization",
    },
    description: {
      es: "Personaliza los colores y el estilo visual del tema alternativo.",
      en: "Customize the colors and visual style of the alternative theme.",
    },
    keywords:
      "tema alternativo alternative theme personalizacion apariencia diseño visual customizacion",
    icon: Palette,
    tone: "purple",
  },
  {
    id: "alternative-colors",
    title: { es: "Colores principales", en: "Primary colors" },
    description: {
      es: "Paleta para acciones, estados y acentos clínicos.",
      en: "Palette for actions, statuses, and clinical accents.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "colores colors paleta primary secondary accent exito success warning danger error",
    icon: Sparkles,
    tone: "purple",
  },
  {
    id: "alternative-surfaces",
    title: { es: "Superficies y fondos", en: "Surfaces and backgrounds" },
    description: {
      es: "Fondos, tarjetas, bordes y jerarquía de texto.",
      en: "Backgrounds, cards, borders, and text hierarchy.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "superficies fondos surfaces backgrounds cards tarjetas bordes texto",
    icon: Layers,
    tone: "purple",
  },
  {
    id: "alternative-sidebar",
    title: { es: "Sidebar y barras", en: "Sidebar and bars" },
    description: {
      es: "Navegación lateral, barra superior y barra de estado.",
      en: "Sidebar navigation, top bar, and status bar.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords: "sidebar barra lateral navegacion topbar status bar menu",
    icon: PanelLeft,
    tone: "purple",
  },
  {
    id: "alternative-typography",
    title: { es: "Tipografía", en: "Typography" },
    description: {
      es: "Tamaño, peso, densidad y familia tipográfica.",
      en: "Font size, weight, density, and family.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "tipografia typography fuente font tamaño size peso weight densidad density familia",
    icon: Type,
    tone: "purple",
  },
  {
    id: "alternative-borders-shadows",
    title: { es: "Bordes y sombras", en: "Borders and shadows" },
    description: {
      es: "Radio, grosor de borde e intensidad de sombra.",
      en: "Radius, border width, and shadow intensity.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "bordes borders radio radius sombras shadows grosor width cards botones inputs",
    icon: SlidersHorizontal,
    tone: "purple",
  },
  {
    id: "motivational-card",
    title: { es: "Card motivacional", en: "Motivational card" },
    description: {
      es: "Colores, textos, frases, icono y estilo de la card del sidebar.",
      en: "Colors, text, phrases, icon, and style for the sidebar card.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "card tarjeta motivacional motivational impacto frase phrase corazon heart sidebar degradado gradient titulo icono indicadores decoraciones",
    icon: Heart,
    tone: "purple",
  },
  {
    id: "alternative-preview",
    title: { es: "Vista previa", en: "Preview" },
    description: {
      es: "Previsualización del tema y de la card motivacional.",
      en: "Preview of the theme and motivational card.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords: "vista previa preview previsualizar demo tema card motivacional",
    icon: Eye,
    tone: "purple",
  },
  {
    id: "alternative-validations",
    title: { es: "Validaciones del tema", en: "Theme validations" },
    description: {
      es: "Errores de color y alertas de contraste y legibilidad.",
      en: "Color errors and contrast and readability alerts.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "validaciones validations errores contraste contrast legibilidad accessibility accesibilidad hexadecimal",
    icon: AlertTriangle,
    tone: "purple",
  },
  {
    id: "alternative-actions",
    title: { es: "Acciones del tema", en: "Theme actions" },
    description: {
      es: "Guarda, descarta, restaura, exporta o importa el tema.",
      en: "Save, discard, restore, export, or import the theme.",
    },
    parent: ALTERNATIVE_THEME_PARENT,
    keywords:
      "acciones guardar save cancelar descartar restaurar reset exportar importar compartir json",
    icon: Save,
    tone: "purple",
  },
  {
    id: "workspace",
    titleKey: "settings.workspace_title",
    descriptionKey: "settings.workspace_desc",
    keywords:
      "saas experiencia workspace modo uso principiante beginner plan gratis free premium clinica marca pdf branding",
    icon: ShieldAlert,
    tone: "slate",
  },
  {
    id: "patient-record-number",
    titleKey: "settings.patient_record_number_title",
    descriptionKey: "settings.patient_record_number_description",
    keywords:
      "numero expediente clinico clinical record number folio clave prefijo formato consecutivo sequence paciente",
    icon: Hash,
    tone: "green",
  },
  {
    id: "ai",
    titleKey: "ai.title",
    descriptionKey: "ai.enable_desc",
    keywords:
      "asistente ia inteligencia artificial ai openai chatgpt ollama api key modelo provider proveedor",
    icon: Sparkles,
    tone: "cyan",
  },
  {
    id: "dashboard-quick-access",
    titleKey: "dashboardQuickAccess.settings.title",
    descriptionKey: "dashboardQuickAccess.settings.description",
    keywords:
      "acceso rapido dashboard quick access boton accion principal menu icono atajo shortcut",
    icon: Zap,
    tone: "blue",
  },
  {
    id: "dashboard-widgets",
    titleKey: "settings.dashboard_widgets_title",
    descriptionKey: "settings.dashboard_widgets_desc",
    keywords:
      "kpi dashboard widgets metricas editor visual personalizar customize tamaños orden",
    icon: LayoutDashboard,
    tone: "blue",
  },
  {
    id: "clinical-sections",
    titleKey: "settings.clinical_sections_title",
    descriptionKey: "settings.clinical_sections_desc",
    keywords:
      "secciones expediente clinical record sections alergias medicamentos antecedentes habitos actividad dieta intolerancias cirugias hospitalizaciones suplementos sintomas consentimiento",
    icon: Stethoscope,
    tone: "green",
  },
  {
    id: "clinical-alerts",
    titleKey: "clinicalAlerts.settings_title",
    descriptionKey: "clinicalAlerts.settings_description",
    keywords:
      "alertas recordatorios notificaciones reminders notifications proxima consulta cita agenda confirmar plan vencer pago pendiente cobro aviso anticipacion",
    icon: BellRing,
    tone: "cyan",
  },
  {
    id: "pricing",
    titleKey: "pricing.catalog_title",
    descriptionKey: "pricing.catalog_desc",
    keywords:
      "catalogo precios pricing prices tarifas costos alimentos sucursal moneda",
    icon: DollarSign,
    tone: "green",
  },
  {
    id: "administration",
    titleKey: "settings.admin_title",
    descriptionKey: "settings.admin_desc",
    keywords:
      "administracion administration usuarios users roles sucursales branches crear usuario profesional permisos",
    icon: Users,
    tone: "slate",
    adminOnly: true,
  },
];

function localized(text: LocalizedText, locale: string): string {
  return locale.startsWith("en") ? text.en : text.es;
}

function resolveText(
  text: LocalizedText | undefined,
  key: string | undefined,
  locale: string,
  translate: (key: string) => string,
): string {
  if (key) return translate(key);
  return text ? localized(text, locale) : "";
}

export function buildSettingsSearchResults({
  locale,
  isAdmin,
  translate,
}: BuildSettingsSearchResultsOptions): GlobalSearchResult[] {
  const settingsLabel = translate("settings.title");

  return SETTINGS_SECTIONS.filter(
    (section) => !section.adminOnly || isAdmin,
  ).map((section) => {
    const title = resolveText(
      section.title,
      section.titleKey,
      locale,
      translate,
    );
    const description = resolveText(
      section.description,
      section.descriptionKey,
      locale,
      translate,
    );
    const parent = section.parent
      ? `${settingsLabel} > ${localized(section.parent, locale)}`
      : settingsLabel;

    return {
      id: `setting-${section.id}`,
      kind: "setting",
      category: "actions",
      title,
      subtitle: `${parent} · ${description}`,
      searchableText: `${title} ${description} ${section.keywords}`,
      icon: section.icon,
      tone: section.tone,
      path: `/configuracion?section=${section.id}`,
    };
  });
}

export function focusSettingsSection(
  sectionId: string,
  root: ParentNode = document,
): HTMLElement | null {
  const target = Array.from(
    root.querySelectorAll<HTMLElement>("[data-settings-section]"),
  ).find((element) => element.dataset.settingsSection === sectionId);
  if (!target) return null;

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.focus({ preventScroll: true });
  return target;
}
