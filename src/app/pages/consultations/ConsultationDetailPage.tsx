import { useParams, Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function ConsultationDetailPage() {
  const { consultationId } = useParams();
  return (
    <>
      <PageHeader
        title="Detalle de consulta"
        description={`Consulta ${consultationId}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/consultas">Volver</Link>
          </Button>
        }
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Resumen clínico</CardTitle>
            <CardDescription>
              Snapshot inmutable de la consulta. Vista en construcción.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Antropometría, signos vitales, indicadores bioquímicos, plan asignado.
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
