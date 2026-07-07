export const THEME_STORAGE_KEY = "theme";
export const ALTERNATIVE_THEME_CONFIG_STORAGE_KEY = "alternativeThemeConfig";
export const ALTERNATIVE_THEME_CONFIG_CHANGED_EVENT = "nutriclinica:alternative-theme-config-changed";

export type AlternativeThemeFontSize = "small" | "normal" | "large";
export type AlternativeThemeVisualWeight = "soft" | "normal" | "strong";
export type AlternativeThemeDensity = "compact" | "normal" | "comfortable";
export type AlternativeThemeRadiusScale = "subtle" | "normal" | "rounded" | "pill";
export type AlternativeThemeShadowIntensity = "none" | "soft" | "normal" | "premium";
export type AlternativeThemeBorderWidth = "thin" | "normal";
export type AlternativeThemeMotivationalTextSize = "small" | "normal" | "large";
export type AlternativeThemeMotivationalIconStyle = "soft" | "normal" | "highlight";

export interface AlternativeThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
  };
  surfaces: {
    main: string;
    card: string;
    elevated: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
  };
  sidebar: {
    background: string;
    activeItem: string;
    hoverItem: string;
    topbar: string;
    bottomBar: string;
    text: string;
    icon: string;
  };
  typography: {
    baseSize: AlternativeThemeFontSize;
    visualWeight: AlternativeThemeVisualWeight;
    density: AlternativeThemeDensity;
    fontFamily: string;
  };
  radius: {
    scale: AlternativeThemeRadiusScale;
  };
  shadows: {
    intensity: AlternativeThemeShadowIntensity;
    borderWidth: AlternativeThemeBorderWidth;
  };
  motivationalCard: {
    backgroundPrimary: string;
    backgroundSecondary: string;
    gradientStrength: number;
    titleColor: string;
    textColor: string;
    titleSize: AlternativeThemeMotivationalTextSize;
    textSize: AlternativeThemeMotivationalTextSize;
    iconBg: string;
    iconColor: string;
    iconStyle: AlternativeThemeMotivationalIconStyle;
    decorationColor: string;
    decorationOpacity: number;
    showDecorations: boolean;
    borderRadius: number;
    borderColor: string;
    borderWidth: number;
    shadowLevel: AlternativeThemeShadowIntensity;
    indicatorActive: string;
    indicatorInactive: string;
    indicatorSize: number;
    indicatorGap: number;
    defaultTitle: string;
    defaultText: string;
    phrases: string[];
    titles: string[];
  };
}

