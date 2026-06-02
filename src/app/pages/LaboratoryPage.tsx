import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function LaboratoryPage() {
  return (
    <>
      <PageHeader
        title="Laboratorio"
        description="Indicadores bioquímicos y estudios de laboratorio"
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Resultados de laboratorio</CardTitle>
            <CardDescription>
              Glucosa, perfil lipídico, función renal, función hepática, etc.
              Pendiente de implementación.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Interpretación automática de acuerdo a rangos de referencia.
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
