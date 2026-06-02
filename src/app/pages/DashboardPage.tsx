import { useNavigate } from "react-router-dom";
import { Plus, Users as UsersIcon } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";

export function DashboardPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Panel"
        description="Resumen general de tu consultorio nutricional"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pacientes")}>
              <UsersIcon className="mr-2 h-4 w-4" />
              Ver pacientes
            </Button>
            <Button onClick={() => navigate("/pacientes/nuevo")}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo paciente
            </Button>
          </>
        }
      />

      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Pacientes activos" value="—" hint="Total registrados" />
          <KpiCard label="Consultas hoy" value="—" hint="Agenda del día" />
          <KpiCard label="Planes activos" value="—" hint="En seguimiento" />
          <KpiCard label="Pendientes sync" value="—" hint="Cambios sin enviar" />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Próximas consultas
                <Badge variant="secondary">Hoy</Badge>
              </CardTitle>
              <CardDescription>
                Aún no hay consultas programadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cuando agendes una consulta aparecerá aquí.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bienvenida</CardTitle>
              <CardDescription>
                Tu consultorio nutricional digital, sin conexión y sincronizable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Esta es la base de la aplicación. Los módulos clínicos se irán
                habilitando progresivamente.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Registra tu primer paciente para empezar.</li>
                <li>Las recomendaciones se basan en SMAE 5ª edición.</li>
                <li>Tus datos se guardan localmente y se cifran.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-xs uppercase tracking-wider">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