export const DEFAULT_ALTERNATIVE_THEME_CONFIG: AlternativeThemeConfig = {
  colors: {
    primary: "#2563EB",
    secondary: "#0EA5E9",
    accent: "#06B6D4",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  surfaces: {
    main: "#F7FAFC",
    card: "#FFFFFF",
    elevated: "#F9FCFF",
    cardBorder: "#DDE7F5",
    textPrimary: "#081633",
    textSecondary: "#64748B",
  },
  sidebar: {
    background: "#071F3E",
    activeItem: "#2563EB",
    hoverItem: "#123C6D",
    topbar: "#071F3E",
    bottomBar: "#062244",
    text: "#E8F3FF",
    icon: "#A8C7E8",
  },
  typography: {
    baseSize: "normal",
    visualWeight: "normal",
    density: "normal",
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  radius: {
    scale: "normal",
  },
  shadows: {
    intensity: "normal",
    borderWidth: "thin",
  },
  motivationalCard: {
    backgroundPrimary: "#0AA1D8",
    backgroundSecondary: "#062D66",
    gradientStrength: 58,
    titleColor: "#FFFFFF",
    textColor: "#F2F9FF",
    titleSize: "normal",
    textSize: "normal",
    iconBg: "#1AD7FF",
    iconColor: "#FFFFFF",
    iconStyle: "normal",
    decorationColor: "#90E8FF",
    decorationOpacity: 0.58,
    showDecorations: true,
    borderRadius: 22,
    borderColor: "#7DD3FC",
    borderWidth: 1,
    shadowLevel: "none",
    indicatorActive: "#FFFFFF",
    indicatorInactive: "#E0F2FE",
    indicatorSize: 5,
    indicatorGap: 6,
    defaultTitle: "Tu impacto hoy",
    defaultText: "La calma ayuda a sostener mejores hábitos.",
    phrases: [
      "La calma ayuda a sostener mejores hábitos.",
      "Cada seguimiento puede marcar diferencia.",
      "Nutrir también es cuidar.",
      "Pequeños hábitos crean grandes cambios.",
    ],
    titles: ["Tu impacto hoy", "Progreso real", "Nutrir también es cuidar", "Bienestar diario"],
  },
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const fontSizeScale: Record<AlternativeThemeFontSize, number> = {
  small: 13,
  normal: 14,
  large: 15.5,
};

const visualWeightValues: Record<AlternativeThemeVisualWeight, number> = {
  soft: 500,
  normal: 560,
  strong: 650,
};

const densityScale: Record<AlternativeThemeDensity, number> = {
  compact: 0.92,
  normal: 1,
  comfortable: 1.08,
};

const radiusValues: Record<AlternativeThemeRadiusScale, number> = {
  subtle: 14,
  normal: 20,
  rounded: 24,
  pill: 28,
};

const borderWidthValues: Record<AlternativeThemeBorderWidth, string> = {
  thin: "1px",
  normal: "1.5px",
};

const shadowValues: Record<AlternativeThemeShadowIntensity, { card: string; soft: string }> = {
  none: {
    card: "none",
    soft: "none",
  },
  soft: {
    card: "0 10px 24px rgba(15, 23, 42, 0.045)",
    soft: "0 6px 18px rgba(15, 23, 42, 0.035)",
  },
  normal: {
    card: "0 14px 34px rgba(15, 23, 42, 0.055), 0 2px 8px rgba(15, 23, 42, 0.025)",
    soft: "0 8px 24px rgba(15, 23, 42, 0.045)",
  },
  premium: {
    card: "0 18px 44px rgba(15, 23, 42, 0.085), 0 6px 18px rgba(37, 99, 235, 0.05)",
    soft: "0 12px 30px rgba(15, 23, 42, 0.065)",
  },
};

const motivationalTitleSizeValues: Record<AlternativeThemeMotivationalTextSize, string> = {
  small: "18px",
  normal: "19.7px",
  large: "21.5px",
};

const motivationalTextSizeValues: Record<AlternativeThemeMotivationalTextSize, string> = {
  small: "12.8px",
  normal: "13.8px",
  large: "14.8px",
};

const motivationalIconShadowValues: Record<AlternativeThemeMotivationalIconStyle, string> = {
  soft: "inset 0 1px 0 rgba(255, 255, 255, 0.14)",
  normal: "inset 0 1px 0 rgba(255, 255, 255, 0.22)",
  highlight: "0 0 0 6px rgba(255, 255, 255, 0.10), 0 12px 24px rgba(2, 8, 23, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.24)",
};

const motivationalShadowValues: Record<AlternativeThemeShadowIntensity, string> = {
  none: "inset 0 1px 0 rgba(255, 255, 255, 0.16)",
  soft: "0 10px 22px rgba(2, 8, 23, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
  normal: "0 14px 30px rgba(2, 8, 23, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
  premium: "0 18px 40px rgba(2, 8, 23, 0.24), 0 0 28px rgba(14, 165, 233, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
};

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

function sanitizeColor(value: unknown, fallback: string) {
  return isValidHexColor(value) ? value.toUpperCase() : fallback;
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function sanitizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
  return items.length > 0 ? items : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeOption<T extends string>(value: unknown, fallback: T, options: readonly T[]) {
  return typeof value === "string" && options.includes(value as T) ? value as T : fallback;
}

function legacyFontSize(value: unknown): AlternativeThemeFontSize {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_ALTERNATIVE_THEME_CONFIG.typography.baseSize;
  if (numberValue <= 13) return "small";
  if (numberValue >= 15) return "large";
  return "normal";
}

function legacyRadius(value: unknown): AlternativeThemeRadiusScale {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_ALTERNATIVE_THEME_CONFIG.radius.scale;
  if (numberValue <= 16) return "subtle";
  if (numberValue <= 22) return "normal";
  if (numberValue <= 26) return "rounded";
  return "pill";
}

function legacyShadow(value: unknown): AlternativeThemeShadowIntensity {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return DEFAULT_ALTERNATIVE_THEME_CONFIG.shadows.intensity;
  if (numberValue <= 0) return "none";
  if (numberValue <= 6) return "soft";
  if (numberValue <= 11) return "normal";
  return "premium";
}

export function hexToHslChannels(hex: string) {
  const normalizedHex = sanitizeColor(hex, "#000000");
  const red = parseInt(normalizedHex.slice(1, 3), 16) / 255;
  const green = parseInt(normalizedHex.slice(3, 5), 16) / 255;
  const blue = parseInt(normalizedHex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(lightness * 100)}%`;

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return `${Math.round((hue / 6) * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function normalizeAlternativeThemeConfig(value: unknown): AlternativeThemeConfig {
  const source = isRecord(value) ? value : {};
  const colors = isRecord(source.colors) ? source.colors : {};
  const surfaces = isRecord(source.surfaces) ? source.surfaces : {};
  const sidebar = isRecord(source.sidebar) ? source.sidebar : {};
  const typography = isRecord(source.typography) ? source.typography : {};
  const radius = isRecord(source.radius) ? source.radius : {};
  const shadows = isRecord(source.shadows) ? source.shadows : {};
  const motivationalCard = isRecord(source.motivationalCard) ? source.motivationalCard : {};
  const defaults = DEFAULT_ALTERNATIVE_THEME_CONFIG;

  return {
    colors: {
      primary: sanitizeColor(colors.primary ?? source.primaryColor, defaults.colors.primary),
      secondary: sanitizeColor(colors.secondary, defaults.colors.secondary),
      accent: sanitizeColor(colors.accent ?? source.accentColor, defaults.colors.accent),
      success: sanitizeColor(colors.success, defaults.colors.success),
      warning: sanitizeColor(colors.warning, defaults.colors.warning),
      danger: sanitizeColor(colors.danger, defaults.colors.danger),
    },
    surfaces: {
      main: sanitizeColor(surfaces.main ?? source.mainBackground, defaults.surfaces.main),
      card: sanitizeColor(surfaces.card ?? source.cardBackground, defaults.surfaces.card),
      elevated: sanitizeColor(surfaces.elevated, defaults.surfaces.elevated),
      cardBorder: sanitizeColor(surfaces.cardBorder, defaults.surfaces.cardBorder),
      textPrimary: sanitizeColor(surfaces.textPrimary ?? source.textPrimary, defaults.surfaces.textPrimary),
      textSecondary: sanitizeColor(surfaces.textSecondary ?? source.textSecondary, defaults.surfaces.textSecondary),
    },
    sidebar: {
      background: sanitizeColor(sidebar.background ?? source.sidebarColor, defaults.sidebar.background),
      activeItem: sanitizeColor(sidebar.activeItem ?? colors.primary ?? source.primaryColor, defaults.sidebar.activeItem),
      hoverItem: sanitizeColor(sidebar.hoverItem, defaults.sidebar.hoverItem),
      topbar: sanitizeColor(sidebar.topbar ?? source.topbarColor, defaults.sidebar.topbar),
      bottomBar: sanitizeColor(sidebar.bottomBar, defaults.sidebar.bottomBar),
      text: sanitizeColor(sidebar.text, defaults.sidebar.text),
      icon: sanitizeColor(sidebar.icon, defaults.sidebar.icon),
    },
    typography: {
      baseSize: sanitizeOption(
        typography.baseSize,
        legacyFontSize(source.baseFontSize),
        ["small", "normal", "large"] as const,
      ),
      visualWeight: sanitizeOption(
        typography.visualWeight,
        defaults.typography.visualWeight,
        ["soft", "normal", "strong"] as const,
      ),
      density: sanitizeOption(
        typography.density,
        defaults.typography.density,
        ["compact", "normal", "comfortable"] as const,
      ),
      fontFamily: typeof typography.fontFamily === "string" && typography.fontFamily.trim()
        ? typography.fontFamily.trim()
        : typeof source.fontFamily === "string" && source.fontFamily.trim()
          ? source.fontFamily.trim()
          : defaults.typography.fontFamily,
    },
    radius: {
      scale: sanitizeOption(
        radius.scale,
        legacyRadius(source.borderRadius),
        ["subtle", "normal", "rounded", "pill"] as const,
      ),
    },
    shadows: {
      intensity: sanitizeOption(
        shadows.intensity,
        legacyShadow(source.shadowIntensity),
        ["none", "soft", "normal", "premium"] as const,
      ),
      borderWidth: sanitizeOption(
        shadows.borderWidth,
        defaults.shadows.borderWidth,
        ["thin", "normal"] as const,
      ),
    },
    motivationalCard: {
      backgroundPrimary: sanitizeColor(motivationalCard.backgroundPrimary, defaults.motivationalCard.backgroundPrimary),
      backgroundSecondary: sanitizeColor(motivationalCard.backgroundSecondary, defaults.motivationalCard.backgroundSecondary),
      gradientStrength: sanitizeNumber(motivationalCard.gradientStrength, defaults.motivationalCard.gradientStrength, 0, 100),
      titleColor: sanitizeColor(motivationalCard.titleColor, defaults.motivationalCard.titleColor),
      textColor: sanitizeColor(motivationalCard.textColor, defaults.motivationalCard.textColor),
      titleSize: sanitizeOption(
        motivationalCard.titleSize,
        defaults.motivationalCard.titleSize,
        ["small", "normal", "large"] as const,
      ),
      textSize: sanitizeOption(
        motivationalCard.textSize,
        defaults.motivationalCard.textSize,
        ["small", "normal", "large"] as const,
      ),
      iconBg: sanitizeColor(motivationalCard.iconBg, defaults.motivationalCard.iconBg),
      iconColor: sanitizeColor(motivationalCard.iconColor, defaults.motivationalCard.iconColor),
      iconStyle: sanitizeOption(
        motivationalCard.iconStyle,
        defaults.motivationalCard.iconStyle,
        ["soft", "normal", "highlight"] as const,
      ),
      decorationColor: sanitizeColor(motivationalCard.decorationColor, defaults.motivationalCard.decorationColor),
      decorationOpacity: sanitizeNumber(motivationalCard.decorationOpacity, defaults.motivationalCard.decorationOpacity, 0, 1),
      showDecorations: typeof motivationalCard.showDecorations === "boolean"
        ? motivationalCard.showDecorations
        : defaults.motivationalCard.showDecorations,
      borderRadius: sanitizeNumber(motivationalCard.borderRadius, defaults.motivationalCard.borderRadius, 16, 30),
      borderColor: sanitizeColor(motivationalCard.borderColor, defaults.motivationalCard.borderColor),
      borderWidth: sanitizeNumber(motivationalCard.borderWidth, defaults.motivationalCard.borderWidth, 0, 3),
      shadowLevel: sanitizeOption(
        motivationalCard.shadowLevel,
        defaults.motivationalCard.shadowLevel,
        ["none", "soft", "normal", "premium"] as const,
      ),
      indicatorActive: sanitizeColor(motivationalCard.indicatorActive, defaults.motivationalCard.indicatorActive),
      indicatorInactive: sanitizeColor(motivationalCard.indicatorInactive, defaults.motivationalCard.indicatorInactive),
      indicatorSize: sanitizeNumber(motivationalCard.indicatorSize, defaults.motivationalCard.indicatorSize, 4, 9),
      indicatorGap: sanitizeNumber(motivationalCard.indicatorGap, defaults.motivationalCard.indicatorGap, 4, 12),
      defaultTitle: sanitizeText(motivationalCard.defaultTitle, defaults.motivationalCard.defaultTitle),
      defaultText: sanitizeText(motivationalCard.defaultText, defaults.motivationalCard.defaultText),
      phrases: sanitizeTextList(motivationalCard.phrases, defaults.motivationalCard.phrases),
      titles: sanitizeTextList(motivationalCard.titles, defaults.motivationalCard.titles),
    },
  };
}

export function readAlternativeThemeConfig(): AlternativeThemeConfig {
  if (typeof window === "undefined") return DEFAULT_ALTERNATIVE_THEME_CONFIG;

  try {
    const storedValue = window.localStorage.getItem(ALTERNATIVE_THEME_CONFIG_STORAGE_KEY);
    if (!storedValue) return DEFAULT_ALTERNATIVE_THEME_CONFIG;
    return normalizeAlternativeThemeConfig(JSON.parse(storedValue));
  } catch {
    return DEFAULT_ALTERNATIVE_THEME_CONFIG;
  }
}

export function saveAlternativeThemeConfig(config: AlternativeThemeConfig) {
  if (typeof window === "undefined") return;
  const normalizedConfig = normalizeAlternativeThemeConfig(config);
  window.localStorage.setItem(ALTERNATIVE_THEME_CONFIG_STORAGE_KEY, JSON.stringify(normalizedConfig));
  window.dispatchEvent(new CustomEvent(ALTERNATIVE_THEME_CONFIG_CHANGED_EVENT, { detail: normalizedConfig }));
}

export function resetAlternativeThemeConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ALTERNATIVE_THEME_CONFIG_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(ALTERNATIVE_THEME_CONFIG_CHANGED_EVENT, { detail: DEFAULT_ALTERNATIVE_THEME_CONFIG }));
}

export function applyAlternativeThemeConfig(root: HTMLElement, config: AlternativeThemeConfig) {
  const normalizedConfig = normalizeAlternativeThemeConfig(config);
  const radiusPx = radiusValues[normalizedConfig.radius.scale];
  const fontScale = fontSizeScale[normalizedConfig.typography.baseSize] / fontSizeScale.normal;
  const shadows = shadowValues[normalizedConfig.shadows.intensity];
  const motivationalCard = normalizedConfig.motivationalCard;
  const decorationOpacity = motivationalCard.showDecorations ? motivationalCard.decorationOpacity : 0;

  root.style.setProperty("--alt-bg-main", normalizedConfig.surfaces.main);
  root.style.setProperty("--alt-bg-main-hsl", hexToHslChannels(normalizedConfig.surfaces.main));
  root.style.setProperty("--alt-bg-shell", normalizedConfig.surfaces.elevated);
  root.style.setProperty("--alt-bg-elevated", normalizedConfig.surfaces.elevated);
  root.style.setProperty("--alt-bg-elevated-hsl", hexToHslChannels(normalizedConfig.surfaces.elevated));
  root.style.setProperty("--alt-bg-sidebar", normalizedConfig.sidebar.background);
  root.style.setProperty("--alt-bg-sidebar-deep", `color-mix(in srgb, ${normalizedConfig.sidebar.background} 62%, #020B1F)`);
  root.style.setProperty("--alt-bg-topbar", normalizedConfig.sidebar.topbar);
  root.style.setProperty("--alt-bg-bottombar", normalizedConfig.sidebar.bottomBar);
  root.style.setProperty("--alt-card-bg", normalizedConfig.surfaces.card);
  root.style.setProperty("--alt-card-bg-hsl", hexToHslChannels(normalizedConfig.surfaces.card));
  root.style.setProperty("--alt-card-border", normalizedConfig.surfaces.cardBorder);
  root.style.setProperty("--alt-card-border-hsl", hexToHslChannels(normalizedConfig.surfaces.cardBorder));
  root.style.setProperty("--alt-text-primary", normalizedConfig.surfaces.textPrimary);
  root.style.setProperty("--alt-text-primary-hsl", hexToHslChannels(normalizedConfig.surfaces.textPrimary));
  root.style.setProperty("--alt-text-secondary", normalizedConfig.surfaces.textSecondary);
  root.style.setProperty("--alt-text-secondary-hsl", hexToHslChannels(normalizedConfig.surfaces.textSecondary));

  root.style.setProperty("--alt-primary", normalizedConfig.colors.primary);
  root.style.setProperty("--alt-primary-hsl", hexToHslChannels(normalizedConfig.colors.primary));
  root.style.setProperty("--alt-primary-hover", normalizedConfig.colors.secondary);
  root.style.setProperty("--alt-secondary", normalizedConfig.colors.secondary);
  root.style.setProperty("--alt-secondary-hsl", hexToHslChannels(normalizedConfig.colors.secondary));
  root.style.setProperty("--alt-accent", normalizedConfig.colors.accent);
  root.style.setProperty("--alt-accent-hsl", hexToHslChannels(normalizedConfig.colors.accent));
  root.style.setProperty("--alt-cyan", normalizedConfig.colors.accent);
  root.style.setProperty("--alt-cyan-hsl", hexToHslChannels(normalizedConfig.colors.accent));
  root.style.setProperty("--alt-success", normalizedConfig.colors.success);
  root.style.setProperty("--alt-success-hsl", hexToHslChannels(normalizedConfig.colors.success));
  root.style.setProperty("--alt-mint", normalizedConfig.colors.success);
  root.style.setProperty("--alt-warning", normalizedConfig.colors.warning);
  root.style.setProperty("--alt-warning-hsl", hexToHslChannels(normalizedConfig.colors.warning));
  root.style.setProperty("--alt-orange", normalizedConfig.colors.warning);
  root.style.setProperty("--alt-danger", normalizedConfig.colors.danger);
  root.style.setProperty("--alt-danger-hsl", hexToHslChannels(normalizedConfig.colors.danger));

  root.style.setProperty("--alt-sidebar-active", normalizedConfig.sidebar.activeItem);
  root.style.setProperty("--alt-sidebar-hover", normalizedConfig.sidebar.hoverItem);
  root.style.setProperty("--alt-sidebar-text", normalizedConfig.sidebar.text);
  root.style.setProperty("--alt-sidebar-icon", normalizedConfig.sidebar.icon);
  root.style.setProperty("--alt-bottom-bar-color", normalizedConfig.sidebar.bottomBar);
  root.style.setProperty("--alt-bottom-bar-bg", `linear-gradient(90deg, ${normalizedConfig.sidebar.bottomBar} 0%, color-mix(in srgb, ${normalizedConfig.sidebar.bottomBar} 88%, ${normalizedConfig.colors.secondary}) 56%, color-mix(in srgb, ${normalizedConfig.sidebar.bottomBar} 84%, #020B1F) 100%)`);

  root.style.setProperty("--alt-radius", `${radiusPx}px`);
  root.style.setProperty("--alt-border-width", borderWidthValues[normalizedConfig.shadows.borderWidth]);
  root.style.setProperty("--alt-font-family", normalizedConfig.typography.fontFamily);
  root.style.setProperty("--alt-font-scale", String(fontScale));
  root.style.setProperty("--alt-font-base-size", `${fontSizeScale[normalizedConfig.typography.baseSize]}px`);
  root.style.setProperty("--alt-font-weight", String(visualWeightValues[normalizedConfig.typography.visualWeight]));
  root.style.setProperty("--alt-density-scale", String(densityScale[normalizedConfig.typography.density]));
  root.style.setProperty("--alt-shadow-card", shadows.card);
  root.style.setProperty("--alt-shadow-soft", shadows.soft);

  root.style.setProperty("--alt-impact-bg-primary", motivationalCard.backgroundPrimary);
  root.style.setProperty("--alt-impact-bg-secondary", motivationalCard.backgroundSecondary);
  root.style.setProperty("--alt-impact-gradient-strength", `${motivationalCard.gradientStrength}%`);
  root.style.setProperty("--alt-impact-title-color", motivationalCard.titleColor);
  root.style.setProperty("--alt-impact-text-color", motivationalCard.textColor);
  root.style.setProperty("--alt-impact-title-size", motivationalTitleSizeValues[motivationalCard.titleSize]);
  root.style.setProperty("--alt-impact-text-size", motivationalTextSizeValues[motivationalCard.textSize]);
  root.style.setProperty("--alt-impact-icon-bg", motivationalCard.iconBg);
  root.style.setProperty("--alt-impact-icon-color", motivationalCard.iconColor);
  root.style.setProperty("--alt-impact-icon-shadow", motivationalIconShadowValues[motivationalCard.iconStyle]);
  root.style.setProperty("--alt-impact-decoration-color", motivationalCard.decorationColor);
  root.style.setProperty("--alt-impact-decoration-opacity", String(decorationOpacity));
  root.style.setProperty("--alt-impact-border-radius", `${motivationalCard.borderRadius}px`);
  root.style.setProperty("--alt-impact-border-color", motivationalCard.borderColor);
  root.style.setProperty("--alt-impact-border-width", `${motivationalCard.borderWidth}px`);
  root.style.setProperty("--alt-impact-shadow", motivationalShadowValues[motivationalCard.shadowLevel]);
  root.style.setProperty("--alt-impact-dot-active", motivationalCard.indicatorActive);
  root.style.setProperty("--alt-impact-dot-inactive", motivationalCard.indicatorInactive);
  root.style.setProperty("--alt-impact-dot-size", `${motivationalCard.indicatorSize}px`);
  root.style.setProperty("--alt-impact-dot-active-width", `${Math.max(motivationalCard.indicatorSize * 3.4, motivationalCard.indicatorSize + 8)}px`);
  root.style.setProperty("--alt-impact-dot-gap", `${motivationalCard.indicatorGap}px`);
}
