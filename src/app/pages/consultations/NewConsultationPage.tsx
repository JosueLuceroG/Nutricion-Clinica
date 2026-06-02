import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function NewConsultationPage() {
  return (
    <>
      <PageHeader
        title="Nueva consulta"
        description="Registro de consulta nutricional"
        actions={
          <Button asChild variant="outline">
            <Link to="/consultas">Cancelar</Link>
          </Button>
        }
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Formulario de consulta</CardTitle>
            <CardDescription>
              Aquí se integrará el flujo completo: paciente → antropometría →
              laboratorio → plan alimentario.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Wizard multi-paso, validación con Zod, autoguardado en IndexedDB.
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
