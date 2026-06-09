import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";

export function HelpPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("help.title")} description={t("help.page_description")} />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle>{t("help.keyboard_shortcuts")}</CardTitle>
            <CardDescription>{t("help.shortcuts_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>{t("help.open_command_palette")}</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">Ctrl K</kbd>
              </li>
              <li className="flex justify-between">
                <span>{t("help.collapse_expand_menu")}</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">Ctrl B</kbd>
              </li>
              <li className="flex justify-between">
                <span>{t("patient.new")}</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">N P</kbd>
              </li>
            </ul>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
