import * as React from "react";
import { useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Command } from "cmdk";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock3,
  FlaskConical,
  HelpCircle,
  Home,
  Keyboard,
  Languages,
  ListFilter,
  LockKeyhole,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserPlus,
  UsersRound,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@components/ui/dialog";
import { useTheme } from "@app/providers/ThemeProvider";
import { useCommandPaletteStore } from "@store/commandPaletteStore";
import { useSearchHistoryStore } from "@store/searchHistoryStore";
import { useAuthStore } from "@store/authStore";
import { usePreferencesStore } from "@store/preferencesStore";
import { hasModuleAccess } from "@modules/auth/securityService";
import {
  filterAndRankGlobalSearch,
  getGlobalSearchShortcutLabel,
  normalizeSearchText,
  parseGlobalSearch,
} from "./globalSearchEngine";
import type {
  GlobalSearchAccess,
  GlobalSearchCategory,
  GlobalSearchResult,
} from "./globalSearchTypes";
import { useGlobalSearchData } from "./useGlobalSearchData";
import "./CommandPalette.css";

type PendingCreation = "consultation" | "plan" | null;

const CATEGORIES: Array<{ id: GlobalSearchCategory; labelKey: string }> = [
  { id: "all", labelKey: "command.tab_all" },
  { id: "patients", labelKey: "command.tab_patients" },
  { id: "consultations", labelKey: "command.tab_consultations" },
  { id: "plans", labelKey: "command.tab_plans" },
  { id: "laboratory", labelKey: "command.tab_laboratory" },
  { id: "recipes", labelKey: "command.tab_recipes" },
  { id: "actions", labelKey: "command.tab_actions" },
];

function createActionResult(
  input: Omit<GlobalSearchResult, "kind" | "category">,
): GlobalSearchResult {
  return { ...input, kind: "action", category: "actions" };
}

function isPatientResult(result: GlobalSearchResult): boolean {
  return result.kind === "patient" && Boolean(result.patientId);
}

