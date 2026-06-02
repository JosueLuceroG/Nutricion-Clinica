import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function CalculationsPage() {
  return (
    <>
      <PageHeader
        title="Cálculos clínicos"
        description="Calculadoras nutricionales validadas"
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Calculadoras</CardTitle>
            <CardDescription>
              BMI, BMR (Harris-Benedict, Mifflin-St Jeor), TDEE, distribución
              de macronutrientes. Pendiente de UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Las funciones puras están en <code>src/utils/calculations/</code> con
            pruebas unitarias.
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
