import { useParams, Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function PlanEditorPage() {
  const { planId } = useParams();
  return (
    <>
      <PageHeader
        title={planId ? "Editar plan" : "Nuevo plan alimentario"}
        description="Editor drag & drop de tiempos de comida"
        actions={
          <Button asChild variant="outline">
            <Link to="/planes">Volver</Link>
          </Button>
        }
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Editor de plan</CardTitle>
            <CardDescription>
              Integración con dnd-kit. Desglose: desayuno, colación, comida,
              colación, cena. Pendiente.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Reglas SMAE 5ª edición validadas en tiempo real.
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
