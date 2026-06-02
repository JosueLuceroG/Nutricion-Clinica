import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { EmptyState } from "@components/layout/EmptyState";
import { Plus } from "lucide-react";

export function ConsultationsListPage() {
  return (
    <>
      <PageHeader
        title="Consultas"
        description="Historial y agenda de consultas"
        actions={
          <Button asChild>
            <Link to="/consultas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva consulta
            </Link>
          </Button>
        }
      />
      <PageContent>
        <EmptyState
          title="Sin consultas registradas"
          description="Aquí aparecerán las consultas agendadas y el historial clínico."
        />
      </PageContent>
    </>
  );
}
