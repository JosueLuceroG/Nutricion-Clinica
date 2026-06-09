import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import { PageContent } from "@app/layout/AppLayout";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <PageContent className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="text-6xl font-bold tabular-nums">{t("pages.not_found_title")}</div>
      <h1 className="text-xl font-semibold">{t("pages.not_found_heading")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("pages.not_found_desc")}
      </p>
      <Button asChild>
        <Link to="/">{t("pages.go_home")}</Link>
      </Button>
    </PageContent>
  );
}
