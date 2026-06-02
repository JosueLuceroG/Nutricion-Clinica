import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" description="Ajustes generales de la aplicación" />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
            <CardDescription>
              Tema, idioma, formato de fecha, zona horaria, unidades. Pendiente
              de UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Configuración respaldada en Zustand persist.
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
