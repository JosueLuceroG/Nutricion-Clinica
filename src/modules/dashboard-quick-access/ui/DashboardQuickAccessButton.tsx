import * as React from "react";
import { ChevronDown, Loader2, Settings2, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import {
  DASHBOARD_QUICK_ACCESS_DEFINITIONS,
  DASHBOARD_QUICK_ACCESS_GROUPS,
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

const LONG_PRESS_DURATION_MS = 800;
const LONG_PRESS_MOVE_TOLERANCE_PX = 8;

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
  const persistenceStatus = useDashboardQuickAccessStore(
    (state) => state.persistenceStatus,
  );
  const saveConfig = useDashboardQuickAccessStore((state) => state.saveConfig);
  const storeError = useDashboardQuickAccessStore((state) => state.error);
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
  const [functionDialogOpen, setFunctionDialogOpen] = React.useState(false);
  const [selectedActionId, setSelectedActionId] =
    React.useState<DashboardQuickAccessActionId>(config.primaryActionId);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const longPressStartRef = React.useRef({ x: 0, y: 0 });
  const longPressTriggeredRef = React.useRef(false);

  const clearLongPressTimer = React.useCallback(() => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const openFunctionDialog = (suppressNextClick = false) => {
    clearLongPressTimer();
    longPressTriggeredRef.current = suppressNextClick;
    setMenuOpen(false);
    setSelectedActionId(config.primaryActionId);
    setFunctionDialogOpen(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (scopePending || (event.pointerType === "mouse" && event.button !== 0))
      return;
    if (config.mode === "menu") event.preventDefault();
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    longPressTimerRef.current = setTimeout(
      () => openFunctionDialog(true),
      LONG_PRESS_DURATION_MS,
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!longPressTimerRef.current) return;
    const distance = Math.hypot(
      event.clientX - longPressStartRef.current.x,
      event.clientY - longPressStartRef.current.y,
    );
    if (distance > LONG_PRESS_MOVE_TOLERANCE_PX) clearLongPressTimer();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const shortPress = Boolean(longPressTimerRef.current);
    clearLongPressTimer();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (config.mode === "menu" && shortPress) {
      event.preventDefault();
      setMenuOpen(true);
    }
  };

  const handlePointerCancel = () => {
    clearLongPressTimer();
  };

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      config.mode === "direct" &&
      !scopePending &&
      primaryAvailability.enabled
    ) {
      executeAction(config.primaryActionId);
    }
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      openFunctionDialog();
    }
  };

  const selectedDefinition =
    getDashboardQuickAccessDefinition(selectedActionId);
  const SelectedIcon = DASHBOARD_QUICK_ACCESS_ICONS[selectedDefinition.iconId];
  const savingFunction = persistenceStatus === "saving";

  const saveSelectedFunction = async () => {
    if (scopePending || savingFunction) return;
    if (selectedActionId === config.primaryActionId) {
      setFunctionDialogOpen(false);
      return;
    }
    const succeeded = await saveConfig({
      ...config,
      buttonIconId: null,
      primaryActionId: selectedActionId,
      secondaryActionIds: config.secondaryActionIds.filter(
        (actionId) => actionId !== selectedActionId,
      ),
    });
    if (succeeded) setFunctionDialogOpen(false);
  };

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
      onClick={handleTriggerClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleTriggerKeyDown}
      onContextMenu={(event) => {
        if (scopePending) return;
        event.preventDefault();
        openFunctionDialog();
      }}
      disabled={
        scopePending ||
        (config.mode === "direct" && !primaryAvailability.enabled)
      }
      title={
        scopePending
          ? t("dashboardQuickAccess.settings.loading")
          : config.mode === "direct" && primaryAvailability.reasonKey
            ? t(primaryAvailability.reasonKey)
            : t("dashboardQuickAccess.quickEdit.holdHint", { action: label })
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

  const functionDialog = (
    <Dialog
      open={functionDialogOpen}
      onOpenChange={(open) => {
        if (!savingFunction) setFunctionDialogOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" aria-hidden="true" />
            {t("dashboardQuickAccess.quickEdit.title")}
          </DialogTitle>
          <DialogDescription>
            {t("dashboardQuickAccess.quickEdit.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <span
            id="dashboard-quick-access-function-label"
            className="text-sm font-medium"
          >
            {t("dashboardQuickAccess.quickEdit.actionLabel")}
          </span>
          <Select
            value={selectedActionId}
            onValueChange={(value) =>
              setSelectedActionId(value as DashboardQuickAccessActionId)
            }
            disabled={savingFunction}
          >
            <SelectTrigger aria-labelledby="dashboard-quick-access-function-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[min(65vh,420px)]">
              {DASHBOARD_QUICK_ACCESS_GROUPS.map((group) => (
                <SelectGroup key={group.id} aria-label={t(group.labelKey)}>
                  <div
                    className="px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground"
                    aria-hidden="true"
                  >
                    {t(group.labelKey)}
                  </div>
                  {DASHBOARD_QUICK_ACCESS_DEFINITIONS.filter(
                    (definition) => definition.group === group.id,
                  ).map((definition) => {
                    const availability = getDashboardQuickAccessAvailability(
                      definition,
                      context,
                    );
                    const actionLabel = t(definition.labelKey);
                    const reason = availability.reasonKey
                      ? t(availability.reasonKey)
                      : null;
                    return (
                      <SelectItem
                        key={definition.id}
                        value={definition.id}
                        disabled={!availability.enabled}
                        textValue={actionLabel}
                      >
                        <span>
                          {actionLabel}
                          {reason ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({reason})
                            </span>
                          ) : null}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-primary">
              <SelectedIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-medium">
                {t(selectedDefinition.labelKey)}
              </strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t(selectedDefinition.descriptionKey)}
              </span>
            </span>
          </div>

          {persistenceStatus === "error" && storeError ? (
            <p className="text-sm text-destructive" role="alert">
              {storeError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={savingFunction}
            onClick={() => setFunctionDialogOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={scopePending || savingFunction}
            onClick={() => void saveSelectedFunction()}
          >
            {savingFunction ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t(
              savingFunction
                ? "dashboardQuickAccess.quickEdit.saving"
                : "dashboardQuickAccess.quickEdit.save",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (config.mode === "direct") {
    return (
      <>
        {trigger}
        {functionDialog}
      </>
    );
  }

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          if (!longPressTriggeredRef.current) setMenuOpen(open);
        }}
      >
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
      {functionDialog}
    </>
  );
}
