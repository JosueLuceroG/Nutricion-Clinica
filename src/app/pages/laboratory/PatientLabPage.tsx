import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Plus,
  Scan,
  FlaskConical,
  Trash2,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState, ErrorState } from "@components/layout/EmptyState";
import { usePatient } from "@modules/patient/ui/usePatientHooks";
import { usePatientLabPanels } from "@modules/laboratory/ui/useLabPanelHooks";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import type { LabPanel } from "@modules/laboratory/domain/LabPanel";
import type { LabTestCode } from "@modules/laboratory/domain/LabTest";
import { LAB_TEST_DEFINITIONS, type LabTestCategory } from "@modules/laboratory/domain/LabTest";
import { classifyLabValue, type LabFlag, type LabResult } from "@modules/laboratory/domain/LabResult";
import { findReferenceRange } from "@modules/laboratory/domain/LabReferenceRange";
import { MEXICO_REFERENCE_RANGES } from "@modules/laboratory/data/mexicoReferenceRanges";
import { labPanelService } from "@services/labPanelService";
import {
  calculateCKDepi2021,
  calculateHOMA,
  calculateLDL,
  calculateCholHDLRatio,
  calculateTGHDLRatio,
} from "@utils/calculations/labCalculations";
import { cn } from "@utils/cn";
import type { Sex } from "@modules/patient/domain/Sex";

const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const TRACKED_TESTS: LabTestCode[] = [
  "GLUCOSA",
  "HBA1C",
  "COLESTEROL_TOTAL",
  "LDL",
  "HDL",
  "TRIGLICERIDOS",
  "CREATININA",
  "TSH",
  "VITAMINA_D",
];

