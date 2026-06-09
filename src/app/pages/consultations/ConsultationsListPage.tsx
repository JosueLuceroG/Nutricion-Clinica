import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { EmptyState } from "@components/layout/EmptyState";
import { Plus, Info } from "lucide-react";

export function ConsultationsListPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t("consultation.title")}
        description={t("consultation.search_placeholder")}
        actions={
          <Button asChild>
            <Link to="/pacientes">
              <Plus className="mr-2 h-4 w-4" />
              {t("consultation.select_patient")}
            </Link>
          </Button>
        }
      />
      <PageContent>
        <EmptyState
          icon={Info}
          title={t("consultation.no_consultations")}
          description={t("consultation.select_patient")}
          action={{
            label: t("patient.title"),
            onClick: () => {
              window.location.hash = "#/pacientes";
            },
          }}
        />
      </PageContent>
    </>
  );
}
