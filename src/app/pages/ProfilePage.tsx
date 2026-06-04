import { Link } from "react-router-dom";
import { User as UserIcon } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { useAuthStore } from "@store/authStore";
import { RoleLabel } from "@nutriclinica/shared";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <PageHeader title="Mi perfil" description="Información del profesional" />
      <PageContent>
        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle>Sin sesión iniciada</CardTitle>
              <CardDescription>
                NutriClinica funciona en modo local. La autenticación se habilita en Fase 3.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Los datos locales están cifrados en reposo. La sincronización entre dispositivos se
              implementará en una fase posterior.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Datos del profesional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Nombre" value={user.nombreCompleto} />
                <Row label="Rol" value={RoleLabel[user.rol]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sesión</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Estado: <Badge variant="success">Activo</Badge></p>
                <p>Modo: local (offline-first)</p>
                <p className="border-t pt-2 text-xs">
                  <Link to="/configuracion" className="hover:underline">
                    Configuración general
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </PageContent>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
