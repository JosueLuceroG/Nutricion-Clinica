import { ThemeProvider } from "@app/providers/ThemeProvider";
import { NotificationProvider } from "@app/providers/NotificationProvider";
import { AppRouter } from "@app/router";
import { Toaster } from "sonner";

export function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AppRouter />
        <Toaster position="bottom-right" richColors closeButton />
      </NotificationProvider>
    </ThemeProvider>
  );
}
