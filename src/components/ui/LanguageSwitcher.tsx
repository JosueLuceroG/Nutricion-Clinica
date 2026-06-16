import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu";

const languages = [
  { code: "es-MX", label: "Español (MX)" },
  { code: "en-US", label: "English (US)" },
] as const;

export function LanguageSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { i18n, t } = useTranslation();

  const currentLang = languages.find((l) => l.code === i18n.language) ?? languages[0];

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const next = i18n.language === "es-MX" ? "en-US" : "es-MX";
          void i18n.changeLanguage(next);
        }}
        className="w-full justify-center"
        aria-label={t("layout.change_language")}
      >
        <Globe className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-2" aria-label={currentLang.label}>
          <Globe className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{currentLang.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-40">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => void i18n.changeLanguage(lang.code)}
            className={i18n.language === lang.code ? "font-medium" : ""}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
