import * as React from "react";
import { useUIStore, type Theme } from "@store/uiStore";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((state) => state.theme);
  const setThemeStore = useUIStore((state) => state.setTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");

  React.useLayoutEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (newTheme: Theme) => {
      let nextResolvedTheme: "light" | "dark" = "light";

      root.classList.remove("light", "dark", "high-contrast");
      if (newTheme === "high-contrast") {
        root.classList.add("high-contrast");
        nextResolvedTheme = "light";
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
      root.style.colorScheme = nextResolvedTheme;
      setResolvedTheme(nextResolvedTheme);
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme: setThemeStore }),
    [theme, resolvedTheme, setThemeStore],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
