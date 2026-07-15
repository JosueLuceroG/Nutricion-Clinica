import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  List,
  Loader2,
  MousePointerClick,
  Palette,
  RotateCcw,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
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
  type DashboardQuickAccessRuntimeContext,
} from "@modules/dashboard-quick-access/application";
import {
  DASHBOARD_QUICK_ACCESS_ICON_IDS,
  parseDashboardQuickAccessConfig,
  type DashboardQuickAccessActionId,
  type DashboardQuickAccessConfig,
  type DashboardQuickAccessIconId,
} from "@modules/dashboard-quick-access/domain";
import { dashboardQuickAccessStorageKey } from "@modules/dashboard-quick-access/infrastructure";
import { useAuthStore } from "@store/authStore";
import { useDashboardQuickAccessStore } from "@store/dashboardQuickAccessStore";

const AUTOMATIC_ICON_VALUE = "automatic";
const ADD_ACTION_VALUE = "select-action";
const MAX_SECONDARY_ACTIONS = 7;

function cloneConfig(
  config: DashboardQuickAccessConfig,
): DashboardQuickAccessConfig {
  return {
    ...config,
    secondaryActionIds: [...config.secondaryActionIds],
  };
}

function normalizeConfig(
  config: DashboardQuickAccessConfig,
): DashboardQuickAccessConfig | null {
  const label = config.buttonLabel?.trim() ?? "";
  return parseDashboardQuickAccessConfig({
    ...config,
    buttonLabel: label || null,
    secondaryActionIds: [...config.secondaryActionIds],
  });
}

function configsEqual(
  first: DashboardQuickAccessConfig,
  second: DashboardQuickAccessConfig,
): boolean {
  return (
    first.mode === second.mode &&
    first.buttonLabel === second.buttonLabel &&
    first.buttonIconId === second.buttonIconId &&
    first.primaryActionId === second.primaryActionId &&
    first.secondaryActionIds.length === second.secondaryActionIds.length &&
    first.secondaryActionIds.every(
      (actionId, index) => actionId === second.secondaryActionIds[index],
    )
  );
}

interface ActionOptionsProps {
  context: DashboardQuickAccessRuntimeContext;
  excludedActionIds?: ReadonlySet<DashboardQuickAccessActionId>;
}

