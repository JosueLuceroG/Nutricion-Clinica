import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function HelpPage() {
  return (
    <>
      <PageHeader title="Ayuda" description="Documentación y atajos de teclado" />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>Atajos de teclado</CardTitle>
            <CardDescription>Navega más rápido con estos atajos</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Abrir paleta de comandos</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">Ctrl K</kbd>
              </li>
              <li className="flex justify-between">
                <span>Colapsar/expandir menú</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">Ctrl B</kbd>
              </li>
              <li className="flex justify-between">
                <span>Nuevo paciente</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">N P</kbd>
              </li>
            </ul>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
