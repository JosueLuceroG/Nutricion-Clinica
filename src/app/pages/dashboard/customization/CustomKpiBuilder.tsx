import * as React from "react";
import { v4 as uuid } from "uuid";
import {
  CheckCircle2,
  Database,
  Gauge,
  Loader2,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { aiService } from "@services/ai";
import { useAI } from "@services/ai/useAI";
import { usePreferencesStore } from "@store/preferencesStore";
import type {
  CustomKpiConfig,
  CustomKpiMetric,
  CustomKpiSource,
  CustomKpiVisualization,
  DashboardWidgetCategory,
  DashboardWidgetSizePreset,
  DashboardWidgetTone,
} from "./dashboardWidgetTypes";
import { CUSTOM_KPI_FIELDS, customKpiSupportsComparison } from "./dashboardMetricEngine";
import { DASHBOARD_WIDGET_ICONS } from "./dashboardWidgetRegistry";

interface CustomKpiBuilderProps {
  open: boolean;
  initialConfig?: CustomKpiConfig | null;
  canUseSource?: (source: CustomKpiSource) => boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (config: CustomKpiConfig) => void;
}

interface DashboardKpiSuggestion {
  name: string;
  description: string;
  source: CustomKpiSource;
  valueField: string;
  metric: CustomKpiMetric;
  comparison: CustomKpiConfig["comparison"];
  visualization: CustomKpiVisualization;
  tone: DashboardWidgetTone;
  iconKey: string;
  category: DashboardWidgetCategory;
  size: "small" | "wide";
  precision: 0 | 1 | 2;
  notation: "standard" | "compact";
  prefix: string;
  suffix: string;
  trendDirection: NonNullable<CustomKpiConfig["trendDirection"]>;
  reasoning: string;
}

const sourceLabels: Record<CustomKpiSource, string> = {
  patients: "Pacientes",
  consultations: "Consultas",
  payments: "Pagos",
  plans: "Planes nutricionales",
  agenda: "Agenda",
  system: "Sistema",
};

const categoryLabels: Record<DashboardWidgetCategory, string> = {
  general: "General",
  patients: "Pacientes",
  consultations: "Consultas",
  payments: "Pagos",
  agenda: "Agenda",
  plans: "Planes",
  alerts: "Alertas",
  activity: "Actividad",
  finance: "Finanzas",
  quickActions: "Accesos rápidos",
  system: "Sistema",
  custom: "Mis KPIs",
};

const metricLabels: Record<CustomKpiMetric, string> = {
  count: "Contar",
  sum: "Sumar",
  average: "Promedio",
  percentage: "Porcentaje",
};

const visualizationOptions: Array<{ value: CustomKpiVisualization; label: string; detail: string }> = [
  { value: "largeNumber", label: "Número destacado", detail: "Valor principal con contexto" },
  { value: "simpleCard", label: "Tarjeta simple", detail: "Lectura limpia y directa" },
  { value: "percentage", label: "Porcentaje", detail: "Valor porcentual destacado" },
  { value: "progress", label: "Barra de progreso", detail: "Avance visual de 0 a 100%" },
];

const toneOptions: Array<{ value: DashboardWidgetTone; label: string }> = [
  { value: "purple", label: "Morado" },
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "orange", label: "Naranja" },
  { value: "cyan", label: "Turquesa" },
  { value: "rose", label: "Rosa" },
  { value: "slate", label: "Gris" },
];

const iconOptions = [
  { value: "users", label: "Pacientes" },
  { value: "calendar", label: "Calendario" },
  { value: "clipboard", label: "Consulta" },
  { value: "money", label: "Finanzas" },
  { value: "mealPlan", label: "Plan nutricional" },
  { value: "sync", label: "Sincronización" },
  { value: "sparkles", label: "Destacado" },
];

const aiExamples = [
  "Quiero ver el porcentaje de citas sin confirmar",
  "Muéstrame los ingresos del mes comparados con el anterior",
  "Necesito destacar los planes próximos a vencer",
];

const allowAllSources = () => true;

