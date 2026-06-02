import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { UtensilsCrossed, ArrowRight, User } from "lucide-react";

export function PlansListPage() {
  return (
    <>
      <PageHeader
        title="Planes alimentarios"
        description="Diseño y seguimiento basados en SMAE 5ª edición"
        actions={
          <Button asChild variant="outline">
            <Link to="/pacientes">
              <User className="mr-2 h-4 w-4" />
              Ir a pacientes
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                ¿Cómo funcionan los planes?
              </CardTitle>
              <CardDescription>
                Los planes se crean desde el expediente del paciente, donde se conoce el contexto clínico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
                <li>Selecciona un paciente de la lista</li>
                <li>Abre su expediente clínico</li>
                <li>Ve a la sección "Planes alimentarios"</li>
                <li>Crea un plan basado en equivalentes SMAE</li>
                <li>Actívalo cuando esté listo para entrega al paciente</li>
              </ol>
              <Button asChild className="mt-4">
                <Link to="/pacientes">
                  Seleccionar paciente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estados del plan</CardTitle>
              <CardDescription>Ciclo de vida de un plan alimentario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <StateRow color="secondary" label="Borrador" desc="En construcción, no se entrega al paciente" />
              <StateRow color="success" label="Activo" desc="Vigente, es el plan actual del paciente" />
              <StateRow color="info" label="Completado" desc="Paciente egresado del plan" />
              <StateRow color="destructive" label="Cancelado" desc="Sustituido por otro plan" />
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}

function StateRow({ color, label, desc }: { color: "secondary" | "success" | "info" | "destructive"; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={
          color === "secondary"
            ? "mt-1.5 inline-block h-2 w-2 rounded-full bg-muted-foreground"
            : color === "success"
              ? "mt-1.5 inline-block h-2 w-2 rounded-full bg-green-600"
              : color === "info"
                ? "mt-1.5 inline-block h-2 w-2 rounded-full bg-blue-600"
                : "mt-1.5 inline-block h-2 w-2 rounded-full bg-destructive"
        }
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