export function PatientLabPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = React.useMemo(
    () => (patientId ? PatientId.fromUnsafe(patientId) : null),
    [patientId],
  );
  const { data: patient, loading: patientLoading } = usePatient(id);
  const { data, loading, error, reload } = usePatientLabPanels(id);

  React.useEffect(() => {
    const panelId = searchParams.get("panelId");
    if (!panelId || loading) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`lab-panel-${panelId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [data, loading, searchParams]);

  const onDelete = async (panelId: LabPanelId) => {
    if (!confirm(t("lab.delete_panel_confirm"))) return;
    try {
      await labPanelService.delete.execute(panelId, true);
      toast.success(t("lab.panel_deleted"));
      reload();
    } catch (err) {
      toast.error(t("lab.delete_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (patientLoading || loading) {
    return (
      <>
        <PageHeader title={t("common.loading")} />
        <PageContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </PageContent>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t("common.error_title")} />
        <PageContent>
          <ErrorState message={error.message} onRetry={reload} />
        </PageContent>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <PageHeader title={t("patient.not_found_title")} />
        <PageContent>
          <EmptyState
            title={t("patient.not_exists")}
            action={{ label: t("common.back"), onClick: () => navigate("/pacientes") }}
          />
        </PageContent>
      </>
    );
  }

  const items = data?.items ?? [];
  const sex: Sex = patient.sex === "male" || patient.sex === "female" ? patient.sex : "undisclosed";

  return (
    <>
      <PageHeader
        title={t("lab.patient_lab", { patientName: patient.fullName })}
        description={t("lab.panel_count", { count: items.length })}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("patient.back_to_patient")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/pacientes/${patient.id.toString()}/laboratorio/scan`}>
                <Scan className="mr-2 h-4 w-4" />
                {t("lab.scan_title")}
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/pacientes/${patient.id.toString()}/laboratorio/nuevo`}>
                <Plus className="mr-2 h-4 w-4" />
                {t("lab.new_panel")}
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        {items.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={t("lab.no_panels")}
            description={t("lab.empty_patient_desc")}
            action={{
              label: t("lab.create_first_panel"),
              onClick: () => navigate(`/pacientes/${patient.id.toString()}/laboratorio/nuevo`),
            }}
          />
        ) : (
          <div className="space-y-4">
            {items.length >= 2 && (
              <LabTrendChart panels={items} />
            )}
            {items.map((panel) => (
                <LabPanelCard
                  key={panel.id.toString()}
                  panel={panel}
                  highlighted={searchParams.get("panelId") === panel.id.toString()}
                ageYears={patient.age}
                sex={sex}
                onDelete={() => onDelete(panel.id)}
              />
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}

function LabPanelCard({
  panel,
  highlighted,
  ageYears,
  sex,
  onDelete,
}: {
  panel: LabPanel;
  highlighted: boolean;
  ageYears: number;
  sex: Sex;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const byCategory = React.useMemo(() => {
    const grouped = new Map<string, LabResult[]>();
    for (const r of panel.results) {
      const cat = LAB_TEST_DEFINITIONS[r.test].category;
      const list = grouped.get(cat) ?? [];
      grouped.set(cat, [...list, r]);
    }
    return Array.from(grouped.entries());
  }, [panel.results]);

  const derived = React.useMemo(() => deriveCalculations(panel, ageYears, sex, t), [panel, ageYears, sex, t]);

  return (
    <Card
      id={`lab-panel-${panel.id.toString()}`}
      tabIndex={-1}
      className={cn(highlighted && "ring-2 ring-primary ring-offset-2")}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {new Intl.DateTimeFormat("es-MX", { dateStyle: "long" }).format(panel.takenAt)}
            </CardTitle>
            <CardDescription>
              {t("lab.panel_summary", { labName: panel.labName ?? t("lab.unspecified"), count: panel.results.length })}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("common.delete")}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {byCategory.map(([cat, results]) => (
          <div key={cat}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`lab.category_${(cat as LabTestCategory).replace(/-/g, "_")}`)}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((r) => (
                <LabResultBadge key={r.test} test={r.test} value={r.value} ageYears={ageYears} sex={sex} />
              ))}
            </div>
          </div>
        ))}

        {derived.length > 0 && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("lab.derived_calculations")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {derived.map((d) => (
                <div key={d.label} className="rounded-md bg-background p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {d.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">{d.value}</p>
                  {d.note && <p className="text-[10px] text-muted-foreground">{d.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {panel.notes && (
          <p className="border-t pt-3 text-xs text-muted-foreground">{panel.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LabResultBadge({
  test,
  value,
  ageYears,
  sex,
}: {
  test: LabTestCode;
  value: number;
  ageYears: number;
  sex: Sex;
}) {
  const { t } = useTranslation();
  const def = LAB_TEST_DEFINITIONS[test];
  const range = findReferenceRange(test, sex, ageYears, MEXICO_REFERENCE_RANGES);
  const flag = classifyLabValue(value, range);
  const isCritical = flag === "critical-low" || flag === "critical-high";
  const isOut = flag === "low" || flag === "high";
  const trendIcon = flag === "high" || flag === "critical-high" ? (
    <TrendingUp className="h-3 w-3" />
  ) : flag === "low" || flag === "critical-low" ? (
    <TrendingDown className="h-3 w-3" />
  ) : (
    <Minus className="h-3 w-3" />
  );

  return (
    <div
      className={cn(
        "rounded-md border p-2",
        isCritical && "border-destructive bg-destructive/10",
        isOut && !isCritical && "border-warning bg-warning/10",
        !isOut && "bg-muted/20",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{def.shortName}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums">
        {value.toFixed(def.decimals)} <span className="text-[10px] text-muted-foreground">{def.unit}</span>
        {flag !== "normal" && (
          <span
            className={cn(
              "ml-auto",
              isCritical ? "text-destructive" : "text-warning",
            )}
            aria-label={labFlagLabel(t, flag)}
            title={labFlagLabel(t, flag)}
          >
            {trendIcon}
          </span>
        )}
      </p>
    </div>
  );
}

function LabTrendChart({ panels }: { panels: LabPanel[] }) {
  const { t } = useTranslation();
  const series = React.useMemo(() => {
    return TRACKED_TESTS.map((test) => {
      const points = panels
        .slice()
        .reverse()
        .map((p) => {
          const v = p.getValue(test);
          if (v === null) return null;
          return {
            date: new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" }).format(p.takenAt),
            value: v,
            takenAt: p.takenAt.getTime(),
          };
        })
        .filter((x): x is { date: string; value: number; takenAt: number } => x !== null);
      return { test, points };
    }).filter((s) => s.points.length >= 1);
  }, [panels]);

  const data = React.useMemo(() => {
    const allDates = Array.from(
      new Set(series.flatMap((s) => s.points.map((p) => p.takenAt))),
    ).sort((a, b) => a - b);
    return allDates.map((ts) => {
      const row: Record<string, number | string> = {
        date: new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" }).format(new Date(ts)),
      };
      for (const s of series) {
        const p = s.points.find((x) => x.takenAt === ts);
        if (p) row[s.test] = p.value;
      }
      return row;
    });
  }, [series]);

  if (series.every((s) => s.points.length === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("lab.longitudinal_trend")}</CardTitle>
        <CardDescription>
          {t("lab.trend_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => LAB_TEST_DEFINITIONS[value as LabTestCode]?.shortName ?? value}
              />
              {series.map((s, i) => (
                <Line
                  key={s.test}
                  type="monotone"
                  dataKey={s.test}
                  stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface Derived {
  label: string;
  value: string;
  note?: string;
}

function labFlagLabel(t: ReturnType<typeof useTranslation>["t"], flag: LabFlag) {
  return t(`lab.flag_${flag.replace(/-/g, "_")}`);
}

function deriveCalculations(panel: LabPanel, ageYears: number, sex: Sex, t: ReturnType<typeof useTranslation>["t"]): Derived[] {
  const out: Derived[] = [];
  const creatinine = panel.getValue("CREATININA");
  if (creatinine !== null && (sex === "male" || sex === "female")) {
    try {
      const egfr = calculateCKDepi2021({ creatinineMgDl: creatinine, ageYears, sex });
      out.push({ label: "eGFR CKD-EPI", value: `${egfr.toFixed(1)} mL/min/1.73m²` });
    } catch {
      /* ignore invalid */
    }
  }

  const glucose = panel.getValue("GLUCOSA");
  const insulin = panel.getValue("INSULINA");
  if (glucose !== null && insulin !== null) {
    try {
      const homa = calculateHOMA({ glucoseMgDl: glucose, insulinUUiMl: insulin });
      const interp =
        homa < 1.5 ? t("lab.homa_sensitive") : homa < 2.5 ? t("lab.homa_borderline") : t("lab.homa_resistance");
      out.push({ label: "HOMA-IR", value: homa.toFixed(2), note: interp });
    } catch {
      /* ignore */
    }
  }

  const chol = panel.getValue("COLESTEROL_TOTAL");
  const hdl = panel.getValue("HDL");
  const tg = panel.getValue("TRIGLICERIDOS");
  if (chol !== null && hdl !== null && tg !== null) {
    const ldl = calculateLDL({ totalCholesterolMgDl: chol, hdlMgDl: hdl, triglyceridesMgDl: tg });
    out.push({
      label: "LDL (Friedewald)",
      value: ldl === null ? "N/A (TG≥400)" : `${ldl.toFixed(0)} mg/dL`,
    });
    const ratio = calculateCholHDLRatio(chol, hdl);
    out.push({ label: "CT/HDL", value: ratio.toFixed(2) });
    const tgHdl = calculateTGHDLRatio(tg, hdl);
    out.push({ label: "TG/HDL", value: tgHdl.toFixed(2) });
  }

  return out;
}