function defaultIconForSource(source: CustomKpiSource): string {
  if (source === "patients") return "users";
  if (source === "agenda") return "calendar";
  if (source === "plans") return "mealPlan";
  if (source === "payments") return "money";
  if (source === "system") return "sync";
  return "clipboard";
}

function formatPreviewValue(
  metric: CustomKpiMetric,
  fieldFormat: CustomKpiConfig["format"],
  precision: 0 | 1 | 2,
  notation: "standard" | "compact",
  prefix: string,
  suffix: string,
): string {
  const format = metric === "percentage" ? "percentage" : fieldFormat;
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    notation,
  };
  if (format === "currency") {
    options.style = "currency";
    options.currency = "MXN";
  } else if (format === "percentage") {
    options.style = "percent";
  }
  const sample = format === "percentage" ? 0.68 : format === "currency" ? 12_450 : 12_840;
  return `${prefix}${new Intl.NumberFormat("es-MX", options).format(sample)}${suffix}`;
}

export function CustomKpiBuilder({ open, initialConfig, canUseSource = allowAllSources, onOpenChange, onCreate }: CustomKpiBuilderProps) {
  const [mode, setMode] = React.useState<"manual" | "ai">("manual");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [source, setSource] = React.useState<CustomKpiSource>("patients");
  const [valueField, setValueField] = React.useState(CUSTOM_KPI_FIELDS.patients[0]!.value);
  const [metric, setMetric] = React.useState<CustomKpiMetric>("count");
  const [tone, setTone] = React.useState<DashboardWidgetTone>("purple");
  const [size, setSize] = React.useState<DashboardWidgetSizePreset>("small");
  const [iconKey, setIconKey] = React.useState("users");
  const [category, setCategory] = React.useState<DashboardWidgetCategory>("custom");
  const [comparison, setComparison] = React.useState<CustomKpiConfig["comparison"]>("none");
  const [visualization, setVisualization] = React.useState<CustomKpiVisualization>("largeNumber");
  const [precision, setPrecision] = React.useState<0 | 1 | 2>(1);
  const [notation, setNotation] = React.useState<"standard" | "compact">("standard");
  const [prefix, setPrefix] = React.useState("");
  const [suffix, setSuffix] = React.useState("");
  const [trendDirection, setTrendDirection] = React.useState<NonNullable<CustomKpiConfig["trendDirection"]>>("increaseIsPositive");
  const [aiRequest, setAiRequest] = React.useState("");
  const [aiProposal, setAiProposal] = React.useState<DashboardKpiSuggestion | null>(null);
  const [aiVerified, setAiVerified] = React.useState(false);
  const { execute: executeAI, busy: aiBusy, error: aiError } = useAI();
  const aiEnabled = usePreferencesStore((state) => state.aiEnabled);
  const aiProvider = usePreferencesStore((state) => state.aiProvider);
  const aiEnvironmentEnabled = aiService.isEnvironmentEnabled();
  const fields = CUSTOM_KPI_FIELDS[source];
  const selectedField = fields.find((field) => field.value === valueField) ?? fields[0]!;
  const supportsComparison = customKpiSupportsComparison(selectedField, metric);
  const sourceOptions = React.useMemo(
    () => (Object.entries(sourceLabels) as Array<[CustomKpiSource, string]>).filter(([value]) => canUseSource(value)),
    [canUseSource],
  );

  const reset = React.useCallback((nextSource?: CustomKpiSource) => {
    const defaultSource = nextSource ?? sourceOptions[0]?.[0] ?? "system";
    const defaultField = CUSTOM_KPI_FIELDS[defaultSource][0]!;
    setMode("manual");
    setName("");
    setDescription("");
    setSource(defaultSource);
    setValueField(defaultField.value);
    setMetric(defaultField.defaultMetric);
    setTone("purple");
    setSize("small");
    setIconKey(defaultIconForSource(defaultSource));
    setCategory("custom");
    setComparison("none");
    setVisualization("largeNumber");
    setPrecision(defaultField.format === "currency" ? 2 : 1);
    setNotation("standard");
    setPrefix("");
    setSuffix("");
    setTrendDirection("increaseIsPositive");
    setAiRequest("");
    setAiProposal(null);
    setAiVerified(false);
  }, [sourceOptions]);

  React.useEffect(() => {
    if (!open) return;
    if (!initialConfig) {
      reset();
      return;
    }
    setMode("manual");
    setName(initialConfig.name);
    setDescription(initialConfig.description);
    setSource(initialConfig.source);
    setValueField(initialConfig.valueField ?? CUSTOM_KPI_FIELDS[initialConfig.source][0]!.value);
    setMetric(initialConfig.metric);
    setTone(initialConfig.tone);
    setSize(initialConfig.size);
    setIconKey(initialConfig.iconKey);
    setCategory(initialConfig.category);
    setComparison(initialConfig.comparison);
    setVisualization(initialConfig.visualization);
    setPrecision(initialConfig.precision ?? (initialConfig.format === "currency" ? 2 : 1));
    setNotation(initialConfig.notation ?? "standard");
    setPrefix(initialConfig.prefix ?? "");
    setSuffix(initialConfig.suffix ?? "");
    setTrendDirection(initialConfig.trendDirection ?? "increaseIsPositive");
    setAiRequest("");
    setAiProposal(null);
    setAiVerified(false);
  }, [initialConfig, open, reset]);

  const handleSourceChange = (nextSource: CustomKpiSource) => {
    const nextField = CUSTOM_KPI_FIELDS[nextSource][0]!;
    setSource(nextSource);
    setValueField(nextField.value);
    setMetric(nextField.defaultMetric);
    setComparison("none");
    setVisualization("largeNumber");
    setPrecision(nextField.format === "currency" ? 2 : 1);
    setIconKey(defaultIconForSource(nextSource));
  };

  const handleMetricChange = (nextMetric: CustomKpiMetric) => {
    setMetric(nextMetric);
    setComparison("none");
    if (nextMetric !== "percentage" && (visualization === "percentage" || visualization === "progress")) {
      setVisualization("largeNumber");
    }
  };

  const handleVisualizationChange = (next: CustomKpiVisualization) => {
    setVisualization(next);
    if (next === "percentage" || next === "progress") {
      setMetric("percentage");
      setComparison("none");
    }
  };

  const generateWithAI = async () => {
    setAiVerified(false);
    const availableFields = sourceOptions.flatMap(([availableSource]) => CUSTOM_KPI_FIELDS[availableSource].map((field) => ({
      source: availableSource,
      valueField: field.value,
      label: field.label,
      allowedMetrics: field.allowedMetrics,
      format: field.format,
    })));
    const response = await executeAI<DashboardKpiSuggestion>("generateDashboardKpi", {
      request: aiRequest.trim(),
      availableFields,
    }, { skipCache: true });

    if (!response?.success || !response.data) {
      toast.error("No se pudo generar la propuesta de KPI.", {
        description: "Revisa la configuración de IA o intenta describirlo de otra forma.",
      });
      return;
    }

    const proposal = response.data;
    const proposalField = CUSTOM_KPI_FIELDS[proposal.source]?.find((field) => field.value === proposal.valueField);
    if (!canUseSource(proposal.source) || !proposalField || !proposalField.allowedMetrics.includes(proposal.metric)) {
      toast.error("La propuesta no usa un indicador permitido.", {
        description: "No se aplicó ningún cambio. Intenta generar otra propuesta.",
      });
      return;
    }

    const percentageVisualization = proposal.visualization === "percentage" || proposal.visualization === "progress";
    const normalizedMetric = percentageVisualization && proposalField.allowedMetrics.includes("percentage")
      ? "percentage"
      : proposal.metric;
    setAiProposal({
      ...proposal,
      metric: normalizedMetric,
      visualization: percentageVisualization && normalizedMetric !== "percentage" ? "largeNumber" : proposal.visualization,
      comparison: proposal.comparison === "previousPeriod" && customKpiSupportsComparison(proposalField, normalizedMetric)
        ? "previousPeriod"
        : "none",
    });
    setAiVerified(true);
  };

  const applyAIProposal = () => {
    if (!aiProposal) return;
    setName(aiProposal.name);
    setDescription(aiProposal.description);
    setSource(aiProposal.source);
    setValueField(aiProposal.valueField);
    setMetric(aiProposal.metric);
    setTone(aiProposal.tone);
    setSize(aiProposal.size);
    setIconKey(aiProposal.iconKey);
    setCategory(aiProposal.category);
    setComparison(aiProposal.comparison);
    setVisualization(aiProposal.visualization);
    setPrecision(aiProposal.precision);
    setNotation(aiProposal.notation);
    setPrefix(aiProposal.prefix);
    setSuffix(aiProposal.suffix);
    setTrendDirection(aiProposal.trendDirection);
    setMode("manual");
    toast.success("Propuesta aplicada para revisión.", {
      description: "Comprueba los campos y confirma con Crear y agregar.",
    });
  };

  const createKpi = () => {
    const now = new Date().toISOString();
    onCreate({
      id: initialConfig?.id ?? uuid(),
      name: name.trim(),
      description: description.trim(),
      iconKey,
      tone,
      category,
      source,
      metric,
      valueField,
      filters: [],
      comparison: supportsComparison ? comparison : "none",
      visualization,
      format: metric === "percentage" ? "percentage" : selectedField.format,
      precision,
      notation,
      prefix: prefix.trim(),
      suffix: suffix.trim(),
      trendDirection,
      size,
      createdAt: initialConfig?.createdAt ?? now,
      updatedAt: now,
    });
    reset();
    onOpenChange(false);
  };

  const PreviewIcon = DASHBOARD_WIDGET_ICONS[iconKey] ?? Sparkles;
  const previewValue = formatPreviewValue(metric, selectedField.format, precision, notation, prefix, suffix);
  const aiUnavailableReason = !aiEnvironmentEnabled
    ? "La IA no está disponible en este entorno. Configura VITE_AI_ENABLED y un proveedor."
    : !aiEnabled
      ? "La IA está desactivada. Puedes habilitarla en Configuración."
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="nc-dashboard-custom-kpi">
        <DialogHeader>
          <DialogTitle>{initialConfig ? "Editar KPI personalizado" : "Crear KPI personalizado"}</DialogTitle>
          <DialogDescription>Construye una métrica segura con los datos disponibles de la sucursal activa.</DialogDescription>
        </DialogHeader>

        <div className="nc-dashboard-custom-kpi__mode" role="tablist" aria-label="Método de creación">
          <button type="button" role="tab" aria-selected={mode === "manual"} data-active={mode === "manual" || undefined} onClick={() => setMode("manual")}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            <span><strong>Configurar manualmente</strong><small>Control total de datos y apariencia</small></span>
          </button>
          <button type="button" role="tab" aria-selected={mode === "ai"} data-active={mode === "ai" || undefined} onClick={() => setMode("ai")}>
            <WandSparkles size={17} aria-hidden="true" />
            <span><strong>Crear con IA</strong><small>Describe la idea y revisa la propuesta</small></span>
          </button>
        </div>

        <div className="nc-dashboard-custom-kpi__body">
          {mode === "ai" ? (
            <section className="nc-dashboard-custom-kpi__ai" role="tabpanel">
              <div className="nc-dashboard-custom-kpi__section-heading">
                <span><Sparkles size={18} aria-hidden="true" /></span>
                <div><strong>Describe el resultado que necesitas</strong><small>No incluyas nombres ni datos de pacientes. La IA solo puede elegir métricas autorizadas.</small></div>
              </div>

              <label className="nc-dashboard-custom-kpi__wide">
                <span>¿Cómo quieres tu KPI?</span>
                <textarea
                  value={aiRequest}
                  onChange={(event) => { setAiRequest(event.target.value); setAiProposal(null); setAiVerified(false); }}
                  placeholder="Ejemplo: Quiero conocer qué porcentaje de mis citas de hoy aún no está confirmado, en una barra azul."
                  maxLength={500}
                  rows={5}
                />
                <small className="nc-dashboard-custom-kpi__counter">{aiRequest.length}/500</small>
              </label>

              <div className="nc-dashboard-custom-kpi__examples" aria-label="Ejemplos de solicitudes">
                {aiExamples.map((example) => <button type="button" key={example} onClick={() => { setAiRequest(example); setAiProposal(null); setAiVerified(false); }}>{example}</button>)}
              </div>

              {aiUnavailableReason && (
                <div className="nc-dashboard-custom-kpi__ai-status" data-unavailable>
                  <ShieldCheck size={17} aria-hidden="true" />
                  <span>{aiUnavailableReason}</span>
                </div>
              )}

              {!aiUnavailableReason && (
                <div className="nc-dashboard-custom-kpi__ai-status" data-verified={aiVerified || undefined}>
                  {aiVerified ? <CheckCircle2 size={17} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
                  <span>
                    <strong>{aiVerified ? "Conexión y respuesta verificadas" : "Configuración lista para comprobar"}</strong>
                    <small>Proveedor {aiProvider === "ollama" ? "Ollama local" : "OpenAI"}. La propuesta debe superar la validación antes de mostrarse.</small>
                  </span>
                </div>
              )}

              <Button type="button" className="nc-dashboard-custom-kpi__generate" disabled={Boolean(aiUnavailableReason) || aiBusy || aiRequest.trim().length < 12} onClick={generateWithAI}>
                {aiBusy ? <Loader2 className="animate-spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                {aiBusy ? "Diseñando propuesta..." : "Generar propuesta"}
              </Button>

              {aiError && !aiProposal && !aiUnavailableReason && <p className="nc-dashboard-custom-kpi__ai-error">La IA no pudo completar la propuesta. Intenta nuevamente.</p>}

              {aiProposal && (
                <article className="nc-dashboard-custom-kpi__proposal" aria-label="Propuesta de KPI generada">
                  <header>
                    <span><CheckCircle2 size={19} aria-hidden="true" /></span>
                    <div><small>Propuesta lista para revisar</small><strong>{aiProposal.name}</strong></div>
                  </header>
                  <p>{aiProposal.description}</p>
                  <dl>
                    <div><dt>Indicador</dt><dd>{CUSTOM_KPI_FIELDS[aiProposal.source].find((field) => field.value === aiProposal.valueField)?.label}</dd></div>
                    <div><dt>Cálculo</dt><dd>{metricLabels[aiProposal.metric]}</dd></div>
                    <div><dt>Vista</dt><dd>{visualizationOptions.find((item) => item.value === aiProposal.visualization)?.label}</dd></div>
                    <div><dt>Tamaño</dt><dd>{aiProposal.size === "wide" ? "Ancho" : "Pequeño"}</dd></div>
                  </dl>
                  <div className="nc-dashboard-custom-kpi__reasoning"><Sparkles size={15} aria-hidden="true" /><span>{aiProposal.reasoning}</span></div>
                  <div className="nc-dashboard-custom-kpi__proposal-actions">
                    <Button type="button" variant="outline" onClick={() => setAiProposal(null)}>Descartar</Button>
                    <Button type="button" onClick={applyAIProposal}>Aplicar y revisar campos</Button>
                  </div>
                </article>
              )}
            </section>
          ) : (
            <div className="nc-dashboard-custom-kpi__form" role="tabpanel">
              <section className="nc-dashboard-custom-kpi__section">
                <div className="nc-dashboard-custom-kpi__section-heading">
                  <span><SlidersHorizontal size={18} aria-hidden="true" /></span>
                  <div><strong>Identidad</strong><small>Nombre y contexto que verá el equipo.</small></div>
                </div>
                <div className="nc-dashboard-custom-kpi__fields">
                  <label className="nc-dashboard-custom-kpi__wide">
                    <span>Nombre del KPI</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder={selectedField.label} maxLength={80} />
                    <small className="nc-dashboard-custom-kpi__counter">{name.length}/80</small>
                  </label>
                  <label className="nc-dashboard-custom-kpi__wide">
                    <span>Descripción</span>
                    <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explica brevemente qué representa y cómo debe interpretarse" maxLength={180} rows={3} />
                    <small className="nc-dashboard-custom-kpi__counter">{description.length}/180</small>
                  </label>
                </div>
              </section>

              <section className="nc-dashboard-custom-kpi__section">
                <div className="nc-dashboard-custom-kpi__section-heading">
                  <span><Database size={18} aria-hidden="true" /></span>
                  <div><strong>Datos y cálculo</strong><small>Solo se muestran fuentes permitidas para tu rol.</small></div>
                </div>
                <div className="nc-dashboard-custom-kpi__fields">
                  <label>
                    <span>Fuente de datos</span>
                    <select value={source} onChange={(event) => handleSourceChange(event.target.value as CustomKpiSource)}>
                      {sourceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Indicador</span>
                    <select
                      value={valueField}
                      onChange={(event) => {
                        const nextField = fields.find((field) => field.value === event.target.value) ?? fields[0]!;
                        setValueField(nextField.value);
                        setMetric(nextField.defaultMetric);
                        setComparison("none");
                        setVisualization("largeNumber");
                        setPrecision(nextField.format === "currency" ? 2 : 1);
                      }}
                    >
                      {fields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Cálculo</span>
                    <select value={metric} onChange={(event) => handleMetricChange(event.target.value as CustomKpiMetric)}>
                      {selectedField.allowedMetrics.map((allowedMetric) => <option key={allowedMetric} value={allowedMetric}>{metricLabels[allowedMetric]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Comparación</span>
                    <select disabled={!supportsComparison} value={supportsComparison ? comparison : "none"} onChange={(event) => setComparison(event.target.value as CustomKpiConfig["comparison"])}>
                      <option value="none">Sin comparación</option>
                      {supportsComparison && <option value="previousPeriod">Periodo anterior</option>}
                    </select>
                    <small>{supportsComparison ? "Compara automáticamente con el periodo anterior equivalente." : "Este indicador no dispone de un periodo anterior comparable."}</small>
                  </label>
                  <div className="nc-dashboard-custom-kpi__formula nc-dashboard-custom-kpi__wide">
                    <ShieldCheck size={17} aria-hidden="true" />
                    <span><strong>Fórmula segura</strong>{metricLabels[metric]} · {selectedField.label} · Formato {metric === "percentage" ? "porcentaje" : selectedField.format === "currency" ? "moneda MXN" : "numérico"}</span>
                  </div>
                  <details className="nc-dashboard-custom-kpi__advanced nc-dashboard-custom-kpi__wide">
                    <summary><span><Gauge size={16} aria-hidden="true" /> Opciones avanzadas de valor</span><small>Formato, abreviación y sentido de tendencia</small></summary>
                    <div className="nc-dashboard-custom-kpi__advanced-grid">
                      <label>
                        <span>Precisión decimal</span>
                        <select value={precision} onChange={(event) => setPrecision(Number(event.target.value) as 0 | 1 | 2)}>
                          <option value={0}>Sin decimales</option>
                          <option value={1}>1 decimal</option>
                          <option value={2}>2 decimales</option>
                        </select>
                      </label>
                      <label>
                        <span>Notación numérica</span>
                        <select value={notation} onChange={(event) => setNotation(event.target.value as "standard" | "compact")}>
                          <option value="standard">Completa · 12,840</option>
                          <option value="compact">Compacta · 12.8 mil</option>
                        </select>
                      </label>
                      <label>
                        <span>Prefijo opcional</span>
                        <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="Ej. ≈ " maxLength={12} />
                      </label>
                      <label>
                        <span>Sufijo opcional</span>
                        <input value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="Ej. pacientes" maxLength={12} />
                      </label>
                      <label className="nc-dashboard-custom-kpi__wide">
                        <span>Interpretación de tendencia</span>
                        <select value={trendDirection} onChange={(event) => setTrendDirection(event.target.value as NonNullable<CustomKpiConfig["trendDirection"]>)}>
                          <option value="increaseIsPositive">Subir es positivo</option>
                          <option value="decreaseIsPositive">Bajar es positivo</option>
                          <option value="neutral">Solo informativa</option>
                        </select>
                        <small>Controla el color de la comparación; nunca altera el cálculo.</small>
                      </label>
                    </div>
                  </details>
                </div>
              </section>

              <section className="nc-dashboard-custom-kpi__section">
                <div className="nc-dashboard-custom-kpi__section-heading">
                  <span><Palette size={18} aria-hidden="true" /></span>
                  <div><strong>Presentación</strong><small>Define cómo se leerá y dónde aparecerá.</small></div>
                </div>
                <div className="nc-dashboard-custom-kpi__fields">
                  <fieldset className="nc-dashboard-custom-kpi__choice-fieldset nc-dashboard-custom-kpi__wide">
                    <legend>Visualización</legend>
                    <div className="nc-dashboard-custom-kpi__visualizations">
                      {visualizationOptions.map((option) => {
                        const requiresPercentage = option.value === "percentage" || option.value === "progress";
                        const disabled = requiresPercentage && !selectedField.allowedMetrics.includes("percentage");
                        return (
                          <button type="button" key={option.value} disabled={disabled} data-active={visualization === option.value || undefined} onClick={() => handleVisualizationChange(option.value)}>
                            <strong>{option.label}</strong><small>{option.detail}</small>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="nc-dashboard-custom-kpi__choice-fieldset nc-dashboard-custom-kpi__wide">
                    <legend>Acento</legend>
                    <div className="nc-dashboard-custom-kpi__tones">
                      {toneOptions.map((option) => (
                        <button type="button" key={option.value} aria-label={`Acento ${option.label}`} data-tone={option.value} data-active={tone === option.value || undefined} onClick={() => setTone(option.value)}>
                          <span aria-hidden="true" />{option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="nc-dashboard-custom-kpi__choice-fieldset nc-dashboard-custom-kpi__wide">
                    <legend>Icono</legend>
                    <div className="nc-dashboard-custom-kpi__icons">
                      {iconOptions.map((option) => {
                        const Icon = DASHBOARD_WIDGET_ICONS[option.value] ?? Sparkles;
                        return <button type="button" key={option.value} aria-label={`Icono ${option.label}`} title={option.label} data-active={iconKey === option.value || undefined} onClick={() => setIconKey(option.value)}><Icon size={18} aria-hidden="true" /></button>;
                      })}
                    </div>
                  </fieldset>
                  <label>
                    <span>Categoría</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value as DashboardWidgetCategory)}>
                      {(Object.entries(categoryLabels) as Array<[DashboardWidgetCategory, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Tamaño inicial</span>
                    <select value={size} onChange={(event) => setSize(event.target.value as DashboardWidgetSizePreset)}>
                      <option value="small">Pequeño · 1/4 de fila</option>
                      <option value="wide">Ancho · 1/2 de fila</option>
                    </select>
                  </label>
                </div>
              </section>

              <div className="nc-dashboard-custom-kpi__preview" data-tone={tone} data-visualization={visualization}>
                <small>Vista previa · datos ilustrativos</small>
                <div className="nc-dashboard-custom-kpi__preview-card" data-visualization={visualization}>
                  <span className="nc-dashboard-custom-kpi__preview-icon"><PreviewIcon size={20} aria-hidden="true" /></span>
                  <div className="nc-dashboard-custom-kpi__preview-copy">
                    <strong>{name.trim() || selectedField.label}</strong>
                    {visualization === "percentage" ? (
                      <span className="nc-dashboard-custom-kpi__preview-percentage" aria-label={`Ejemplo de porcentaje: ${previewValue}`}><b>{previewValue}</b></span>
                    ) : (
                      <b>{previewValue}</b>
                    )}
                    <p>{description.trim() || "Se calculará con los datos de la sucursal activa."}</p>
                    {visualization === "progress" && <span className="nc-dashboard-custom-kpi__preview-progress" aria-label="Ejemplo de progreso: 68%"><i /></span>}
                  </div>
                </div>
                <div className="nc-dashboard-custom-kpi__preview-meta"><span>{sourceLabels[source]}</span><span>{metricLabels[metric]}</span><span>{notation === "compact" ? "Notación compacta" : `${precision} decimales`}</span><span>{size === "wide" ? "Ancho" : "Pequeño"}</span></div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          {mode === "manual" && (
            <Button type="button" disabled={!name.trim()} onClick={createKpi}>
              {initialConfig ? "Guardar KPI" : "Crear y agregar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
