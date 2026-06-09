import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function CalculationsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t("calculations.clinical_title")}
        description={t("calculations.page_description")}
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>{t("calculations.calculators")}</CardTitle>
            <CardDescription>
              {t("calculations.pending_ui_description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("calculations.pure_functions_hint", { path: "src/utils/calculations/" })}
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
