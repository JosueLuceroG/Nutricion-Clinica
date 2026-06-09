import { Link } from "react-router-dom";
import { Bell, Inbox, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { EmptyState } from "@components/layout/EmptyState";
import { useNotificationStore } from "@store/notificationStore";

export function NotificationsPage() {
  const { t } = useTranslation();
  const unread = useNotificationStore((s) => s.unread);
  const clear = useNotificationStore((s) => s.clear);

  return (
    <>
      <PageHeader
        title={t("pages.notifications_title")}
        description={t("pages.notifications_description")}
        actions={
          <Button variant="outline" onClick={clear} disabled={unread === 0}>
            <Check className="mr-2 h-4 w-4" />
            {t("pages.notifications_mark_read")}
          </Button>
        }
      />
      <PageContent>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t("pages.notifications_inbox")}
            </CardTitle>
            <CardDescription>
              {t("pages.notifications_inbox_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title={unread > 0 ? t("pages.notifications_unread", { count: unread }) : t("pages.notifications_empty_title")}
              description={t("pages.notifications_empty_description")}
              action={{
                label: t("pages.notifications_go_dashboard"),
                onClick: () => {
                  window.location.hash = "#/";
                },
              }}
            />
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            {t("pages.notifications_go_dashboard")}
          </Link>
        </p>
      </PageContent>
    </>
  );
}
