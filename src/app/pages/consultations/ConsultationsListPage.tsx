import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { EmptyState } from "@components/layout/EmptyState";
import { Plus, Info } from "lucide-react";

export function ConsultationsListPage() {
  return (
    <>
      <PageHeader
        title="Consultas"
        description="Vista global de la actividad clínica"
        actions={
          <Button asChild>
            <Link to="/pacientes">
              <Plus className="mr-2 h-4 w-4" />
              Seleccionar paciente
            </Link>
          </Button>
        }
      />
      <PageContent>
        <EmptyState
          icon={Info}
          title="Las consultas se registran desde el expediente del paciente"
          description="Selecciona un paciente para iniciar el wizard SOAP: datos básicos, subjetivo, objetivo, laboratorio, diagnóstico y plan."
          action={{
            label: "Ir a pacientes",
            onClick: () => {
              window.location.hash = "#/pacientes";
            },
          }}
        />
      </PageContent>
    </>
  );
}
