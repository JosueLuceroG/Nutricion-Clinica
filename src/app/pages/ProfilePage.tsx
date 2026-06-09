import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User as UserIcon } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { useAuthStore } from "@store/authStore";

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <PageHeader title={t("layout.profile")} description={t("profile.description")} />
      <PageContent>
        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.no_session")}</CardTitle>
              <CardDescription>
                {t("profile.local_mode_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("profile.local_data_desc")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  {t("profile.professional_data")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label={t("common.name")} value={user.nombreCompleto} />
                <Row label={t("profile.role")} value={t(`auth.role_${user.rol}`)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("profile.session")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{t("profile.status")}: <Badge variant="success">{t("common.active")}</Badge></p>
                <p>{t("profile.mode")}: {t("profile.local_offline_first")}</p>
                <p className="border-t pt-2 text-xs">
                  <Link to="/configuracion" className="hover:underline">
                    {t("profile.general_settings")}
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </PageContent>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
