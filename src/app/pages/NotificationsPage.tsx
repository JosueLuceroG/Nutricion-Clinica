import { Link } from "react-router-dom";
import { Bell, Inbox, Check } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { EmptyState } from "@components/layout/EmptyState";
import { useNotificationStore } from "@store/notificationStore";

export function NotificationsPage() {
  const unread = useNotificationStore((s) => s.unread);
  const clear = useNotificationStore((s) => s.clear);

  return (
    <>
      <PageHeader
        title="Notificaciones"
        description="Cambios, recordatorios y alertas del sistema"
        actions={
          <Button variant="outline" onClick={clear} disabled={unread === 0}>
            <Check className="mr-2 h-4 w-4" />
            Marcar todas como leídas
          </Button>
        }
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Bandeja
            </CardTitle>
            <CardDescription>
              Las notificaciones se generan automáticamente al agendar consultas, vencer planes o
              requerir seguimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title={unread > 0 ? `${unread} sin leer` : "Sin notificaciones"}
              description="Cuando ocurran eventos clínicos relevantes aparecerán aquí."
              action={{
                label: "Volver al panel",
                onClick: () => {
                  window.location.hash = "#/";
                },
              }}
            />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            Volver al panel
          </Link>
        </p>
      </PageContent>
    </>
  );
}
