import * as React from "react";
import {
  ALTERNATIVE_THEME_CONFIG_CHANGED_EVENT,
  THEME_STORAGE_KEY,
  applyAlternativeThemeConfig,
  readAlternativeThemeConfig,
} from "@app/theme/alternativeTheme";
import { useUIStore, type Theme } from "@store/uiStore";

type ResolvedTheme = "light" | "dark" | "alternative";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((state) => state.theme);
  const setThemeStore = useUIStore((state) => state.setTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useLayoutEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isStoredTheme(storedTheme) && storedTheme !== theme) {
        setThemeStore(storedTheme);
      } else if (storedTheme !== null && !isStoredTheme(storedTheme)) {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      }
    } catch {
      // The zustand store remains the source of truth if localStorage is unavailable.
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useLayoutEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (newTheme: Theme) => {
      let nextResolvedTheme: ResolvedTheme = "light";

      root.classList.remove("light", "dark", "alternative", "high-contrast");
      if (newTheme === "high-contrast") {
        root.classList.add("high-contrast");
        nextResolvedTheme = "light";
      } else if (newTheme === "alternative") {
        applyAlternativeThemeConfig(root, readAlternativeThemeConfig());
        root.classList.add("alternative");
        nextResolvedTheme = "alternative";
      } else if (newTheme === "system") {
        nextResolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(nextResolvedTheme);
      } else {
        root.classList.add(newTheme);
        nextResolvedTheme = newTheme;
      }

      root.dataset.theme = nextResolvedTheme;
      root.style.colorScheme = nextResolvedTheme === "dark" ? "dark" : "light";
      setResolvedTheme(nextResolvedTheme);

      try {
        if (isStoredTheme(newTheme)) {
          window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        } else {
          window.localStorage.removeItem(THEME_STORAGE_KEY);
        }
      } catch {
        // Theme persistence is best-effort.
      }
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  React.useEffect(() => {
    if (theme !== "alternative") return;

    const handleAlternativeThemeConfigChanged = () => {
      applyAlternativeThemeConfig(window.document.documentElement, readAlternativeThemeConfig());
    };

    window.addEventListener(ALTERNATIVE_THEME_CONFIG_CHANGED_EVENT, handleAlternativeThemeConfigChanged);
    return () => window.removeEventListener(ALTERNATIVE_THEME_CONFIG_CHANGED_EVENT, handleAlternativeThemeConfigChanged);
  }, [theme]);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme: setThemeStore }),
    [theme, resolvedTheme, setThemeStore],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function isStoredTheme(value: unknown): value is Extract<Theme, "light" | "dark" | "alternative"> {
  return value === "light" || value === "dark" || value === "alternative";
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