function ActionOptions({ context, excludedActionIds }: ActionOptionsProps) {
  const { t } = useTranslation();

  return DASHBOARD_QUICK_ACCESS_GROUPS.map((group) => {
    const definitions = DASHBOARD_QUICK_ACCESS_DEFINITIONS.filter(
      (definition) =>
        definition.group === group.id && !excludedActionIds?.has(definition.id),
    );
    if (definitions.length === 0) return null;

    return (
      <SelectGroup key={group.id} aria-label={t(group.labelKey)}>
        <div
          className="px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {t(group.labelKey)}
        </div>
        {definitions.map((definition) => {
          const availability = getDashboardQuickAccessAvailability(
            definition,
            context,
          );
          const reason = availability.reasonKey
            ? t(availability.reasonKey)
            : null;
          const label = t(definition.labelKey);

          return (
            <SelectItem
              key={definition.id}
              value={definition.id}
              disabled={!availability.enabled}
              textValue={
                reason
                  ? t("dashboardQuickAccess.settings.optionUnavailable", {
                      label,
                      reason,
                    })
                  : label
              }
            >
              <span>
                {label}
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
    );
  });
}

export function DashboardQuickAccessSettingsCard() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const sucursalId = useAuthStore((state) => state.sucursalActivaId);
  const sucursales = useAuthStore((state) => state.sucursales);
  const scopeKey = useDashboardQuickAccessStore((state) => state.scopeKey);
  const savedConfig = useDashboardQuickAccessStore((state) => state.config);
  const hydrationStatus = useDashboardQuickAccessStore(
    (state) => state.hydrationStatus,
  );
  const persistenceStatus = useDashboardQuickAccessStore(
    (state) => state.persistenceStatus,
  );
  const error = useDashboardQuickAccessStore((state) => state.error);
  const warning = useDashboardQuickAccessStore((state) => state.warning);
  const saveConfig = useDashboardQuickAccessStore((state) => state.saveConfig);
  const reset = useDashboardQuickAccessStore((state) => state.reset);
  const retry = useDashboardQuickAccessStore((state) => state.retry);
  const [draft, setDraft] = React.useState<DashboardQuickAccessConfig | null>(
    null,
  );

  const expectedScopeKey = user
    ? dashboardQuickAccessStorageKey({ userId: user.id, sucursalId })
    : null;
  const scopeMatches =
    expectedScopeKey !== null && scopeKey === expectedScopeKey;
  const scopeReady = scopeMatches && hydrationStatus === "ready";
  const activeSucursal = sucursales.find(
    (sucursal) => sucursal.id === sucursalId,
  );
  const runtimeContext: DashboardQuickAccessRuntimeContext = {
    role: user?.rol ?? null,
    sucursalId,
  };

  React.useEffect(() => {
    if (!scopeReady) {
      setDraft(null);
      return;
    }
    setDraft(cloneConfig(savedConfig));
  }, [expectedScopeKey, savedConfig, scopeReady]);

  const normalizedDraft = draft ? normalizeConfig(draft) : null;
  const hasChanges =
    scopeReady &&
    normalizedDraft !== null &&
    !configsEqual(normalizedDraft, savedConfig);
  const isSaving = persistenceStatus === "saving";
  const primaryDefinition = draft
    ? getDashboardQuickAccessDefinition(draft.primaryActionId)
    : null;
  const PreviewIcon = draft
    ? DASHBOARD_QUICK_ACCESS_ICONS[
        draft.buttonIconId ?? primaryDefinition!.iconId
      ]
    : Zap;
  const previewLabel = draft
    ? draft.buttonLabel?.trim() || t(primaryDefinition!.labelKey)
    : t("dashboardQuickAccess.settings.previewFallback");

  const updateDraft = (update: Partial<DashboardQuickAccessConfig>) => {
    setDraft((current) => (current ? { ...current, ...update } : current));
  };

  const handlePrimaryChange = (value: string) => {
    const primaryActionId = value as DashboardQuickAccessActionId;
    setDraft((current) =>
      current
        ? {
            ...current,
            buttonIconId: null,
            primaryActionId,
            secondaryActionIds: current.secondaryActionIds.filter(
              (actionId) => actionId !== primaryActionId,
            ),
          }
        : current,
    );
  };

  const handleAddSecondary = (value: string) => {
    if (value === ADD_ACTION_VALUE) return;
    const actionId = value as DashboardQuickAccessActionId;
    const definition = getDashboardQuickAccessDefinition(actionId);
    const availability = getDashboardQuickAccessAvailability(
      definition,
      runtimeContext,
    );

    setDraft((current) => {
      if (
        !current ||
        !availability.enabled ||
        current.secondaryActionIds.length >= MAX_SECONDARY_ACTIONS ||
        current.primaryActionId === actionId ||
        current.secondaryActionIds.includes(actionId)
      ) {
        return current;
      }
      return {
        ...current,
        secondaryActionIds: [...current.secondaryActionIds, actionId],
      };
    });
  };

  const moveSecondary = (index: number, offset: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const destination = index + offset;
      if (destination < 0 || destination >= current.secondaryActionIds.length) {
        return current;
      }
      const secondaryActionIds = [...current.secondaryActionIds];
      const [actionId] = secondaryActionIds.splice(index, 1);
      secondaryActionIds.splice(destination, 0, actionId);
      return { ...current, secondaryActionIds };
    });
  };

  const removeSecondary = (actionId: DashboardQuickAccessActionId) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            secondaryActionIds: current.secondaryActionIds.filter(
              (currentId) => currentId !== actionId,
            ),
          }
        : current,
    );
  };

  const handleSave = async () => {
    if (!normalizedDraft || !hasChanges || !expectedScopeKey) return;
    const submittedScopeKey = expectedScopeKey;
    const succeeded = await saveConfig(normalizedDraft);
    if (
      useDashboardQuickAccessStore.getState().scopeKey !== submittedScopeKey
    ) {
      return;
    }
    if (succeeded) {
      toast.success(t("dashboardQuickAccess.settings.savedToast"));
      return;
    }
    toast.error(t("dashboardQuickAccess.settings.saveErrorToast"));
  };

  const handleReset = async () => {
    if (!scopeReady || !expectedScopeKey) return;
    const submittedScopeKey = expectedScopeKey;
    const succeeded = await reset();
    if (
      useDashboardQuickAccessStore.getState().scopeKey !== submittedScopeKey
    ) {
      return;
    }
    if (succeeded) {
      toast.success(t("dashboardQuickAccess.settings.restoredToast"));
      return;
    }
    toast.error(t("dashboardQuickAccess.settings.restoreErrorToast"));
  };

  const excludedSecondaryIds = new Set<DashboardQuickAccessActionId>(
    draft ? [draft.primaryActionId, ...draft.secondaryActionIds] : [],
  );
  const PrimaryActionIcon = primaryDefinition
    ? DASHBOARD_QUICK_ACCESS_ICONS[primaryDefinition.iconId]
    : Zap;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {t("dashboardQuickAccess.settings.title")}
        </CardTitle>
        <CardDescription>
          {t("dashboardQuickAccess.settings.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!user ? (
          <Alert variant="warning">
            <AlertTitle>
              {t("dashboardQuickAccess.settings.unavailableTitle")}
            </AlertTitle>
            <AlertDescription>
              {t("dashboardQuickAccess.settings.noUser")}
            </AlertDescription>
          </Alert>
        ) : !scopeMatches ||
          hydrationStatus === "idle" ||
          hydrationStatus === "loading" ? (
          <div
            className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("dashboardQuickAccess.settings.loading")}
          </div>
        ) : hydrationStatus === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>
              {t("dashboardQuickAccess.settings.loadErrorTitle")}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{error ?? t("dashboardQuickAccess.settings.loadError")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void retry()}
              >
                {t("dashboardQuickAccess.settings.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : draft ? (
          <>
            {warning ? (
              <Alert variant="warning">
                <AlertTitle>
                  {t("dashboardQuickAccess.settings.warningTitle")}
                </AlertTitle>
                <AlertDescription>
                  {t("dashboardQuickAccess.settings.warningDescription")}
                  <span className="mt-1 block text-xs">{warning}</span>
                </AlertDescription>
              </Alert>
            ) : null}

            {persistenceStatus === "error" ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {t("dashboardQuickAccess.settings.saveErrorTitle")}
                </AlertTitle>
                <AlertDescription>
                  {error ?? t("dashboardQuickAccess.settings.saveError")}
                </AlertDescription>
              </Alert>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {t("dashboardQuickAccess.settings.scopeSummary", {
                user: user.nombreCompleto,
                branch:
                  activeSucursal?.nombre ??
                  t("dashboardQuickAccess.settings.noBranch"),
              })}
            </p>

            <div
              className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              aria-live="polite"
            >
              <div>
                <p className="text-sm font-medium">
                  {t("dashboardQuickAccess.settings.preview")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("dashboardQuickAccess.settings.previewHelp")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="pointer-events-none max-w-full self-start sm:self-auto"
                tabIndex={-1}
                aria-label={t(
                  "dashboardQuickAccess.settings.previewAriaLabel",
                  { label: previewLabel },
                )}
              >
                <PreviewIcon className="h-4 w-4" />
                <span className="max-w-56 truncate sm:max-w-64">
                  {previewLabel}
                </span>
                {draft.mode === "menu" ? (
                  <ChevronDown className="h-4 w-4" />
                ) : null}
              </Button>
            </div>

            <section
              className="space-y-3"
              aria-labelledby="dashboard-quick-access-primary-heading"
            >
              <div>
                <h3
                  id="dashboard-quick-access-primary-heading"
                  className="text-sm font-semibold"
                >
                  {t("dashboardQuickAccess.settings.stepPrimaryAction")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("dashboardQuickAccess.settings.primaryActionHelp")}
                </p>
              </div>
              <Label
                htmlFor="dashboard-quick-access-primary"
                className="sr-only"
              >
                {t("dashboardQuickAccess.settings.primaryAction")}
              </Label>
              <Select
                value={draft.primaryActionId}
                onValueChange={handlePrimaryChange}
              >
                <SelectTrigger id="dashboard-quick-access-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <ActionOptions context={runtimeContext} />
                </SelectContent>
              </Select>
              <div className="flex gap-3 rounded-lg bg-muted/40 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-background text-primary shadow-sm">
                  <PrimaryActionIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t(primaryDefinition!.labelKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(primaryDefinition!.descriptionKey)}
                  </p>
                  <p className="mt-1 text-xs text-primary">
                    {t(
                      "dashboardQuickAccess.settings.automaticIconOnActionChange",
                    )}
                  </p>
                </div>
              </div>
            </section>

            <section
              className="space-y-3 border-t pt-6"
              aria-labelledby="dashboard-quick-access-behavior-heading"
            >
              <div>
                <h3
                  id="dashboard-quick-access-behavior-heading"
                  className="text-sm font-semibold"
                >
                  {t("dashboardQuickAccess.settings.stepBehavior")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("dashboardQuickAccess.settings.behaviorHelp")}
                </p>
              </div>
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="group"
                aria-labelledby="dashboard-quick-access-behavior-heading"
              >
                <button
                  type="button"
                  aria-pressed={draft.mode === "direct"}
                  className={`relative flex min-h-28 w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    draft.mode === "direct"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-input bg-background hover:bg-muted/50"
                  }`}
                  onClick={() => updateDraft({ mode: "direct" })}
                >
                  <MousePointerClick className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {t("dashboardQuickAccess.settings.directAction")}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(
                        "dashboardQuickAccess.settings.directActionDescription",
                      )}
                    </span>
                  </span>
                  {draft.mode === "direct" ? (
                    <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-pressed={draft.mode === "menu"}
                  className={`relative flex min-h-28 w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    draft.mode === "menu"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-input bg-background hover:bg-muted/50"
                  }`}
                  onClick={() => updateDraft({ mode: "menu" })}
                >
                  <List className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-semibold">
                      {t("dashboardQuickAccess.settings.actionMenu")}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t("dashboardQuickAccess.settings.actionMenuDescription")}
                    </span>
                  </span>
                  {draft.mode === "menu" ? (
                    <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />
                  ) : null}
                </button>
              </div>
            </section>

            {draft.mode === "menu" ? (
              <section
                className="space-y-3 border-t pt-6"
                aria-labelledby="dashboard-quick-access-secondary-heading"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3
                      id="dashboard-quick-access-secondary-heading"
                      className="text-sm font-semibold"
                    >
                      {t("dashboardQuickAccess.settings.stepMenuActions")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("dashboardQuickAccess.settings.secondaryActionsHelp", {
                        count: draft.secondaryActionIds.length,
                        max: MAX_SECONDARY_ACTIONS,
                      })}
                    </p>
                  </div>
                  <div className="w-full sm:w-80">
                    <Label
                      htmlFor="dashboard-quick-access-secondary-add"
                      className="sr-only"
                    >
                      {t("dashboardQuickAccess.settings.secondaryActions")}
                    </Label>
                    <Select
                      value={ADD_ACTION_VALUE}
                      onValueChange={handleAddSecondary}
                      disabled={
                        draft.secondaryActionIds.length >= MAX_SECONDARY_ACTIONS
                      }
                    >
                      <SelectTrigger id="dashboard-quick-access-secondary-add">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ADD_ACTION_VALUE} disabled>
                          {draft.secondaryActionIds.length >=
                          MAX_SECONDARY_ACTIONS
                            ? t(
                                "dashboardQuickAccess.settings.secondaryLimitReached",
                              )
                            : t(
                                "dashboardQuickAccess.settings.selectSecondaryAction",
                              )}
                        </SelectItem>
                        <ActionOptions
                          context={runtimeContext}
                          excludedActionIds={excludedSecondaryIds}
                        />
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {draft.secondaryActionIds.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {t("dashboardQuickAccess.settings.noSecondaryActions")}
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {draft.secondaryActionIds.map((actionId, index) => {
                      const definition =
                        getDashboardQuickAccessDefinition(actionId);
                      const availability = getDashboardQuickAccessAvailability(
                        definition,
                        runtimeContext,
                      );
                      const ActionIcon =
                        DASHBOARD_QUICK_ACCESS_ICONS[definition.iconId];
                      const actionLabel = t(definition.labelKey);

                      return (
                        <li
                          key={actionId}
                          className="flex items-center gap-2 rounded-lg border p-2 sm:gap-3"
                        >
                          <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          <ActionIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {actionLabel}
                            </p>
                            {!availability.enabled && availability.reasonKey ? (
                              <p className="text-xs text-amber-600">
                                {t(availability.reasonKey)}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === 0}
                              aria-label={t(
                                "dashboardQuickAccess.settings.moveUp",
                                { action: actionLabel },
                              )}
                              onClick={() => moveSecondary(index, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={
                                index === draft.secondaryActionIds.length - 1
                              }
                              aria-label={t(
                                "dashboardQuickAccess.settings.moveDown",
                                { action: actionLabel },
                              )}
                              onClick={() => moveSecondary(index, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t(
                                "dashboardQuickAccess.settings.removeAction",
                                { action: actionLabel },
                              )}
                              onClick={() => removeSecondary(actionId)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            ) : null}

            <details className="group rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <Palette className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {t("dashboardQuickAccess.settings.appearance")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("dashboardQuickAccess.settings.appearanceDescription")}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-5 border-t p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="dashboard-quick-access-label">
                      {t("dashboardQuickAccess.settings.customLabel")}
                    </Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t("dashboardQuickAccess.settings.characterCount", {
                        count: draft.buttonLabel?.length ?? 0,
                      })}
                    </span>
                  </div>
                  <Input
                    id="dashboard-quick-access-label"
                    value={draft.buttonLabel ?? ""}
                    maxLength={40}
                    placeholder={t(
                      "dashboardQuickAccess.settings.customLabelPlaceholder",
                    )}
                    aria-describedby="dashboard-quick-access-label-help"
                    onChange={(event) =>
                      updateDraft({ buttonLabel: event.target.value })
                    }
                  />
                  <p
                    id="dashboard-quick-access-label-help"
                    className="text-xs text-muted-foreground"
                  >
                    {t("dashboardQuickAccess.settings.customLabelHelp")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dashboard-quick-access-icon">
                    {t("dashboardQuickAccess.settings.icon")}
                  </Label>
                  <Select
                    value={draft.buttonIconId ?? AUTOMATIC_ICON_VALUE}
                    onValueChange={(value) =>
                      updateDraft({
                        buttonIconId:
                          value === AUTOMATIC_ICON_VALUE
                            ? null
                            : (value as DashboardQuickAccessIconId),
                      })
                    }
                  >
                    <SelectTrigger id="dashboard-quick-access-icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTOMATIC_ICON_VALUE}>
                        {t("dashboardQuickAccess.settings.recommendedIcon")}
                      </SelectItem>
                      {DASHBOARD_QUICK_ACCESS_ICON_IDS.map((iconId) => {
                        const Icon = DASHBOARD_QUICK_ACCESS_ICONS[iconId];
                        return (
                          <SelectItem key={iconId} value={iconId}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {t(`dashboardQuickAccess.icons.${iconId}`)}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {t("dashboardQuickAccess.settings.recommendedIconHelp")}
                    </p>
                    {draft.buttonIconId ? (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => updateDraft({ buttonIconId: null })}
                      >
                        {t("dashboardQuickAccess.settings.useRecommendedIcon")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </details>

            <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p
                className="min-h-4 text-xs text-muted-foreground"
                aria-live="polite"
              >
                {isSaving
                  ? t("dashboardQuickAccess.settings.savingStatus")
                  : hasChanges
                    ? t("dashboardQuickAccess.settings.unsavedStatus")
                    : persistenceStatus === "saved"
                      ? t("dashboardQuickAccess.settings.savedStatus")
                      : null}
              </p>
              <div className="grid gap-2 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!scopeReady || isSaving}
                  onClick={() => void handleReset()}
                >
                  <RotateCcw />
                  {t("dashboardQuickAccess.settings.restoreDefaults")}
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={
                    !scopeReady || !normalizedDraft || !hasChanges || isSaving
                  }
                  onClick={() => void handleSave()}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                  {isSaving
                    ? t("dashboardQuickAccess.settings.saving")
                    : t("dashboardQuickAccess.settings.save")}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
