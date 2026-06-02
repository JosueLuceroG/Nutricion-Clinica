import { ThemeProvider } from "@app/providers/ThemeProvider";
import { NotificationProvider } from "@app/providers/NotificationProvider";
import { AppRouter } from "@app/router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@components/ui/tooltip";

export function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <TooltipProvider delayDuration={300}>
          <AppRouter />
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
