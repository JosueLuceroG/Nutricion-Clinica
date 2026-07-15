import * as React from "react";
import { Link } from "react-router-dom";
import { Archive, Bell, Check, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { EmptyState } from "@components/layout/EmptyState";
import { useAuthStore } from "@store/authStore";
import {
  notificationStorageKey,
  useNotificationStore,
  type DashboardNotification,
  type NotificationTab,
  type NotificationTone,
} from "@store/notificationStore";

const notificationToneClasses: Record<NotificationTone, string> = {
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  aqua: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  slate: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const notificationTabs: NotificationTab[] = ["inbox", "general", "archived"];

function isVisibleInTab(
  notification: DashboardNotification,
  tab: NotificationTab,
): boolean {
  if (tab === "archived") return notification.archived;
  if (notification.archived) return false;
  return tab === "general" || notification.type === "patient_message";
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const scopeKey = useNotificationStore((state) => state.scopeKey);
  const hydrationStatus = useNotificationStore(
    (state) => state.hydrationStatus,
  );
  const items = useNotificationStore((state) => state.items);
  const activeTab = useNotificationStore((state) => state.activeTab);
  const unread = useNotificationStore((state) => state.unread);
  const setActiveTab = useNotificationStore((state) => state.setActiveTab);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const archive = useNotificationStore((state) => state.archive);
  const resolveAction = useNotificationStore((state) => state.resolveAction);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const expectedScopeKey = userId
    ? notificationStorageKey({ userId, sucursalId })
    : null;
  const scopeReady =
    hydrationStatus === "ready" && scopeKey === expectedScopeKey;
  const scopedItems = scopeReady ? items : [];
  const displayedTab: NotificationTab = scopeReady ? activeTab : "inbox";
  const visibleItems = scopedItems.filter((notification) =>
    isVisibleInTab(notification, displayedTab),
  );
  const tabs: Array<{ key: NotificationTab; label: string; count: number }> = [
    {
      key: "inbox",
      label: t("pages.notifications_inbox"),
      count: scopedItems.filter((notification) =>
        isVisibleInTab(notification, "inbox"),
      ).length,
    },
    {
      key: "general",
      label: t("pages.notifications_general"),
      count: scopedItems.filter((notification) =>
        isVisibleInTab(notification, "general"),
      ).length,
    },
    {
      key: "archived",
      label: t("pages.notifications_archived"),
      count: scopedItems.filter((notification) =>
        isVisibleInTab(notification, "archived"),
      ).length,
    },
  ];
  const activeTabLabel =
    tabs.find((tab) => tab.key === displayedTab)?.label ??
    t("pages.notifications_inbox");

  const selectTab = (index: number) => {
    const tab = notificationTabs[index];
    if (!tab || !scopeReady) return;
    setActiveTab(tab);
    tabRefs.current[index]?.focus();
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight")
      nextIndex = (index + 1) % notificationTabs.length;
    if (event.key === "ArrowLeft")
      nextIndex =
        (index - 1 + notificationTabs.length) % notificationTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = notificationTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex);
  };

  return (
    <>
      <PageHeader
        title={t("pages.notifications_title")}
        description={t("pages.notifications_description")}
        actions={
          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={!scopeReady || unread === 0}
          >
            <Check className="h-4 w-4" aria-hidden />
            {t("pages.notifications_mark_read")}
          </Button>
        }
      />
      <PageContent className="mx-auto w-full max-w-5xl">
        <Card className="overflow-hidden">
          <CardHeader className="gap-1 border-b">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" aria-hidden />
                {activeTabLabel}
              </CardTitle>
              {scopeReady && unread > 0 && (
                <Badge variant="secondary">
                  {t("pages.notifications_unread", { count: unread })}
                </Badge>
              )}
            </div>
            <CardDescription>
              {t("pages.notifications_inbox_description")}
            </CardDescription>
          </CardHeader>

          <div
            className="flex gap-1 overflow-x-auto border-b bg-muted/20 p-2"
            role="tablist"
            aria-label={t("pages.notifications_tablist_label")}
          >
            {tabs.map((tab, index) => {
              const selected = displayedTab === tab.key;
              return (
                <button
                  type="button"
                  key={tab.key}
                  id={`notification-tab-${tab.key}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls="notification-list"
                  tabIndex={selected ? 0 : -1}
                  disabled={!scopeReady}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  onClick={() => setActiveTab(tab.key)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <CardContent className="p-0">
            <div
              id="notification-list"
              role="tabpanel"
              aria-labelledby={`notification-tab-${displayedTab}`}
              aria-busy={!scopeReady}
            >
              {!scopeReady ? (
                <div
                  className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground"
                  role="status"
                >
                  {t("pages.notifications_loading")}
                </div>
              ) : visibleItems.length === 0 ? (
                <EmptyState
                  className="m-4 sm:m-6"
                  icon={Inbox}
                  title={t("pages.notifications_empty_title")}
                  description={t("pages.notifications_empty_description")}
                />
              ) : (
                <div className="divide-y" role="list">
                  {visibleItems.map((notification) => (
                    <article
                      key={notification.id}
                      role="listitem"
                      className={`relative flex min-w-0 gap-3 p-4 transition-colors sm:gap-4 sm:p-5 ${
                        !notification.read && !notification.archived
                          ? "bg-primary/[0.035]"
                          : "bg-background"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-11 sm:w-11 ${notificationToneClasses[notification.tone]}`}
                        aria-hidden="true"
                      >
                        {notification.initials}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <p className="min-w-0 flex-1 text-sm leading-6 text-foreground">
                            {notification.personName && (
                              <strong>{notification.personName} </strong>
                            )}
                            {notification.message}
                            {notification.subject && (
                              <strong>{notification.subject}</strong>
                            )}
                            {notification.suffix}
                          </p>
                          {!notification.read && !notification.archived && (
                            <>
                              <span
                                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                {t("pages.notifications_unread", { count: 1 })}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{notification.timeAgo}</span>
                          <span aria-hidden="true">•</span>
                          <span>{notification.category}</span>
                        </div>

                        {notification.requiresAction &&
                          notification.actions &&
                          !notification.read &&
                          !notification.archived && (
                            <div
                              className="flex flex-wrap gap-2"
                              aria-label={t(
                                "pages.notifications_actions_label",
                              )}
                            >
                              {notification.actions.includes("reject") && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    resolveAction(notification.id, "reject")
                                  }
                                >
                                  {t("pages.notifications_reject")}
                                </Button>
                              )}
                              {notification.actions.includes("accept") && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    resolveAction(notification.id, "accept")
                                  }
                                >
                                  {t("pages.notifications_accept")}
                                </Button>
                              )}
                            </div>
                          )}

                        {!notification.archived && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {!notification.read && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => markRead(notification.id)}
                              >
                                <Check className="h-4 w-4" aria-hidden />
                                {t("pages.notifications_mark_one_read")}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => archive(notification.id)}
                            >
                              <Archive className="h-4 w-4" aria-hidden />
                              {t("common.archive")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
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
