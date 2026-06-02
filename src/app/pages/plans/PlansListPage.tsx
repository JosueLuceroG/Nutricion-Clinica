import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { EmptyState } from "@components/layout/EmptyState";
import { Plus } from "lucide-react";

export function PlansListPage() {
  return (
    <>
      <PageHeader
        title="Planes alimentarios"
        description="Diseño y seguimiento de planes nutricionales"
        actions={
          <Button asChild>
            <Link to="/planes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo plan
            </Link>
          </Button>
        }
      />
      <PageContent>
        <EmptyState
          title="Sin planes creados"
          description="Crea un plan alimentario basado en SMAE para tus pacientes."
        />
      </PageContent>
    </>
  );
}
