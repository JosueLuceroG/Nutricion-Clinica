import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageContent } from "@app/layout/AppLayout";

export function NotFoundPage() {
  return (
    <PageContent className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="text-6xl font-bold tabular-nums">404</div>
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        La ruta que buscas no existe o fue movida.
      </p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </PageContent>
  );
}
