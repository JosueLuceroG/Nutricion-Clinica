import { ChevronDown, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  DASHBOARD_QUICK_ACCESS_ICONS,
  getDashboardQuickAccessAvailability,
  getDashboardQuickAccessDefinition,
  useDashboardQuickAccessExecutor,
} from "@modules/dashboard-quick-access/application";
import {
  createDefaultDashboardQuickAccessConfig,
  type DashboardQuickAccessActionId,
} from "@modules/dashboard-quick-access/domain";
import { dashboardQuickAccessStorageKey } from "@modules/dashboard-quick-access/infrastructure";
import { useAuthStore } from "@store/authStore";
import { useDashboardQuickAccessStore } from "@store/dashboardQuickAccessStore";

interface DashboardQuickAccessButtonProps {
  onCustomizeDashboard?: () => void;
  dashboardEditing?: boolean;
}

export function DashboardQuickAccessButton({
  onCustomizeDashboard,
  dashboardEditing = false,
}: DashboardQuickAccessButtonProps) {
  const { t } = useTranslation();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const role = useAuthStore((state) => state.user?.rol ?? null);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const scopeKey = useDashboardQuickAccessStore((state) => state.scopeKey);
  const hydrationStatus = useDashboardQuickAccessStore(
    (state) => state.hydrationStatus,
  );
  const savedConfig = useDashboardQuickAccessStore((state) => state.config);
  const expectedScopeKey = userId
    ? dashboardQuickAccessStorageKey({ userId, sucursalId })
    : null;
  const scopePending =
    expectedScopeKey !== scopeKey ||
    hydrationStatus === "idle" ||
    hydrationStatus === "loading";
  const config =
    expectedScopeKey === scopeKey && hydrationStatus === "ready"
      ? savedConfig
      : createDefaultDashboardQuickAccessConfig();
  const primaryDefinition = getDashboardQuickAccessDefinition(
    config.primaryActionId,
  );
  const TriggerIcon =
    DASHBOARD_QUICK_ACCESS_ICONS[
      config.buttonIconId ?? primaryDefinition.iconId
    ];
  const label = config.buttonLabel ?? t(primaryDefinition.labelKey);
  const context = {
    role,
    sucursalId,
    dashboardEditing,
    dashboardCustomizerAvailable: Boolean(onCustomizeDashboard),
  };
  const primaryAvailability = getDashboardQuickAccessAvailability(
    primaryDefinition,
    context,
  );
  const { executeAction } = useDashboardQuickAccessExecutor({
    onCustomizeDashboard,
    dashboardEditing,
  });

  const renderMenuItem = (
    actionId: DashboardQuickAccessActionId,
    primary: boolean,
  ) => {
    const definition = getDashboardQuickAccessDefinition(actionId);
    const availability = getDashboardQuickAccessAvailability(
      definition,
      context,
    );
    const ItemIcon = DASHBOARD_QUICK_ACCESS_ICONS[definition.iconId];
    const reason = availability.reasonKey ? t(availability.reasonKey) : null;

    return (
      <DropdownMenuItem
        key={actionId}
        disabled={!availability.enabled}
        className="min-w-0 items-start gap-3 rounded-lg px-3 py-2.5"
        onSelect={() => executeAction(actionId)}
        title={reason ?? undefined}
      >
        <ItemIcon
          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-medium">
            <span className="truncate">{t(definition.labelKey)}</span>
            {primary ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                <Star className="h-2.5 w-2.5" aria-hidden="true" />
                {t("dashboardQuickAccess.menu.primary")}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {reason ?? t(definition.descriptionKey)}
          </span>
        </span>
      </DropdownMenuItem>
    );
  };

  const trigger = (
    <button
      type="button"
      className="nc-dashboard-button nc-dashboard-button--outline nc-dashboard-quick-access"
      onClick={
        config.mode === "direct" && !scopePending
          ? () => executeAction(config.primaryActionId)
          : undefined
      }
      disabled={
        scopePending ||
        (config.mode === "direct" && !primaryAvailability.enabled)
      }
      title={
        scopePending
          ? t("dashboardQuickAccess.settings.loading")
          : config.mode === "direct" && primaryAvailability.reasonKey
            ? t(primaryAvailability.reasonKey)
            : label
      }
      aria-label={label}
      aria-haspopup={config.mode === "menu" ? "menu" : undefined}
      aria-busy={scopePending || undefined}
      data-quick-access-mode={config.mode}
    >
      <TriggerIcon size={16} strokeWidth={2} aria-hidden="true" />
      <span className="nc-dashboard-quick-access__label">{label}</span>
      {config.mode === "menu" ? (
        <ChevronDown
          className="nc-dashboard-quick-access__chevron"
          size={13}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );

  if (config.mode === "direct") return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="max-h-[min(70vh,420px)] w-[min(320px,calc(100vw-24px))] overflow-y-auto rounded-xl p-1.5"
      >
        {renderMenuItem(config.primaryActionId, true)}
        {config.secondaryActionIds.length > 0 ? (
          <DropdownMenuSeparator className="my-1.5" />
        ) : null}
        {config.secondaryActionIds.map((actionId) =>
          renderMenuItem(actionId, false),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
