import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { UtensilsCrossed, ArrowRight, User } from "lucide-react";

export function PlansListPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t("mealplan.title")}
        description={t("mealplan.overview_description")}
        actions={
          <Button asChild variant="outline">
            <Link to="/pacientes">
              <User className="mr-2 h-4 w-4" />
              {t("command.go_patients")}
            </Link>
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                {t("mealplan.how_it_works")}
              </CardTitle>
              <CardDescription>
                {t("mealplan.how_it_works_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
                <li>{t("mealplan.step_select_patient")}</li>
                <li>{t("mealplan.step_open_record")}</li>
                <li>{t("mealplan.step_go_to_plans")}</li>
                <li>{t("mealplan.step_create_smae")}</li>
                <li>{t("mealplan.step_activate")}</li>
              </ol>
              <Button asChild className="mt-4">
                <Link to="/pacientes">
                  {t("mealplan.select_patient_action")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("mealplan.plan_states")}</CardTitle>
              <CardDescription>{t("mealplan.plan_lifecycle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <StateRow color="secondary" label={t("mealplan.status_draft")} desc={t("mealplan.state_draft_desc")} />
              <StateRow color="success" label={t("mealplan.status_active")} desc={t("mealplan.state_active_desc")} />
              <StateRow color="info" label={t("mealplan.status_completed")} desc={t("mealplan.state_completed_desc")} />
              <StateRow color="destructive" label={t("mealplan.status_cancelled")} desc={t("mealplan.state_cancelled_desc")} />
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}

function StateRow({ color, label, desc }: { color: "secondary" | "success" | "info" | "destructive"; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={
          color === "secondary"
            ? "mt-1.5 inline-block h-2 w-2 rounded-full bg-muted-foreground"
            : color === "success"
              ? "mt-1.5 inline-block h-2 w-2 rounded-full bg-green-600"
              : color === "info"
                ? "mt-1.5 inline-block h-2 w-2 rounded-full bg-blue-600"
                : "mt-1.5 inline-block h-2 w-2 rounded-full bg-destructive"
        }
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
