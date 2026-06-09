import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@app/providers/ThemeProvider";
import { Button } from "@components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu";

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (collapsed) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="w-full justify-center"
        aria-label="Cambiar tema"
      >
        {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-2">
          {resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <span className="flex-1 truncate text-left">
            {theme === "light" ? "Claro" : theme === "dark" ? "Oscuro" : theme === "system" ? "Sistema" : "Alto contraste"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-40">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Oscuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