function currentLocalDateKey(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildIntelligentSuggestion(
  query: string,
  translate: (key: string) => string,
  locale: string,
): GlobalSearchResult | null {
  const normalized = normalizeSearchText(query);
  if (!normalized) return null;

  const patientSearch = normalized.match(locale.startsWith("en")
    ? /(?:find|search|open) patient (.+)$/
    : /(?:buscar|encontrar|abrir) paciente (.+)$/);
  if (patientSearch?.[1]) {
    return {
      id: "intent-search-patient",
      kind: "intent",
      category: "actions",
      title: `${translate("command.search_patient")}: ${patientSearch[1]}`,
      subtitle: translate("command.local_command_description"),
      searchableText: normalized,
      icon: Sparkles,
      tone: "blue",
      actionId: `intent-search-patient:${patientSearch[1]}`,
    };
  }

  const intents: Array<{ pattern: RegExp; id: string; titleKey: string }> = locale.startsWith("en") ? [
    {
      pattern: /(?:create|add|new) patient/,
      id: "new-patient",
      titleKey: "command.create_patient",
    },
    {
      pattern: /(?:new|create|schedule) consultation/,
      id: "new-consultation",
      titleKey: "command.new_consultation",
    },
    {
      pattern: /(?:new|create) (?:meal )?plan/,
      id: "new-plan",
      titleKey: "command.new_plan",
    },
    {
      pattern: /open today(?: s)? agenda/,
      id: "agenda-today",
      titleKey: "command.today_consultations",
    },
    {
      pattern: /(?:results?|laboratory|labs?)/,
      id: "laboratory",
      titleKey: "command.go_laboratory",
    },
  ] : [
    {
      pattern: /(?:crear|agregar|nuevo) paciente/,
      id: "new-patient",
      titleKey: "command.create_patient",
    },
    {
      pattern: /(?:nueva|crear|agendar) consulta/,
      id: "new-consultation",
      titleKey: "command.new_consultation",
    },
    {
      pattern: /(?:nuevo|crear) plan/,
      id: "new-plan",
      titleKey: "command.new_plan",
    },
    {
      pattern: /abrir agenda de hoy/,
      id: "agenda-today",
      titleKey: "command.today_consultations",
    },
    {
      pattern: /(?:resultados?|laboratorio)/,
      id: "laboratory",
      titleKey: "command.go_laboratory",
    },
  ];
  const intent = intents.find((candidate) =>
    candidate.pattern.test(normalized),
  );
  if (!intent) return null;

  return {
    id: `intent-${intent.id}`,
    kind: "intent",
    category: "actions",
    title: translate(intent.titleKey),
    subtitle: translate("command.local_command_description"),
    searchableText: normalized,
    icon: Sparkles,
    tone: "blue",
    actionId: intent.id,
  };
}

export function CommandPalette() {
  const open = useCommandPaletteStore((state) => state.open);
  const setOpen = useCommandPaletteStore((state) => state.setOpen);
  const historyEntries = useSearchHistoryStore((state) => state.entries);
  const registerRecent = useSearchHistoryStore((state) => state.register);
  const clearRecentScope = useSearchHistoryStore((state) => state.clearScope);
  const authSucursalId = useAuthStore((state) => state.sucursalActivaId);
  const userId = useAuthStore((state) => state.user?.id ?? "local");
  const role = useAuthStore((state) => state.user?.rol ?? null);
  const activeSucursalId = authSucursalId ?? null;
  const setLanguage = usePreferencesStore((state) => state.setLanguage);
  const { setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<GlobalSearchCategory>("all");
  const [pendingCreation, setPendingCreation] =
    React.useState<PendingCreation>(null);
  const [browseAll, setBrowseAll] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const deferredQuery = useDeferredValue(query);
  const locale = i18n.language || "es-MX";
  const scope = `${userId}:${activeSucursalId ?? "none"}`;
  const access = React.useMemo<GlobalSearchAccess>(() => ({
    patients: Boolean(role && hasModuleAccess("patients", role)),
    consultations: Boolean(role && hasModuleAccess("consultations", role)),
    plans: Boolean(role && hasModuleAccess("mealplan", role)),
    laboratory: Boolean(role && hasModuleAccess("laboratory", role)),
    agenda: Boolean(role && hasModuleAccess("agenda", role)),
    recipes: Boolean(role && hasModuleAccess("recipes", role)),
  }), [role]);
  const canAccessDashboard = Boolean(role && hasModuleAccess("dashboard", role));
  const canAccessCalculations = Boolean(role && hasModuleAccess("anthropometry", role));
  const canCreatePatients = Boolean(
    role && hasModuleAccess("patients", role, "write"),
  );
  const canCreateConsultations = Boolean(
    role && hasModuleAccess("consultations", role, "write"),
  );
  const canCreatePlans = Boolean(
    role && hasModuleAccess("mealplan", role, "write"),
  );
  const {
    results: dataResults,
    loading,
    error,
  } = useGlobalSearchData(open, activeSucursalId, locale, access);
  const shortcutLabel = getGlobalSearchShortcutLabel();
  const availableCategories = React.useMemo(
    () => CATEGORIES.filter((item) => {
      if (item.id === "patients") return access.patients;
      if (item.id === "consultations") return access.consultations || access.agenda;
      if (item.id === "plans") return access.plans;
      if (item.id === "laboratory") return access.laboratory;
      if (item.id === "recipes") return access.recipes;
      return true;
    }),
    [access],
  );

  const staticResults = React.useMemo<GlobalSearchResult[]>(
    () => {
      const results = [
      createActionResult({
        id: "action-dashboard",
        title: t("command.go_dashboard"),
        subtitle: t("command.dashboard_description"),
        searchableText: "dashboard panel inicio metricas resumen",
        icon: Home,
        tone: "blue",
        path: "/",
      }),
      createActionResult({
        id: "action-patients",
        title: t("command.go_patients"),
        subtitle: t("command.patients_description"),
        searchableText: "pacientes expedientes directorio",
        icon: UsersRound,
        tone: "green",
        path: "/pacientes",
      }),
      createActionResult({
        id: "action-consultations",
        title: t("command.go_consultations"),
        subtitle: t("command.consultations_description"),
        searchableText: "consultas clinicas historial",
        icon: ClipboardList,
        tone: "purple",
        path: "/consultas",
      }),
      createActionResult({
        id: "action-plans",
        title: t("command.go_meal_plans"),
        subtitle: t("command.plans_description"),
        searchableText: "planes alimentarios dietas",
        icon: UtensilsCrossed,
        tone: "green",
        path: "/planes",
      }),
      createActionResult({
        id: "action-agenda",
        title: t("command.go_agenda"),
        subtitle: t("command.agenda_description"),
        searchableText: "agenda citas consultas hoy calendario",
        icon: CalendarDays,
        tone: "purple",
        path: "/agenda",
      }),
      createActionResult({
        id: "action-laboratory",
        title: t("command.go_laboratory"),
        subtitle: t("command.laboratory_description"),
        searchableText: "laboratorio resultados estudios pendientes",
        icon: FlaskConical,
        tone: "cyan",
        path: "/laboratorio",
      }),
      createActionResult({
        id: "action-recipes",
        title: t("command.go_recipes"),
        subtitle: t("command.recipes_description"),
        searchableText: "recetas recetario cocina alimentos calorias kcal",
        icon: ChefHat,
        tone: "cyan",
        path: "/recetas",
      }),
      createActionResult({
        id: "action-calculations",
        title: t("command.go_calculations"),
        subtitle: t("command.calculations_description"),
        searchableText: "calculos clinicos imc energia",
        icon: Activity,
        tone: "slate",
        path: "/calculos",
      }),
      createActionResult({
        id: "action-settings",
        title: t("command.go_settings"),
        subtitle: t("command.settings_description"),
        searchableText: "configuracion preferencias ajustes",
        icon: Settings,
        tone: "slate",
        path: "/configuracion",
      }),
      createActionResult({
        id: "action-new-patient",
        title: t("command.create_patient"),
        subtitle: t("command.create_patient_description"),
        searchableText: "crear agregar registrar nuevo paciente",
        icon: UserPlus,
        tone: "blue",
        path: "/pacientes/nuevo",
        actionId: "new-patient",
      }),
      createActionResult({
        id: "action-new-consultation",
        title: t("command.new_consultation"),
        subtitle: t("command.new_consultation_description"),
        searchableText: "crear nueva agendar consulta cita",
        icon: CalendarDays,
        tone: "purple",
        actionId: "new-consultation",
      }),
      createActionResult({
        id: "action-new-plan",
        title: t("command.new_plan"),
        subtitle: t("command.new_plan_description"),
        searchableText: "crear nuevo plan alimentario dieta",
        icon: UtensilsCrossed,
        tone: "green",
        actionId: "new-plan",
      }),
      createActionResult({
        id: "action-theme-light",
        title: t("theme.theme_light"),
        subtitle: t("command.theme_description"),
        searchableText: "tema claro light",
        icon: Sun,
        tone: "slate",
        actionId: "theme-light",
      }),
      createActionResult({
        id: "action-theme-dark",
        title: t("theme.theme_dark"),
        subtitle: t("command.theme_description"),
        searchableText: "tema oscuro dark",
        icon: Moon,
        tone: "slate",
        actionId: "theme-dark",
      }),
      createActionResult({
        id: "action-language",
        title: locale.startsWith("es") ? "English (US)" : "Español (MX)",
        subtitle: t("command.language_description"),
        searchableText: "idioma language english español",
        icon: Languages,
        tone: "slate",
        actionId: "toggle-language",
      }),
      ];
      const allowedById: Record<string, boolean> = {
        "action-dashboard": canAccessDashboard,
        "action-patients": access.patients,
        "action-consultations": access.consultations,
        "action-plans": access.plans,
        "action-agenda": access.agenda,
        "action-laboratory": access.laboratory,
        "action-recipes": access.recipes,
        "action-calculations": canAccessCalculations,
        "action-new-patient": Boolean(activeSucursalId) && canCreatePatients,
        "action-new-consultation": Boolean(activeSucursalId) && access.patients && canCreateConsultations,
        "action-new-plan": Boolean(activeSucursalId) && access.patients && canCreatePlans,
      };
      return results.filter((result) => allowedById[result.id] ?? true);
    },
    [
      access,
      activeSucursalId,
      canAccessCalculations,
      canAccessDashboard,
      canCreateConsultations,
      canCreatePatients,
      canCreatePlans,
      locale,
      t,
    ],
  );

  const allResults = React.useMemo(
    () => [...staticResults, ...dataResults],
    [dataResults, staticResults],
  );
  const intelligentSuggestion = React.useMemo(
    () => {
      const suggestion = buildIntelligentSuggestion(
        deferredQuery,
        (key) => t(key),
        locale,
      );
      if (!suggestion) return null;
      if (suggestion.actionId?.startsWith("intent-search-patient:")) {
        return access.patients ? suggestion : null;
      }
      if (suggestion.actionId === "agenda-today") {
        return access.agenda ? suggestion : null;
      }
      return (
        staticResults.some(
          (result) => result.actionId === suggestion.actionId,
        ) ||
        (suggestion.actionId === "laboratory" && access.laboratory)
      )
        ? suggestion
        : null;
    },
    [access.agenda, access.laboratory, access.patients, deferredQuery, locale, staticResults, t],
  );
  const parsedQuery = React.useMemo(
    () => parseGlobalSearch(deferredQuery),
    [deferredQuery],
  );
  const effectiveCategory = parsedQuery.category && availableCategories.some(
    (item) => item.id === parsedQuery.category,
  )
    ? parsedQuery.category
    : category;
  const showAllStructuredResults =
    !parsedQuery.text &&
    (Boolean(parsedQuery.filters.date) ||
      Boolean(parsedQuery.filters.kcalTotal) ||
      Boolean(parsedQuery.filters.kcalPerServing));
  const rankedResults = React.useMemo(() => {
    if (pendingCreation) {
      return filterAndRankGlobalSearch(
        dataResults.filter(
          (result) => isPatientResult(result) && result.canCreateForPatient,
        ),
        deferredQuery,
        "patients",
        browseAll || showAllStructuredResults ? dataResults.length + 1 : 20,
      );
    }
    const ranked = filterAndRankGlobalSearch(
      allResults,
      deferredQuery,
      category,
      browseAll || showAllStructuredResults ? allResults.length + 1 : 20,
    );
    if (
      !intelligentSuggestion ||
      category === "patients" ||
      category === "consultations" ||
      category === "plans" ||
      category === "laboratory" ||
      category === "recipes"
    ) {
      return ranked;
    }
    return [
      intelligentSuggestion,
      ...ranked.filter((result) => result.id !== intelligentSuggestion.id),
    ].slice(
      0,
      browseAll || showAllStructuredResults ? allResults.length + 1 : 20,
    );
  }, [
    allResults,
    browseAll,
    category,
    dataResults,
    deferredQuery,
    intelligentSuggestion,
    pendingCreation,
    showAllStructuredResults,
  ]);

  const resultById = React.useMemo(
    () => new Map(allResults.map((result) => [result.id, result])),
    [allResults],
  );
  const recentResults = React.useMemo(
    () =>
      historyEntries
        .filter((entry) => entry.scope === scope)
        .sort((a, b) => b.selectedAt - a.selectedAt)
        .map((entry) => resultById.get(entry.resultId))
        .filter((result): result is GlobalSearchResult => Boolean(result))
        .slice(0, 4),
    [historyEntries, resultById, scope],
  );
  const quickActions = React.useMemo(
    () =>
      ["action-new-patient", "action-new-consultation", "action-new-plan"]
        .map((id) => resultById.get(id))
        .filter((result): result is GlobalSearchResult => Boolean(result)),
    [resultById],
  );
  const suggestions = React.useMemo(() => {
    const preferred = [
      resultById.get("action-dashboard"),
      dataResults.find((result) => result.kind === "patient") ??
        resultById.get("action-patients"),
      resultById.get("action-new-consultation"),
      dataResults.find((result) => result.kind === "plan") ??
        resultById.get("action-plans"),
      dataResults.find((result) => result.kind === "laboratory") ??
        resultById.get("action-laboratory"),
      dataResults.find((result) => result.kind === "recipe") ??
        resultById.get("action-recipes"),
    ].filter((result): result is GlobalSearchResult => Boolean(result));
    return preferred
      .filter(
        (result, index) =>
          preferred.findIndex((item) => item.id === result.id) === index,
      )
      .slice(0, 5);
  }, [dataResults, resultById]);

  const reset = React.useCallback(() => {
    setQuery("");
    setCategory("all");
    setPendingCreation(null);
    setBrowseAll(false);
    setShowHelp(false);
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) reset();
    },
    [reset, setOpen],
  );

  const beginPatientSelection = React.useCallback(
    (creation: Exclude<PendingCreation, null>) => {
      setPendingCreation(creation);
      setCategory("patients");
      setQuery("");
      setShowHelp(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    },
    [],
  );

  const executeResult = React.useCallback(
    (result: GlobalSearchResult) => {
      if (pendingCreation && isPatientResult(result)) {
        if (!result.canCreateForPatient) return;
        const destination =
          pendingCreation === "consultation"
            ? `/pacientes/${result.patientId}/consultas/nueva`
            : `/pacientes/${result.patientId}/planes/nuevo`;
        handleOpenChange(false);
        navigate(destination);
        return;
      }

      if (result.actionId?.startsWith("intent-search-patient:")) {
        setPendingCreation(null);
        setCategory("patients");
        setQuery(result.actionId.slice("intent-search-patient:".length));
        setShowHelp(false);
        window.requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (result.actionId === "new-consultation") {
        beginPatientSelection("consultation");
        return;
      }
      if (result.actionId === "new-plan") {
        beginPatientSelection("plan");
        return;
      }
      const directActionPaths: Record<string, string> = {
        "new-patient": "/pacientes/nuevo",
        "agenda-today": `/agenda?date=${currentLocalDateKey()}`,
        laboratory: "/laboratorio",
      };
      if (result.actionId && directActionPaths[result.actionId]) {
        if (result.kind !== "intent") {
          registerRecent({ scope, resultId: result.id, selectedAt: Date.now() });
        }
        handleOpenChange(false);
        navigate(directActionPaths[result.actionId]);
        return;
      }
      if (
        result.actionId === "theme-light" ||
        result.actionId === "theme-dark"
      ) {
        setTheme(result.actionId === "theme-light" ? "light" : "dark");
        registerRecent({ scope, resultId: result.id, selectedAt: Date.now() });
        handleOpenChange(false);
        return;
      }
      if (result.actionId === "toggle-language") {
        const nextLanguage = locale.startsWith("es") ? "en-US" : "es-MX";
        setLanguage(nextLanguage);
        void i18n.changeLanguage(nextLanguage);
        registerRecent({ scope, resultId: result.id, selectedAt: Date.now() });
        handleOpenChange(false);
        return;
      }

      if (result.path) {
        registerRecent({ scope, resultId: result.id, selectedAt: Date.now() });
        handleOpenChange(false);
        navigate(result.path);
      }
    },
    [
      beginPatientSelection,
      handleOpenChange,
      i18n,
      locale,
      navigate,
      pendingCreation,
      registerRecent,
      scope,
      setLanguage,
      setTheme,
    ],
  );

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k")
        return;
      event.preventDefault();
      if (open) {
        inputRef.current?.focus();
        return;
      }
      const activeModal = document.querySelector(
        '[role="dialog"][aria-modal="true"]',
      );
      if (!activeModal) setOpen(true);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [open, setOpen]);

  React.useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  React.useEffect(() => {
    if (!availableCategories.some((item) => item.id === category)) {
      setCategory("all");
    }
  }, [availableCategories, category]);

  const showInitialState =
    !query.trim() && category === "all" && !pendingCreation && !browseAll && !showHelp;
  const placeholder = pendingCreation
    ? t(
        pendingCreation === "consultation"
          ? "command.select_patient_consultation"
          : "command.select_patient_plan",
      )
    : t("command.smart_placeholder");

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? availableCategories.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + availableCategories.length) %
          availableCategories.length;
    setCategory(availableCategories[nextIndex]!.id);
    tabRefs.current[nextIndex]?.focus();
  };

  const applyExample = React.useCallback((example: string) => {
    setShowHelp(false);
    setPendingCreation(null);
    setBrowseAll(false);
    setCategory("all");
    setQuery(example);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="nc-global-search"
        overlayClassName="nc-global-search__overlay"
        showClose={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Command
          className="nc-global-search__command"
          label={t("command.label")}
          shouldFilter={false}
          loop
        >
          <header className="nc-global-search__header">
            <DialogTitle className="nc-global-search__title">
              <Sparkles size={18} strokeWidth={2} aria-hidden="true" />
              {t("command.smart_title")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("command.smart_description")}
            </DialogDescription>
            <div className="nc-global-search__headerActions">
              <button
                type="button"
                className="nc-global-search__helpButton"
                data-active={showHelp || undefined}
                onClick={() => setShowHelp((current) => !current)}
              >
                <HelpCircle size={16} aria-hidden="true" />
                <span>{t("command.how_it_works")}</span>
              </button>
              <DialogClose
                className="nc-global-search__close"
                aria-label={t("common.close")}
              >
                <X size={18} strokeWidth={1.8} aria-hidden="true" />
              </DialogClose>
            </div>
          </header>

          <div className="nc-global-search__inputShell">
            <Search
              className="nc-global-search__searchIcon"
              size={22}
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                if (value) setShowHelp(false);
              }}
              placeholder={placeholder}
              className="nc-global-search__input"
              aria-label={placeholder}
            />
            <kbd className="nc-global-search__shortcut">{shortcutLabel}</kbd>
            <span
              className="nc-global-search__localBadge"
              title={t("command.local_private_hint")}
            >
              <LockKeyhole size={14} strokeWidth={2} aria-hidden="true" />
              {t("command.local_badge")}
            </span>
          </div>

          <div
            className="nc-global-search__tabs"
            role="tablist"
            aria-label={t("command.filter_categories")}
          >
            {availableCategories.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                aria-selected={effectiveCategory === item.id}
                tabIndex={effectiveCategory === item.id ? 0 : -1}
                className="nc-global-search__tab"
                data-active={effectiveCategory === item.id || undefined}
                onClick={() => {
                  setPendingCreation(null);
                  setBrowseAll(false);
                  setShowHelp(false);
                  setCategory(item.id);
                }}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          {pendingCreation && (
            <div className="nc-global-search__context" role="status">
              <button
                type="button"
                onClick={() => {
                  setPendingCreation(null);
                  setCategory("all");
                  setQuery("");
                }}
                aria-label={t("common.back")}
              >
                <ArrowLeft size={15} aria-hidden="true" />
              </button>
              <span>
                {t(
                  pendingCreation === "consultation"
                    ? "command.choose_patient_consultation"
                    : "command.choose_patient_plan",
                )}
              </span>
            </div>
          )}

          <Command.List
            className="nc-global-search__body"
            aria-busy={loading}
          >
            <div className="sr-only" role="status" aria-live="polite">
              {!loading && !showHelp
                ? t("command.result_count", { count: rankedResults.length })
                : ""}
            </div>
            {showHelp ? (
              <SearchHelpPanel
                locale={locale}
                availableCategories={availableCategories.map((item) => item.id)}
                onApplyExample={applyExample}
                onClearRecent={() => clearRecentScope(scope)}
                onOpenAiSettings={() => {
                  handleOpenChange(false);
                  navigate("/configuracion");
                }}
              />
            ) : loading ? (
              <SearchLoadingState label={t("command.loading_results")} />
            ) : showInitialState ? (
              <>
                {!activeSucursalId && (
                  <div className="nc-global-search__scopeNotice" role="status">
                    {t("command.no_active_branch")}
                  </div>
                )}
                <SmartSearchHint onOpenHelp={() => setShowHelp(true)} />
                <QuickFilterPanel
                  locale={locale}
                  availableCategories={availableCategories.map((item) => item.id)}
                  onApply={applyExample}
                />
                <SearchSectionHeading
                  icon={Sparkles}
                  title={t("command.suggestions")}
                  actionLabel={t("command.view_all")}
                  onAction={() => setBrowseAll(true)}
                />
                <Command.Group className="nc-global-search__suggestions">
                  {suggestions.map((result) => (
                    <SearchResultRow
                      key={result.id}
                      result={result}
                      onSelect={executeResult}
                    />
                  ))}
                </Command.Group>

                <SearchSectionHeading
                  icon={Activity}
                  title={t("command.quick_access")}
                />
                <Command.Group className="nc-global-search__quickGrid">
                  {quickActions.map((result) => (
                    <QuickActionItem
                      key={result.id}
                      result={result}
                      onSelect={executeResult}
                    />
                  ))}
                </Command.Group>

                <SearchSectionHeading
                  icon={Clock3}
                  title={t("command.recent")}
                />
                {recentResults.length > 0 ? (
                  <Command.Group className="nc-global-search__recentGrid">
                    {recentResults.map((result) => (
                      <RecentResultItem
                        key={result.id}
                        result={result}
                        onSelect={executeResult}
                      />
                    ))}
                  </Command.Group>
                ) : (
                  <div className="nc-global-search__recentEmpty">
                    {t("command.no_recent")}
                  </div>
                )}
              </>
            ) : rankedResults.length > 0 ? (
              <>
                <SearchSectionHeading
                  icon={Search}
                  title={
                    pendingCreation
                      ? t("command.available_patients")
                      : t("command.results")
                  }
                />
                <Command.Group className="nc-global-search__results">
                  {rankedResults.map((result) => (
                    <SearchResultRow
                      key={result.id}
                      result={result}
                      onSelect={executeResult}
                    />
                  ))}
                </Command.Group>
              </>
            ) : (
              <div className="nc-global-search__empty">
                <span className="nc-global-search__emptyIcon">
                  <Search size={22} aria-hidden="true" />
                </span>
                <strong>{t("command.no_matches")}</strong>
                <p>
                  {parsedQuery.errors.length > 0
                    ? t("command.invalid_filter", {
                        token: parsedQuery.errors[0],
                      })
                    : query.trim()
                      ? t("command.no_results", { search: query })
                      : t("command.empty_category")}
                </p>
                <button
                  type="button"
                  className="nc-global-search__emptyHelp"
                  onClick={() => setShowHelp(true)}
                >
                  {t("command.open_help")}
                </button>
              </div>
            )}
            {error && (
              <div className="nc-global-search__error" role="status">
                {t("command.partial_error", {
                  sources: error
                    .split(",")
                    .map((source) => t(`command.source_${source}`))
                    .join(", "),
                })}
              </div>
            )}
          </Command.List>

          <footer
            className="nc-global-search__footer"
            aria-label={t("command.keyboard_help")}
          >
            <span>{t("command.use")}</span>
            <kbd>
              <ArrowUp size={13} aria-hidden="true" />
            </kbd>
            <kbd>
              <ArrowDown size={13} aria-hidden="true" />
            </kbd>
            <span>{t("command.to_navigate")}</span>
            <kbd>Enter</kbd>
            <span>{t("command.to_select")}</span>
            <kbd>Esc</kbd>
            <span>{t("command.to_close")}</span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function SmartSearchHint({ onOpenHelp }: { onOpenHelp: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="nc-global-search__smartHint">
      <span aria-hidden="true">
        <Sparkles size={17} />
      </span>
      <p>
        <strong>{t("command.hint_title")}</strong>{" "}
        {t("command.hint_body")}
      </p>
      <button type="button" onClick={onOpenHelp}>
        {t("command.how_it_works")}
      </button>
    </div>
  );
}

function SearchHelpPanel({
  locale,
  availableCategories,
  onApplyExample,
  onClearRecent,
  onOpenAiSettings,
}: {
  locale: string;
  availableCategories: GlobalSearchCategory[];
  onApplyExample: (example: string) => void;
  onClearRecent: () => void;
  onOpenAiSettings: () => void;
}) {
  const { t } = useTranslation();
  const examples = locale.startsWith("en")
    ? [
        "Maria Lopez",
        "today's consultations",
        "recipes with 2000 calories",
      ]
    : [
        "María López",
        "consultas de hoy",
        "recetas de 2000 calorías",
      ];
  const filterExample = locale.startsWith("en")
    ? 'type:consultation patient:"Maria Lopez" date:today status:scheduled'
    : 'tipo:consulta paciente:"María López" fecha:hoy estado:agendada';

  return (
    <div className="nc-global-search__helpPanel">
      <div className="nc-global-search__helpHero">
        <span aria-hidden="true"><LockKeyhole size={20} /></span>
        <div>
          <strong>{t("command.help_local_title")}</strong>
          <p>{t("command.help_local_body")}</p>
        </div>
      </div>

      <section className="nc-global-search__helpSection">
        <h3><Search size={16} aria-hidden="true" />{t("command.help_records_title")}</h3>
        <p>{t("command.help_records_body")}</p>
        <div className="nc-global-search__exampleChips">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => onApplyExample(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="nc-global-search__helpSection">
        <h3><Sparkles size={16} aria-hidden="true" />{t("command.help_commands_title")}</h3>
        <p>{t("command.help_commands_body")}</p>
        <div className="nc-global-search__helpNotice">
          <strong>{t("command.help_not_ai_title")}</strong>
          <span>{t("command.help_not_ai_body")}</span>
          <button type="button" onClick={onOpenAiSettings}>
            {t("command.open_ai_settings")}
          </button>
        </div>
      </section>

      <section className="nc-global-search__helpSection">
        <h3><ListFilter size={16} aria-hidden="true" />{t("command.help_filters_title")}</h3>
        <p>{t("command.help_filters_body")}</p>
        <QuickFilterPanel
          locale={locale}
          availableCategories={availableCategories}
          onApply={onApplyExample}
          embedded
        />
        <details className="nc-global-search__advancedFilters">
          <summary>{t("command.advanced_filters")}</summary>
          <p>{t("command.advanced_filters_hint")}</p>
          <dl className="nc-global-search__operatorList">
            <div><dt><code>{locale.startsWith("en") ? "type:" : "tipo:"}</code></dt><dd>{t("command.filter_type_help")}</dd></div>
            <div><dt><code>{locale.startsWith("en") ? "patient:" : "paciente:"}</code></dt><dd>{t("command.filter_patient_help")}</dd></div>
            <div><dt><code>{locale.startsWith("en") ? "phone:" : "tel:"}</code></dt><dd>{t("command.filter_phone_help")}</dd></div>
            <div><dt><code>{locale.startsWith("en") ? "email:" : "correo:"}</code></dt><dd>{t("command.filter_email_help")}</dd></div>
            <div><dt><code>{locale.startsWith("en") ? "date:" : "fecha:"}</code></dt><dd>{t("command.filter_date_help")}</dd></div>
            <div><dt><code>{locale.startsWith("en") ? "status:" : "estado:"}</code></dt><dd>{t("command.filter_status_help")}</dd></div>
            <div><dt><code>{locale.startsWith("en") ? "calories:" : "calorias:"}</code></dt><dd>{t("command.filter_calories_help")}</dd></div>
          </dl>
          <button
            type="button"
            className="nc-global-search__filterExample"
            onClick={() => onApplyExample(filterExample)}
          >
            <code>{filterExample}</code>
          </button>
        </details>
      </section>

      <section className="nc-global-search__helpSection nc-global-search__helpSection--compact">
        <h3><Keyboard size={16} aria-hidden="true" />{t("command.help_keyboard_title")}</h3>
        <p>{t("command.help_keyboard_body")}</p>
      </section>

      <div className="nc-global-search__helpActions">
        <p>{t("command.help_recent_body")}</p>
        <button type="button" onClick={onClearRecent}>{t("command.clear_recent")}</button>
      </div>
    </div>
  );
}

function QuickFilterPanel({
  locale,
  availableCategories,
  onApply,
  embedded = false,
}: {
  locale: string;
  availableCategories: GlobalSearchCategory[];
  onApply: (query: string) => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const english = locale.startsWith("en");
  const filters: Array<{
    category: GlobalSearchCategory;
    labelKey: string;
    query: string;
  }> = [
    {
      category: "patients",
      labelKey: "command.quick_patients_active",
      query: english
        ? "type:patient status:active"
        : "tipo:paciente estado:activo",
    },
    {
      category: "consultations",
      labelKey: "command.quick_consultations_today",
      query: english
        ? "type:consultation date:today"
        : "tipo:consulta fecha:hoy",
    },
    {
      category: "plans",
      labelKey: "command.quick_plans_active",
      query: english ? "type:plan status:active" : "tipo:plan estado:activo",
    },
    {
      category: "laboratory",
      labelKey: "command.quick_laboratory",
      query: english ? "type:laboratory" : "tipo:laboratorio",
    },
    {
      category: "recipes",
      labelKey: "command.quick_recipes",
      query: english ? "type:recipe" : "tipo:receta",
    },
  ];
  const visibleFilters = filters.filter((filter) =>
    availableCategories.includes(filter.category),
  );
  if (visibleFilters.length === 0) return null;

  return (
    <div
      className="nc-global-search__quickFilters"
      data-embedded={embedded || undefined}
    >
      {!embedded && <strong>{t("command.quick_filters")}</strong>}
      <div>
        {visibleFilters.map((filter) => (
          <button
            key={filter.category}
            type="button"
            onClick={() => onApply(filter.query)}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchSectionHeading({
  icon: Icon,
  title,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="nc-global-search__sectionHeading">
      <Icon size={15} strokeWidth={2} aria-hidden={true} />
      <span>{title}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SearchResultRow({
  result,
  onSelect,
}: {
  result: GlobalSearchResult;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  const Icon = result.icon;
  return (
    <Command.Item
      value={result.id}
      onSelect={() => onSelect(result)}
      className="nc-global-search__result"
    >
      <span
        className="nc-global-search__resultIcon"
        data-tone={result.tone}
        aria-hidden="true"
      >
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <span className="nc-global-search__resultText">
        <strong>{result.title}</strong>
        <small>{result.subtitle}</small>
      </span>
      <span className="nc-global-search__enterHint" aria-hidden="true">
        ↵
      </span>
    </Command.Item>
  );
}

function QuickActionItem({
  result,
  onSelect,
}: {
  result: GlobalSearchResult;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  const Icon = result.icon;
  return (
    <Command.Item
      value={`quick-${result.id}`}
      onSelect={() => onSelect(result)}
      className="nc-global-search__quickItem"
      data-tone={result.tone}
    >
      <span className="nc-global-search__quickIcon" aria-hidden="true">
        <Icon size={21} strokeWidth={1.9} />
      </span>
      <span>
        <strong>{result.title}</strong>
        <small>{result.subtitle}</small>
      </span>
    </Command.Item>
  );
}

function RecentResultItem({
  result,
  onSelect,
}: {
  result: GlobalSearchResult;
  onSelect: (result: GlobalSearchResult) => void;
}) {
  const Icon = result.icon;
  return (
    <Command.Item
      value={`recent-${result.id}`}
      onSelect={() => onSelect(result)}
      className="nc-global-search__recentItem"
    >
      {result.avatarUrl ? (
        <img
          src={result.avatarUrl}
          alt=""
          className="nc-global-search__recentAvatar"
        />
      ) : result.avatar ? (
        <span
          className="nc-global-search__recentAvatar nc-global-search__recentAvatar--initials"
          aria-hidden="true"
        >
          {result.avatar}
        </span>
      ) : (
        <span
          className="nc-global-search__recentIcon"
          data-tone={result.tone}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={1.9} />
        </span>
      )}
      <span>
        <strong>{result.title}</strong>
        <small>{result.subtitle}</small>
      </span>
    </Command.Item>
  );
}

function SearchLoadingState({ label }: { label: string }) {
  return (
    <div className="nc-global-search__loading" role="status" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="nc-global-search__loadingRow">
          <span />
          <div>
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}
