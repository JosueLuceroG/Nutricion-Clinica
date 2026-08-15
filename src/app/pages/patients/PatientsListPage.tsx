import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowDownUp,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Filter,
  Grid2X2,
  List,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Upload,
  UserRoundPlus,
  UserRound,
  UsersRound,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageContent } from "@app/layout/AppLayout";
import { EmptyState, ErrorState } from "@components/layout/EmptyState";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Skeleton } from "@components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { Textarea } from "@components/ui/textarea";
import { usePatientClinicalSummary } from "@modules/consultation/ui/quick-consultation/usePatientClinicalSummary";
import {
  DEFAULT_PATIENT_DIRECTORY_FILTERS,
  type PatientDirectoryBooleanFilter,
  type PatientDirectoryClinicalSegment,
  type PatientDirectoryCounts,
  type PatientDirectoryFilters,
  type PatientDirectoryItem,
  type PatientDirectoryResult,
  type PatientDirectorySort,
  type PatientDirectoryStatusFilter,
} from "@modules/patient/application/patientDirectoryTypes";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Sex } from "@modules/patient/domain/Sex";
import { CascadeDeletePatientDialog } from "@modules/patient/ui/CascadeDeletePatientDialog";
import { useCascadeDeletePatient } from "@modules/patient/ui/useCascadeDeletePatient";
import { usePatientDirectory } from "@modules/patient/ui/usePatientDirectory";
import { sendProfessionalMessage } from "@services/api/patientPortalApi";
import { db } from "@services/db/dexieSchema";
import {
  closeCsvPreviewWindow,
  downloadAndOpenCsv,
  patientRowsToCsv,
  prepareCsvPreviewWindow,
} from "@services/importer";
import { patientService } from "@services/patientService";
import { useAuthStore } from "@store/authStore";
import { usePatientsUIStore } from "@store/patientsUIStore";
import "./PatientsListPage.css";

const BOOLEAN_FILTERS: PatientDirectoryBooleanFilter[] = [
  "all",
  "with",
  "without",
];

function patientStatusLabel(
  t: ReturnType<typeof useTranslation>["t"],
  status: Patient["status"],
) {
  if (status === "deceased") return t("patient.status_deceased");
  return t(`common.${status}`);
}

function statusFilterLabel(
  t: ReturnType<typeof useTranslation>["t"],
  status: PatientDirectoryStatusFilter,
) {
  if (status === "all") return t("common.all");
  if (status === "deleted") return t("common.deleted");
  return patientStatusLabel(t, status);
}

function activeFilterCount(filters: PatientDirectoryFilters): number {
  return [
    filters.sex !== "all",
    filters.minimumAge !== null,
    filters.maximumAge !== null,
    Boolean(filters.registeredFrom),
    Boolean(filters.registeredTo),
    Boolean(filters.tag.trim()),
    filters.activePlan !== "all",
    filters.upcomingAppointment !== "all",
    filters.pendingBalance !== "all",
  ].filter(Boolean).length;
}

export function PatientsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const branchId = useAuthStore((state) => state.sucursalActivaId);
  const {
    search,
    statusFilter,
    filters,
    pageSize,
    setSearch,
    setStatusFilter,
    setFilters,
    setPageSize,
    reset,
  } = usePatientsUIStore();
  const deferredSearch = React.useDeferredValue(search);
  const [page, setPage] = React.useState(1);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [clinicalSegment, setClinicalSegment] =
    React.useState<PatientDirectoryClinicalSegment>("all");
  const [sort, setSort] =
    React.useState<PatientDirectorySort>("clinical-priority");
  const [view, setView] = React.useState<"table" | "cards">("table");
  const [draftFilters, setDraftFilters] =
    React.useState<PatientDirectoryFilters>(filters);
  const [busy, setBusy] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Patient | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<Patient | null>(null);
  const [restoreTarget, setRestoreTarget] = React.useState<Patient | null>(
    null,
  );
  const [reactivateTarget, setReactivateTarget] =
    React.useState<Patient | null>(null);
  const [selectedItems, setSelectedItems] = React.useState<
    Map<string, PatientDirectoryItem>
  >(() => new Map());
  const [bulkRetentionOpen, setBulkRetentionOpen] = React.useState(false);
  const [messageTargets, setMessageTargets] = React.useState<Patient[]>([]);
  const [summaryTarget, setSummaryTarget] =
    React.useState<PatientDirectoryItem | null>(null);

  const { data, loading, error } = usePatientDirectory({
    branchId,
    search: deferredSearch,
    status: statusFilter,
    filters,
    clinicalSegment,
    sort,
    page,
    pageSize,
    refreshToken,
  });

  React.useEffect(() => {
    if (!loading && data && page > data.totalPages) setPage(data.totalPages);
  }, [data, loading, page]);

  const refresh = () => setRefreshToken((value) => value + 1);
  const clearSelection = () => setSelectedItems(new Map());
  const toggleSelected = (item: PatientDirectoryItem) => {
    const patientId = item.patient.id.toString();
    setSelectedItems((current) => {
      const next = new Map(current);
      if (next.has(patientId)) next.delete(patientId);
      else next.set(patientId, item);
      return next;
    });
  };
  const cascade = useCascadeDeletePatient({
    onComplete: (outcome) => {
      if (deleteTarget) {
        const key =
          outcome === "deleted"
            ? "patient.deleted_success"
            : "patient.archived_success";
        toast.success(t(key, { name: deleteTarget.fullName }));
      }
      setDeleteTarget(null);
      refresh();
    },
    onError: (operationError) => {
      toast.error(t("patient.operation_error"), {
        description:
          operationError instanceof Error
            ? operationError.message
            : String(operationError),
      });
    },
  });

  const executeArchive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      await patientService.archive.execute(archiveTarget.id);
      toast.success(
        t("patient.archived_success", { name: archiveTarget.fullName }),
      );
      setArchiveTarget(null);
      refresh();
    } catch (operationError) {
      toast.error(t("patient.archive_error"), {
        description:
          operationError instanceof Error
            ? operationError.message
            : String(operationError),
      });
    } finally {
      setBusy(false);
    }
  };

  const executeRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      await patientService.restore.execute(restoreTarget.id);
      toast.success(
        t("patient.restored_success", { name: restoreTarget.fullName }),
      );
      setRestoreTarget(null);
      refresh();
    } catch (operationError) {
      toast.error(t("patient.restore_error"), {
        description:
          operationError instanceof Error
            ? operationError.message
            : String(operationError),
      });
    } finally {
      setBusy(false);
    }
  };

  const executeReactivate = async () => {
    if (!reactivateTarget) return;
    setBusy(true);
    try {
      await patientService.update.execute(reactivateTarget.id, {
        status: "active",
      });
      toast.success(
        t("patient.directory.reactivated_success", {
          name: reactivateTarget.fullName,
        }),
      );
      setReactivateTarget(null);
      refresh();
    } catch (operationError) {
      toast.error(t("patient.directory.reactivate_error"), {
        description:
          operationError instanceof Error
            ? operationError.message
            : String(operationError),
      });
    } finally {
      setBusy(false);
    }
  };

  const executeBulkRetention = async () => {
    const items = Array.from(selectedItems.values());
    if (items.length === 0) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        items.map(({ patient }) => {
          if (statusFilter === "deleted") {
            return patientService.restore.execute(patient.id);
          }
          if (statusFilter === "archived") {
            return patientService.update.execute(patient.id, {
              status: "active",
            });
          }
          return patientService.archive.execute(patient.id);
        }),
      );
      const succeeded = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failed = results.length - succeeded;

      if (succeeded > 0) {
        toast.success(
          t(
            statusFilter === "deleted"
              ? "patient.directory.bulk_restored_success"
              : statusFilter === "archived"
                ? "patient.directory.bulk_reactivated_success"
                : "patient.directory.bulk_archived_success",
            { count: succeeded },
          ),
        );
      }
      if (failed > 0) {
        toast.error(
          t("patient.directory.bulk_operation_error", { count: failed }),
        );
      }
      setBulkRetentionOpen(false);
      clearSelection();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const exportSelected = async () => {
    const ids = Array.from(selectedItems.keys());
    if (ids.length === 0) return;
    const previewWindow = prepareCsvPreviewWindow();
    setBusy(true);
    try {
      const rows = (await db.patients.bulkGet(ids)).filter(
        (row): row is NonNullable<typeof row> => row !== undefined,
      );
      const fileName = `pacientes-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`;
      await downloadAndOpenCsv(patientRowsToCsv(rows), fileName, previewWindow);
      toast.success(
        t("patient.directory.export_selected_success", { count: rows.length }),
        { description: fileName },
      );
    } catch (operationError) {
      closeCsvPreviewWindow(previewWindow);
      toast.error(t("patient.directory.export_error"), {
        description:
          operationError instanceof Error
            ? operationError.message
            : String(operationError),
      });
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (status: PatientDirectoryStatusFilter) => {
    React.startTransition(() => {
      setStatusFilter(status);
      setClinicalSegment("all");
      setPage(1);
      clearSelection();
    });
  };

  const clearAllFilters = () => {
    reset();
    setClinicalSegment("all");
    setSort("clinical-priority");
    setDraftFilters(DEFAULT_PATIENT_DIRECTORY_FILTERS);
    setPage(1);
    setFiltersOpen(false);
  };

  const filterCount = activeFilterCount(filters);
  const hasQuery =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    clinicalSegment !== "all" ||
    filterCount > 0;

  return (
    <>
      <PageContent className="nc-patients-page">
        <div className="nc-patients-overview">
          <PatientsHero
            active={data?.counts.active ?? 0}
            healthyPercent={
              data && data.counts.active > 0
                ? Math.max(
                    0,
                    Math.round(
                      ((data.counts.active - data.insights.requiresContact) /
                        data.counts.active) *
                        100,
                    ),
                  )
                : 0
            }
            loading={loading}
            view={view}
            onViewChange={setView}
          />
          {data &&
            statusFilter !== "archived" &&
            statusFilter !== "deleted" && (
              <PatientsInsights
                insights={data.insights}
                onSelectSegment={(segment) => {
                  setClinicalSegment(segment);
                  setPage(1);
                }}
              />
            )}
        </div>

        {data &&
          statusFilter !== "archived" &&
          statusFilter !== "deleted" &&
          data.priorityItems.length > 0 && (
            <PatientsToday
              items={data.priorityItems}
              onAction={(item) => {
                const patientId = item.patient.id.toString();
                if (item.clinicalStatus === "urgent") {
                  setMessageTargets([item.patient]);
                } else if (item.clinicalStatus === "expiring-plan") {
                  navigate(`/pacientes/${patientId}/planes`);
                } else {
                  navigate(
                    `/agenda?patientId=${encodeURIComponent(patientId)}&create=1`,
                  );
                }
              }}
            />
          )}

        <section
          className="nc-patients-directory"
          aria-label={t("patient.directory.available_results")}
          aria-busy={loading}
        >
          <PatientsToolbar
            search={search}
            status={statusFilter}
            statusCounts={data?.counts}
            clinicalSegment={clinicalSegment}
            clinicalCounts={data?.clinicalCounts}
            sort={sort}
            filterCount={filterCount}
            filtersOpen={filtersOpen}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onStatusChange={changeStatus}
            onClinicalSegmentChange={(segment) => {
              React.startTransition(() => {
                setClinicalSegment(segment);
                setPage(1);
              });
            }}
            onSortChange={(nextSort) => {
              setSort(nextSort);
              setPage(1);
            }}
            onToggleFilters={() => {
              setDraftFilters(filters);
              setFiltersOpen((open) => !open);
            }}
          />

          {(statusFilter === "archived" || statusFilter === "deleted") && (
            <PatientsRetentionBanner deleted={statusFilter === "deleted"} />
          )}

          {filtersOpen && (
            <PatientsFiltersPanel
              filters={draftFilters}
              onChange={setDraftFilters}
              onClear={() => setDraftFilters(DEFAULT_PATIENT_DIRECTORY_FILTERS)}
              onApply={() => {
                setFilters(draftFilters);
                setPage(1);
                setFiltersOpen(false);
              }}
            />
          )}

          <div className="nc-patients-results" id="patients-results">
            {error ? (
              <ErrorState message={error.message} onRetry={refresh} />
            ) : loading && !data ? (
              <PatientsLoadingState />
            ) : data && data.filteredTotal === 0 ? (
              <PatientsEmptyState
                deleted={statusFilter === "deleted"}
                filtered={hasQuery}
                onReset={clearAllFilters}
                onCreate={() => navigate("/pacientes/nuevo")}
              />
            ) : data ? (
              <>
                <PatientsDirectory
                  items={data.items}
                  view={view}
                  selected={selectedItems}
                  onToggleSelected={toggleSelected}
                  onOpenSummary={setSummaryTarget}
                  onMessage={(patient) => setMessageTargets([patient])}
                  onArchive={setArchiveTarget}
                  onDelete={(patient) => {
                    setDeleteTarget(patient);
                    void cascade.requestDelete(patient.id);
                  }}
                  onRestore={setRestoreTarget}
                  onReactivate={setReactivateTarget}
                />
                <PatientsPagination
                  page={data.page}
                  totalPages={data.totalPages}
                  from={data.from}
                  to={data.to}
                  total={data.filteredTotal}
                  pageSize={data.pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPage(1);
                  }}
                />
              </>
            ) : null}
          </div>

          <p className="sr-only" role="status" aria-live="polite">
            {loading
              ? t("patient.directory.loading")
              : data
                ? t("patient.directory.showing", {
                    from: data.from,
                    to: data.to,
                    total: data.filteredTotal,
                  })
                : ""}
          </p>
        </section>
      </PageContent>

      {selectedItems.size > 0 && summaryTarget === null && (
        <PatientsBulkBar
          items={Array.from(selectedItems.values())}
          status={statusFilter}
          busy={busy}
          onClear={clearSelection}
          onMessage={() =>
            setMessageTargets(
              Array.from(selectedItems.values()).map((item) => item.patient),
            )
          }
          onPlan={(item) =>
            navigate(
              item.hasActivePlan
                ? `/pacientes/${item.patient.id.toString()}/planes`
                : `/pacientes/${item.patient.id.toString()}/planes/nuevo`,
            )
          }
          onExport={() => void exportSelected()}
          onRetention={() => setBulkRetentionOpen(true)}
        />
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={
          archiveTarget
            ? t("patient.archive_title", { name: archiveTarget.fullName })
            : ""
        }
        description={t("patient.archive_desc")}
        confirmLabel={t("common.archive")}
        tone="warning"
        busy={busy}
        onConfirm={executeArchive}
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title={
          restoreTarget
            ? t("patient.restore_title", { name: restoreTarget.fullName })
            : ""
        }
        description={t("patient.restore_desc")}
        confirmLabel={t("common.restore")}
        tone="info"
        busy={busy}
        onConfirm={executeRestore}
      />

      <ConfirmDialog
        open={reactivateTarget !== null}
        onOpenChange={(open) => !open && setReactivateTarget(null)}
        title={
          reactivateTarget
            ? t("patient.directory.reactivate_title", {
                name: reactivateTarget.fullName,
              })
            : ""
        }
        description={t("patient.directory.reactivate_description")}
        confirmLabel={t("patient.directory.reactivate")}
        tone="info"
        busy={busy}
        onConfirm={executeReactivate}
      />

      <ConfirmDialog
        open={bulkRetentionOpen}
        onOpenChange={setBulkRetentionOpen}
        title={t(
          statusFilter === "deleted"
            ? "patient.directory.bulk_restore_title"
            : statusFilter === "archived"
              ? "patient.directory.bulk_reactivate_title"
              : "patient.directory.bulk_archive_title",
          { count: selectedItems.size },
        )}
        description={t("patient.directory.bulk_retention_description")}
        confirmLabel={t(
          statusFilter === "deleted"
            ? "common.restore"
            : statusFilter === "archived"
              ? "patient.directory.reactivate"
              : "common.archive",
        )}
        tone={statusFilter === "deleted" ? "info" : "warning"}
        busy={busy}
        onConfirm={executeBulkRetention}
      />

      <CascadeDeletePatientDialog
        open={cascade.dialogOpen}
        patientName={deleteTarget?.fullName ?? ""}
        counts={cascade.counts}
        loading={cascade.loadingCounts}
        busy={cascade.busy}
        onCancel={() => {
          cascade.cancel();
          setDeleteTarget(null);
        }}
        onArchive={cascade.archive}
        onDeleteAll={cascade.deleteAll}
      />

      <PatientMessageDialog
        targets={messageTargets}
        onOpenChange={(open) => !open && setMessageTargets([])}
      />

      <PatientSummaryDrawer
        item={summaryTarget}
        onOpenChange={(open) => !open && setSummaryTarget(null)}
      />
    </>
  );
}

function PatientsHero({
  active,
  healthyPercent,
  loading,
  view,
  onViewChange,
}: {
  active: number;
  healthyPercent: number;
  loading: boolean;
  view: "table" | "cards";
  onViewChange: (view: "table" | "cards") => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <section className="nc-patients-hero" aria-labelledby="patients-title">
      <div className="nc-patients-hero__identity">
        <div className="nc-patients-hero__titleRow">
          <span className="nc-patients-hero__icon" aria-hidden="true">
            <UserRoundPlus />
          </span>
          <h1 id="patients-title">{t("patient.title")}</h1>
          <Badge variant="success" className="nc-patients-hero__count">
            <UsersRound aria-hidden="true" />
            {loading
              ? "..."
              : t("patient.directory.active_patients", { count: active })}
          </Badge>
          {!loading && (
            <Badge
              variant="success"
              className="nc-patients-hero__count nc-patients-hero__health"
            >
              <span aria-hidden="true" />
              {t("patient.directory.records_current", {
                percentage: healthyPercent,
              })}
            </Badge>
          )}
        </div>
        <p>{t("patient.directory.description")}</p>
      </div>

      <div className="nc-patients-hero__controls">
        <div
          className="nc-patients-viewToggle"
          role="group"
          aria-label={t("patient.directory.view_mode")}
        >
          <button
            type="button"
            data-active={view === "table" || undefined}
            aria-pressed={view === "table"}
            onClick={() => onViewChange("table")}
          >
            <List aria-hidden="true" />
            {t("patient.directory.table_view")}
          </button>
          <button
            type="button"
            data-active={view === "cards" || undefined}
            aria-pressed={view === "cards"}
            onClick={() => onViewChange("cards")}
          >
            <Grid2X2 aria-hidden="true" />
            {t("patient.directory.card_view")}
          </button>
        </div>
        <span className="nc-patients-updated">
          <Clock3 aria-hidden="true" />
          {t("patient.directory.updated_today", {
            time: new Intl.DateTimeFormat(i18n.language, {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
          })}
        </span>
      </div>
    </section>
  );
}

function PatientsInsights({
  insights,
  onSelectSegment,
}: {
  insights: PatientDirectoryResult["insights"];
  onSelectSegment: (segment: PatientDirectoryClinicalSegment) => void;
}) {
  const { t } = useTranslation();
  const cards = [
    {
      label: t("patient.directory.insight_active"),
      value: insights.activeWithPlan,
      detail: t("patient.directory.insight_active_detail", {
        count: insights.activeWithPlan,
      }),
      kind: "active",
      tone: "blue",
    },
    {
      label: t("patient.directory.insight_goal"),
      value: insights.advancingToGoal,
      detail: t("patient.directory.insight_goal_total", {
        count: insights.patientsWithGoal,
      }),
      kind: "goal",
      tone: "green",
    },
    {
      label: t("patient.directory.insight_appointments"),
      value: insights.appointmentsThisWeek,
      detail: t("patient.directory.insight_appointments_detail"),
      kind: "appointments",
      tone: "indigo",
    },
    {
      label: t("patient.directory.insight_contact"),
      value: insights.requiresContact,
      detail: t("patient.directory.insight_contact_detail"),
      kind: "contact",
      tone: "red",
      onClick: () => onSelectSegment("at-risk"),
    },
    {
      label: t("patient.directory.insight_plans"),
      value: insights.expiringPlans,
      detail: t("patient.directory.insight_plans_detail"),
      kind: "plans",
      tone: "violet",
      onClick: () => onSelectSegment("at-risk"),
    },
  ];

  return (
    <section
      className="nc-patients-insights"
      aria-label={t("patient.directory.insights")}
    >
      {cards.map(({ label, value, detail, kind, tone, onClick }) => (
        <article
          key={label}
          data-tone={tone}
          data-actionable={Boolean(onClick) || undefined}
        >
          <div>
            <span>{label}</span>
            <div className="nc-patients-insights__value">
              <strong>{value}</strong>
              {kind === "contact" && (
                <em>
                  <ShieldAlert aria-hidden="true" />
                  {t("patient.directory.urgent")}
                </em>
              )}
              {(kind === "goal" ||
                kind === "appointments" ||
                kind === "plans") && <small>{detail}</small>}
            </div>
            {kind === "goal" ? (
              <span
                className="nc-patients-insights__progress"
                aria-hidden="true"
              >
                <span
                  style={{
                    width: `${
                      insights.patientsWithGoal > 0
                        ? Math.round(
                            (insights.advancingToGoal /
                              insights.patientsWithGoal) *
                              100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </span>
            ) : kind === "appointments" ? (
              <span className="nc-patients-insights__bars" aria-hidden="true">
                {[38, 62, 50, 88, 72, 30, 20].map((height, index) => (
                  <i
                    key={`${height}-${index}`}
                    data-current={index === 3 || undefined}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </span>
            ) : kind === "plans" ? (
              <small className="nc-patients-insights__link">
                {t("patient.directory.renew_plans")} →
              </small>
            ) : (
              <small>{detail}</small>
            )}
          </div>
          {onClick && (
            <button type="button" onClick={onClick}>
              <span className="sr-only">{label}</span>
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

function PatientsToday({
  items,
  onAction,
}: {
  items: PatientDirectoryItem[];
  onAction: (item: PatientDirectoryItem) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className="nc-patients-today"
      aria-labelledby="patients-today-title"
    >
      <div className="nc-patients-today__intro">
        <span className="nc-patients-today__mark" aria-hidden="true">
          <ShieldAlert />
        </span>
        <div>
          <h2 id="patients-today-title">
            {t("patient.directory.today_actions")}
          </h2>
          <p>
            {t("patient.directory.pending_actions", { count: items.length })}
          </p>
        </div>
      </div>
      <div className="nc-patients-today__list">
        {items.map((item) => {
          const urgent = item.clinicalStatus === "urgent";
          const expiring = item.clinicalStatus === "expiring-plan";
          return (
            <article
              key={item.patient.id.toString()}
              data-tone={urgent ? "red" : expiring ? "violet" : "amber"}
            >
              <span className="nc-patients-today__status" aria-hidden="true" />
              <div>
                <strong>{item.patient.fullName}</strong>
                <p>
                  {urgent
                    ? item.daysSinceLastConsultation === null
                      ? t("patient.directory.no_consultations")
                      : t("patient.directory.days_without_consultation", {
                          count: item.daysSinceLastConsultation,
                        })
                    : expiring
                      ? t("patient.directory.plan_expires_soon", {
                          plan: item.activePlanName,
                        })
                      : item.hasUpcomingAppointment
                        ? t("patient.directory.follow_up_required")
                        : t("patient.directory.no_next_appointment")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAction(item)}
              >
                {urgent ? (
                  <MessageCircle aria-hidden="true" />
                ) : expiring ? (
                  <Utensils aria-hidden="true" />
                ) : (
                  <CalendarPlus aria-hidden="true" />
                )}
                {urgent
                  ? t("patient.directory.contact")
                  : expiring
                    ? t("patient.directory.view_plan")
                    : t("patient.directory.schedule")}
              </Button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PatientsRetentionBanner({ deleted }: { deleted: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="nc-patients-retention"
      data-tone={deleted ? "danger" : "info"}
    >
      <span aria-hidden="true">{deleted ? <Trash2 /> : <Archive />}</span>
      <div>
        <strong>
          {t(
            deleted
              ? "patient.directory.trash_title"
              : "patient.directory.archived_title",
          )}
        </strong>
        <p>
          {t(
            deleted
              ? "patient.directory.trash_description"
              : "patient.directory.archived_description",
          )}
        </p>
      </div>
    </div>
  );
}

function PatientsToolbar({
  search,
  status,
  statusCounts,
  clinicalSegment,
  clinicalCounts,
  sort,
  filterCount,
  filtersOpen,
  onSearchChange,
  onStatusChange,
  onClinicalSegmentChange,
  onSortChange,
  onToggleFilters,
}: {
  search: string;
  status: PatientDirectoryStatusFilter;
  statusCounts?: PatientDirectoryCounts;
  clinicalSegment: PatientDirectoryClinicalSegment;
  clinicalCounts?: PatientDirectoryResult["clinicalCounts"];
  sort: PatientDirectorySort;
  filterCount: number;
  filtersOpen: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: PatientDirectoryStatusFilter) => void;
  onClinicalSegmentChange: (segment: PatientDirectoryClinicalSegment) => void;
  onSortChange: (sort: PatientDirectorySort) => void;
  onToggleFilters: () => void;
}) {
  const { t } = useTranslation();
  const retentionView = status === "archived" || status === "deleted";
  const segments: Array<{
    value: PatientDirectoryClinicalSegment;
    count: number | undefined;
  }> = [
    { value: "all", count: clinicalCounts?.all },
    { value: "on-track", count: clinicalCounts?.onTrack },
    { value: "follow-up", count: clinicalCounts?.followUp },
    { value: "at-risk", count: clinicalCounts?.atRisk },
    { value: "new", count: clinicalCounts?.new },
  ];
  const statusShortcuts: PatientDirectoryStatusFilter[] = [
    ...(status !== "all" && status !== "active" ? (["active"] as const) : []),
    ...(statusCounts?.inactive ? (["inactive"] as const) : []),
    "archived",
    "deleted",
  ];
  const statusCount = (value: PatientDirectoryStatusFilter) => {
    if (!statusCounts) return undefined;
    return value === "all" ? statusCounts.total : statusCounts[value];
  };
  const statusShortcutLabel = (value: PatientDirectoryStatusFilter) => {
    if (value === "archived") return t("patient.directory.archived_shortcut");
    if (value === "deleted") return t("patient.directory.trash_shortcut");
    if (value === "active") return t("patient.directory.active_shortcut");
    if (value === "inactive") return t("patient.directory.inactive_shortcut");
    return statusFilterLabel(t, value);
  };
  return (
    <div
      className="nc-patients-toolbar"
      data-retention-view={retentionView || undefined}
    >
      <label className="nc-patients-search">
        <Search aria-hidden="true" />
        <span className="sr-only">{t("patient.directory.search_label")}</span>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("patient.directory.search_placeholder")}
          autoComplete="off"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label={t("patient.directory.clear_search")}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </label>

      {!retentionView && (
        <>
          <div
            className="nc-patients-tabs"
            role="tablist"
            aria-label={t("patient.directory.clinical_segments")}
          >
            {segments.map(({ value, count }) => (
              <button
                key={value}
                id={`patient-segment-${value}`}
                type="button"
                role="tab"
                aria-selected={clinicalSegment === value}
                aria-controls="patients-results"
                tabIndex={clinicalSegment === value ? 0 : -1}
                data-active={clinicalSegment === value || undefined}
                onClick={() => onClinicalSegmentChange(value)}
                onKeyDown={(event) => {
                  const currentIndex = segments.findIndex(
                    (segment) => segment.value === value,
                  );
                  const targetIndex =
                    event.key === "ArrowRight"
                      ? (currentIndex + 1) % segments.length
                      : event.key === "ArrowLeft"
                        ? (currentIndex - 1 + segments.length) % segments.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? segments.length - 1
                            : null;
                  if (targetIndex === null) return;
                  event.preventDefault();
                  const target = segments[targetIndex].value;
                  onClinicalSegmentChange(target);
                  window.requestAnimationFrame(() =>
                    document
                      .getElementById(`patient-segment-${target}`)
                      ?.focus(),
                  );
                }}
              >
                {t(`patient.directory.segment_${value.replace("-", "_")}`)}
                {count !== undefined && <span>{count}</span>}
              </button>
            ))}
          </div>

          <span className="nc-patients-toolbar__divider" aria-hidden="true" />
        </>
      )}

      <div
        className="nc-patients-statusTabs"
        role="tablist"
        aria-label={t("common.status")}
      >
        {statusShortcuts.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            aria-controls="patients-results"
            data-active={status === value || undefined}
            onClick={() => onStatusChange(value)}
          >
            {statusShortcutLabel(value)}
            {statusCount(value) !== undefined && (
              <span>{statusCount(value)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="nc-patients-toolbar__actions">
        <Select
          value={sort}
          onValueChange={(value) => onSortChange(value as PatientDirectorySort)}
        >
          <SelectTrigger
            className="nc-patients-sort"
            aria-label={t("patient.directory.sort_label")}
          >
            <ArrowDownUp aria-hidden="true" />
            <span className="nc-patients-sort__label">
              {t("patient.directory.sort_prefix")}
            </span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                "clinical-priority",
                "name",
                "next-appointment",
                "goal-progress",
                "last-consultation",
              ] as PatientDirectorySort[]
            ).map((value) => (
              <SelectItem key={value} value={value}>
                {t(`patient.directory.sort_${value.replaceAll("-", "_")}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="nc-patients-filterButton"
          aria-expanded={filtersOpen}
          aria-controls="patients-filters"
          onClick={onToggleFilters}
        >
          <Filter aria-hidden="true" />
          {t("patient.directory.filters")}
          {filterCount > 0 && (
            <span>
              {t("patient.directory.filters_active", { count: filterCount })}
            </span>
          )}
          <ChevronDown
            className="nc-patients-filterButton__chevron"
            data-open={filtersOpen || undefined}
            aria-hidden="true"
          />
        </Button>
        <Button asChild variant="outline" className="nc-patients-importButton">
          <Link to="/pacientes/importar">
            <Upload aria-hidden="true" />
            {t("patient.directory.import_csv")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PatientsFiltersPanel({
  filters,
  onChange,
  onClear,
  onApply,
}: {
  filters: PatientDirectoryFilters;
  onChange: React.Dispatch<React.SetStateAction<PatientDirectoryFilters>>;
  onClear: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const patch = (values: Partial<PatientDirectoryFilters>) =>
    onChange((current) => ({ ...current, ...values }));
  const parseAge = (value: string): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(130, parsed)) : null;
  };

  return (
    <section className="nc-patients-filters" id="patients-filters">
      <div className="nc-patients-filters__heading">
        <div>
          <h2>{t("patient.directory.filter_title")}</h2>
          <p>{t("patient.directory.filter_description")}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <RotateCcw aria-hidden="true" />
          {t("common.clear_filters")}
        </Button>
      </div>

      <div className="nc-patients-filters__grid">
        <div className="nc-patients-field">
          <Label>{t("patient.sex")}</Label>
          <Select
            value={filters.sex}
            onValueChange={(value) => patch({ sex: value as "all" | Sex })}
          >
            <SelectTrigger aria-label={t("patient.sex")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("patient.directory.sex_all")}
              </SelectItem>
              {(["female", "male", "intersex", "undisclosed"] as Sex[]).map(
                (sex) => (
                  <SelectItem key={sex} value={sex}>
                    {t(`patient.sex_${sex}`)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="nc-patients-field nc-patients-field--age">
          <Label>{t("patient.age")}</Label>
          <div>
            <Input
              type="number"
              min={0}
              max={130}
              value={filters.minimumAge ?? ""}
              onChange={(event) =>
                patch({ minimumAge: parseAge(event.target.value) })
              }
              placeholder={t("patient.directory.minimum_age")}
              aria-label={t("patient.directory.minimum_age")}
            />
            <Input
              type="number"
              min={0}
              max={130}
              value={filters.maximumAge ?? ""}
              onChange={(event) =>
                patch({ maximumAge: parseAge(event.target.value) })
              }
              placeholder={t("patient.directory.maximum_age")}
              aria-label={t("patient.directory.maximum_age")}
            />
          </div>
        </div>

        <div className="nc-patients-field">
          <Label htmlFor="patients-registered-from">
            {t("patient.directory.registered_from")}
          </Label>
          <Input
            id="patients-registered-from"
            type="date"
            value={filters.registeredFrom}
            onChange={(event) => patch({ registeredFrom: event.target.value })}
          />
        </div>

        <div className="nc-patients-field">
          <Label htmlFor="patients-registered-to">
            {t("patient.directory.registered_to")}
          </Label>
          <Input
            id="patients-registered-to"
            type="date"
            value={filters.registeredTo}
            onChange={(event) => patch({ registeredTo: event.target.value })}
          />
        </div>

        <div className="nc-patients-field">
          <Label htmlFor="patients-tag">{t("patient.directory.tag")}</Label>
          <Input
            id="patients-tag"
            value={filters.tag}
            onChange={(event) => patch({ tag: event.target.value })}
            placeholder={t("patient.directory.tag_placeholder")}
          />
        </div>

        <BooleanFilter
          label={t("patient.directory.active_plan")}
          value={filters.activePlan}
          onChange={(activePlan) => patch({ activePlan })}
        />
        <BooleanFilter
          label={t("patient.directory.upcoming_appointment")}
          value={filters.upcomingAppointment}
          onChange={(upcomingAppointment) => patch({ upcomingAppointment })}
        />
        <BooleanFilter
          label={t("patient.directory.pending_balance")}
          value={filters.pendingBalance}
          onChange={(pendingBalance) => patch({ pendingBalance })}
        />
      </div>

      <div className="nc-patients-filters__footer">
        <Button type="button" onClick={onApply}>
          <Filter aria-hidden="true" />
          {t("patient.directory.apply_filters")}
        </Button>
      </div>
    </section>
  );
}

function BooleanFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PatientDirectoryBooleanFilter;
  onChange: (value: PatientDirectoryBooleanFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="nc-patients-field">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) =>
          onChange(next as PatientDirectoryBooleanFilter)
        }
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOLEAN_FILTERS.map((filter) => (
            <SelectItem key={filter} value={filter}>
              {filter === "all"
                ? t("patient.directory.any")
                : filter === "with"
                  ? t("patient.directory.with")
                  : t("patient.directory.without")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PatientsDirectory({
  items,
  view,
  selected,
  onToggleSelected,
  onOpenSummary,
  onMessage,
  onArchive,
  onDelete,
  onRestore,
  onReactivate,
}: {
  items: PatientDirectoryItem[];
  view: "table" | "cards";
  selected: Map<string, PatientDirectoryItem>;
  onToggleSelected: (item: PatientDirectoryItem) => void;
  onOpenSummary: (item: PatientDirectoryItem) => void;
  onMessage: (patient: Patient) => void;
  onArchive: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  onRestore: (patient: Patient) => void;
  onReactivate: (patient: Patient) => void;
}) {
  const { t } = useTranslation();
  const isSelectionTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    !target.closest(
      "a, button, input, select, textarea, [role='button'], [role='menuitem']",
    );
  const handleSelectionKeyDown = (
    event: React.KeyboardEvent<HTMLElement>,
    item: PatientDirectoryItem,
  ) => {
    if (
      (event.key !== "Enter" && event.key !== " ") ||
      !isSelectionTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    toggleItemSelection(item);
  };
  const toggleItemSelection = (item: PatientDirectoryItem) => {
    const wasSelected = selected.has(item.patient.id.toString());
    onToggleSelected(item);
    if (!wasSelected) onOpenSummary(item);
  };
  return (
    <>
      <div
        className="nc-patients-tableWrap"
        data-visible={view === "table" || undefined}
      >
        <Table>
          <caption className="sr-only">
            {t("patient.directory.available_results")}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">
                {t("patient.directory.patient_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.objective_plan_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.progress_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.plan_stage_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.next_appointment_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.follow_up_column")}
              </TableHead>
              <TableHead scope="col" className="w-16 text-right">
                {t("patient.directory.actions_column")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.patient.id.toString()}
                data-clinical-status={item.clinicalStatus}
                data-selected={
                  selected.has(item.patient.id.toString()) || undefined
                }
                aria-selected={selected.has(item.patient.id.toString())}
                tabIndex={0}
                onClick={(event) => {
                  if (isSelectionTarget(event.target))
                    toggleItemSelection(item);
                }}
                onKeyDown={(event) => handleSelectionKeyDown(event, item)}
              >
                <TableCell>
                  <PatientIdentity item={item} />
                </TableCell>
                <TableCell>
                  <PatientPlanSummary item={item} />
                </TableCell>
                <TableCell>
                  <PatientGoalProgress item={item} />
                </TableCell>
                <TableCell>
                  <PatientPlanStage item={item} />
                </TableCell>
                <TableCell>
                  <PatientAppointment item={item} />
                </TableCell>
                <TableCell>
                  <PatientFollowUp item={item} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="nc-patient-quickActions">
                    {!item.patient.deletedAt && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="nc-patient-quickAction"
                          aria-label={t("patient.directory.contact_patient", {
                            name: item.patient.fullName,
                          })}
                          onClick={() => onMessage(item.patient)}
                        >
                          <MessageCircle aria-hidden="true" />
                        </Button>
                        <Button
                          asChild
                          type="button"
                          variant="ghost"
                          size="icon"
                        >
                          <Link
                            to={`/agenda?patientId=${encodeURIComponent(item.patient.id.toString())}&create=1`}
                            className="nc-patient-quickAction"
                            aria-label={t(
                              "patient.directory.schedule_patient",
                              {
                                name: item.patient.fullName,
                              },
                            )}
                          >
                            <CalendarPlus aria-hidden="true" />
                          </Link>
                        </Button>
                      </>
                    )}
                    <PatientRowActions
                      item={item}
                      onOpenSummary={onOpenSummary}
                      onMessage={onMessage}
                      onArchive={onArchive}
                      onDelete={onDelete}
                      onRestore={onRestore}
                      onReactivate={onReactivate}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div
        className="nc-patients-mobileList"
        data-visible={view === "cards" || undefined}
      >
        {items.map((item) => (
          <article
            className="nc-patient-card"
            key={item.patient.id.toString()}
            data-selected={
              selected.has(item.patient.id.toString()) || undefined
            }
            aria-selected={selected.has(item.patient.id.toString())}
            tabIndex={0}
            onClick={(event) => {
              if (isSelectionTarget(event.target)) toggleItemSelection(item);
            }}
            onKeyDown={(event) => handleSelectionKeyDown(event, item)}
          >
            <div className="nc-patient-card__top">
              <div className="nc-patient-card__selection">
                <PatientIdentity item={item} />
              </div>
              <PatientRowActions
                item={item}
                onOpenSummary={onOpenSummary}
                onMessage={onMessage}
                onArchive={onArchive}
                onDelete={onDelete}
                onRestore={onRestore}
                onReactivate={onReactivate}
              />
            </div>
            <div className="nc-patient-card__status">
              <PatientFollowUp item={item} />
            </div>
            <PatientPlanSummary item={item} />
            <div className="nc-patient-card__clinicalGrid">
              <PatientGoalProgress item={item} />
              <PatientPlanStage item={item} />
            </div>
            <PatientAppointment item={item} />
            {!item.patient.deletedAt && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/pacientes/${item.patient.id.toString()}`}>
                  <UserRound aria-hidden="true" />
                  {t("patient.directory.view_profile")}
                </Link>
              </Button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function PatientIdentity({ item }: { item: PatientDirectoryItem }) {
  const { t } = useTranslation();
  const patientId = item.patient.id.toString();
  const tone = patientId.charCodeAt(patientId.length - 1) % 5;
  return (
    <div className="nc-patient-identity">
      <span className="nc-patient-avatar" data-tone={tone} aria-hidden="true">
        {item.patient.photoUrl ? (
          <img src={item.patient.photoUrl} alt="" />
        ) : (
          item.initials
        )}
      </span>
      <span className="nc-patient-identity__text">
        <span className="nc-patient-identity__title">
          {item.patient.deletedAt ? (
            <strong>{item.patient.fullName}</strong>
          ) : (
            <Link to={`/pacientes/${patientId}`}>{item.patient.fullName}</Link>
          )}
          <span>{item.recordNumber}</span>
        </span>
        <span className="nc-patient-identity__meta">
          <small>
            {t("patient.age_value", { age: item.patient.age })} ·{" "}
            {t(`patient.sex_${item.patient.sex}`)}
          </small>
          {item.patient.clinicalTags.length > 0 && (
            <span className="nc-patient-identity__tags">
              {item.patient.clinicalTags.slice(0, 2).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

function PatientPlanSummary({ item }: { item: PatientDirectoryItem }) {
  const { t } = useTranslation();
  return (
    <div className="nc-patient-plan">
      <strong>
        {item.goalLabel ?? t("patient.directory.no_active_objective")}
      </strong>
      <span className="nc-patient-plan__detail">
        <ClipboardList aria-hidden="true" />
        <span>
          {item.activePlanName ?? t("patient.directory.no_active_plan")}
        </span>
        {item.activePlanKcal !== null && (
          <small>{item.activePlanKcal.toLocaleString()} kcal</small>
        )}
      </span>
    </div>
  );
}

function PatientGoalProgress({ item }: { item: PatientDirectoryItem }) {
  const { t, i18n } = useTranslation();
  const formatter = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 1,
  });
  if (
    item.goalProgress === null ||
    item.goalCurrentValue === null ||
    item.goalTargetValue === null
  ) {
    return (
      <div className="nc-patient-progress nc-patient-progress--empty">
        <span>{t("patient.directory.no_progress_data")}</span>
        <small>{t("patient.directory.capture_measurement")}</small>
      </div>
    );
  }
  const delta =
    item.goalInitialValue === null
      ? null
      : item.goalCurrentValue - item.goalInitialValue;
  return (
    <div className="nc-patient-progress">
      <div>
        <strong>
          {formatter.format(item.goalCurrentValue)} {item.goalUnit}
        </strong>
        {delta !== null && (
          <span data-positive={delta > 0 || undefined}>
            {delta > 0 ? "+" : ""}
            {formatter.format(delta)}
          </span>
        )}
      </div>
      <span className="nc-patient-progress__track" aria-hidden="true">
        <span style={{ width: `${item.goalProgress}%` }} />
      </span>
      <small>
        {t("patient.directory.goal_progress", {
          progress: Math.round(item.goalProgress),
          target: formatter.format(item.goalTargetValue),
          unit: item.goalUnit,
        })}
      </small>
    </div>
  );
}

function PatientPlanStage({ item }: { item: PatientDirectoryItem }) {
  const { t, i18n } = useTranslation();
  if (!item.hasActivePlan) {
    return (
      <div className="nc-patient-stage nc-patient-stage--empty">
        {item.patient.deletedAt ? (
          <span>{t("patient.directory.without_plan")}</span>
        ) : (
          <Link to={`/pacientes/${item.patient.id.toString()}/planes/nuevo`}>
            <Plus aria-hidden="true" />
            {t("patient.directory.assign_plan")}
          </Link>
        )}
      </div>
    );
  }
  const progress = item.activePlanProgress;
  return (
    <div className="nc-patient-stage">
      <span className="nc-patient-stage__blocks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <i
            key={index}
            data-complete={
              progress !== null && progress >= ((index + 1) / 12) * 100
                ? true
                : undefined
            }
          />
        ))}
      </span>
      <small>
        {item.activePlanEndAt
          ? t("patient.directory.plan_until", {
              date: new Intl.DateTimeFormat(i18n.language, {
                day: "numeric",
                month: "short",
              }).format(new Date(item.activePlanEndAt)),
            })
          : t("patient.directory.plan_in_progress")}
      </small>
    </div>
  );
}

function PatientAppointment({ item }: { item: PatientDirectoryItem }) {
  const { t, i18n } = useTranslation();
  if (!item.nextAppointmentAt) {
    return item.patient.deletedAt ? (
      <span className="nc-patient-appointment nc-patient-appointment--empty">
        —
      </span>
    ) : (
      <Link
        className="nc-patient-appointment nc-patient-appointment--schedule"
        to={`/agenda?patientId=${encodeURIComponent(item.patient.id.toString())}&create=1`}
      >
        <CalendarPlus aria-hidden="true" />
        {t("patient.directory.schedule")}
      </Link>
    );
  }
  const date = new Date(item.nextAppointmentAt);
  const confirmed = item.nextAppointmentStatus === "confirmed";
  return (
    <div className="nc-patient-appointment">
      <strong>
        {new Intl.DateTimeFormat(i18n.language, {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date)}
      </strong>
      <span data-confirmed={confirmed || undefined}>
        {confirmed
          ? t("patient.directory.appointment_confirmed")
          : t("patient.directory.appointment_pending")}
      </span>
    </div>
  );
}

function PatientFollowUp({ item }: { item: PatientDirectoryItem }) {
  const { t } = useTranslation();
  if (item.patient.deletedAt || item.patient.status !== "active") {
    return <PatientStatusBadge patient={item.patient} />;
  }
  return (
    <div className="nc-patient-followUp" data-status={item.clinicalStatus}>
      <span>
        {t(
          `patient.directory.clinical_${item.clinicalStatus.replace("-", "_")}`,
        )}
      </span>
      <small>
        {item.daysSinceLastConsultation === null
          ? t("patient.directory.no_consultations")
          : t("patient.directory.last_consultation_days", {
              count: item.daysSinceLastConsultation,
            })}
      </small>
    </div>
  );
}

function PatientStatusBadge({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  if (patient.deletedAt) {
    return (
      <Badge variant="destructive" className="nc-patient-status">
        <span />
        {t("common.deleted")}
      </Badge>
    );
  }
  const variant =
    patient.status === "active"
      ? "success"
      : patient.status === "deceased"
        ? "warning"
        : patient.status === "inactive"
          ? "secondary"
          : "outline";
  return (
    <Badge
      variant={variant}
      className="nc-patient-status"
      data-status={patient.status}
    >
      <span />
      {patientStatusLabel(t, patient.status)}
    </Badge>
  );
}

function PatientRowActions({
  item,
  onOpenSummary,
  onMessage,
  onArchive,
  onDelete,
  onRestore,
  onReactivate,
}: {
  item: PatientDirectoryItem;
  onOpenSummary: (item: PatientDirectoryItem) => void;
  onMessage: (patient: Patient) => void;
  onArchive: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  onRestore: (patient: Patient) => void;
  onReactivate: (patient: Patient) => void;
}) {
  const { t } = useTranslation();
  const patient = item.patient;
  const patientId = patient.id.toString();
  const deleted = patient.deletedAt !== null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="nc-patient-actions"
          aria-label={t("patient.directory.actions_for", {
            name: patient.fullName,
          })}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="nc-patient-menu min-w-52">
        <DropdownMenuLabel>{patient.fullName}</DropdownMenuLabel>
        {!deleted && (
          <>
            <DropdownMenuItem onClick={() => onOpenSummary(item)}>
              <Stethoscope aria-hidden="true" />
              {t("patient.directory.clinical_summary")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/pacientes/${patientId}`}>
                <UserRound aria-hidden="true" />
                {t("patient.directory.view_profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/pacientes/${patientId}/editar`}>
                <ClipboardList aria-hidden="true" />
                {t("patient.directory.edit_patient")}
              </Link>
            </DropdownMenuItem>
            {patient.status === "active" && (
              <DropdownMenuItem asChild>
                <Link to={`/pacientes/${patientId}/consultas/nueva`}>
                  <CalendarPlus aria-hidden="true" />
                  {t("patient.directory.new_consultation")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onMessage(patient)}>
              <MessageCircle aria-hidden="true" />
              {t("patient.directory.send_message")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                to={`/agenda?patientId=${encodeURIComponent(patientId)}&create=1`}
              >
                <CalendarPlus aria-hidden="true" />
                {t("patient.directory.schedule_appointment")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/pacientes/${patientId}/consultas`}>
                <ClipboardList aria-hidden="true" />
                {t("patient.directory.view_history")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                to={
                  item.hasActivePlan
                    ? `/pacientes/${patientId}/planes`
                    : `/pacientes/${patientId}/planes/nuevo`
                }
              >
                <Utensils aria-hidden="true" />
                {t(
                  item.hasActivePlan
                    ? "patient.directory.view_plan"
                    : "patient.directory.create_plan",
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {patient.status === "archived" ? (
              <DropdownMenuItem
                onClick={() => onReactivate(patient)}
                className="text-primary focus:text-primary"
              >
                <RotateCcw aria-hidden="true" />
                {t("patient.directory.reactivate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onArchive(patient)}>
                <Archive aria-hidden="true" />
                {t("common.archive")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onDelete(patient)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              {t("patient.directory.delete_or_deactivate")}
            </DropdownMenuItem>
          </>
        )}
        {deleted && (
          <DropdownMenuItem
            onClick={() => onRestore(patient)}
            className="text-primary focus:text-primary"
            data-testid="restore-patient-menu-item"
          >
            <RotateCcw aria-hidden="true" />
            {t("common.restore")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PatientsBulkBar({
  items,
  status,
  busy,
  onClear,
  onMessage,
  onPlan,
  onExport,
  onRetention,
}: {
  items: PatientDirectoryItem[];
  status: PatientDirectoryStatusFilter;
  busy: boolean;
  onClear: () => void;
  onMessage: () => void;
  onPlan: (item: PatientDirectoryItem) => void;
  onExport: () => void;
  onRetention: () => void;
}) {
  const { t } = useTranslation();
  const activeSelection = status !== "archived" && status !== "deleted";
  return (
    <aside
      className="nc-patients-bulkBar"
      aria-label={t("patient.directory.bulk_actions")}
    >
      <strong>
        {t("patient.directory.selected_count", { count: items.length })}
      </strong>
      {status !== "deleted" && (
        <Button type="button" size="sm" variant="ghost" onClick={onMessage}>
          <MessageCircle aria-hidden="true" />
          {t("patient.directory.send_message")}
        </Button>
      )}
      {activeSelection && items.length === 1 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPlan(items[0])}
        >
          <Utensils aria-hidden="true" />
          {t(
            items[0].hasActivePlan
              ? "patient.directory.view_plan"
              : "patient.directory.create_plan",
          )}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={onExport}
      >
        <Download aria-hidden="true" />
        {t("patient.directory.export_selected")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={activeSelection ? "destructive" : "secondary"}
        disabled={busy}
        onClick={onRetention}
      >
        {status === "deleted" || status === "archived" ? (
          <RotateCcw aria-hidden="true" />
        ) : (
          <Archive aria-hidden="true" />
        )}
        {t(
          status === "deleted"
            ? "common.restore"
            : status === "archived"
              ? "patient.directory.reactivate"
              : "common.archive",
        )}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t("patient.directory.clear_selection")}
        onClick={onClear}
      >
        <X aria-hidden="true" />
      </Button>
    </aside>
  );
}

function PatientMessageDialog({
  targets,
  onOpenChange,
}: {
  targets: Patient[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const templates = [
    {
      label: t("patient.directory.message_template_appointment"),
      content: t("patient.directory.message_template_appointment_text"),
    },
    {
      label: t("patient.directory.message_template_food_log"),
      content: t("patient.directory.message_template_food_log_text"),
    },
    {
      label: t("patient.directory.message_template_follow_up"),
      content: t("patient.directory.message_template_follow_up_text"),
    },
    {
      label: t("patient.directory.message_template_results"),
      content: t("patient.directory.message_template_results_text"),
    },
  ];

  const close = () => {
    setMessage("");
    onOpenChange(false);
  };
  const sendMessage = async () => {
    const content = message.trim();
    if (!content) {
      toast.error(t("patient.directory.message_required"));
      return;
    }
    setSending(true);
    try {
      const results = await Promise.allSettled(
        targets.map((patient) =>
          sendProfessionalMessage(patient.id.toString(), content),
        ),
      );
      const succeeded = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      if (succeeded > 0) {
        toast.success(
          t("patient.directory.messages_sent", { count: succeeded }),
        );
      }
      if (failures.length > 0) {
        const firstReason = failures[0].reason;
        toast.error(
          t("patient.directory.messages_failed", { count: failures.length }),
          {
            description:
              firstReason instanceof Error
                ? firstReason.message
                : String(firstReason),
          },
        );
      }
      if (succeeded > 0) close();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={targets.length > 0}
      onOpenChange={(open) => {
        if (!open) setMessage("");
        onOpenChange(open);
      }}
    >
      <DialogContent className="nc-patients-messageDialog">
        <DialogHeader>
          <DialogTitle>{t("patient.directory.message_title")}</DialogTitle>
          <DialogDescription>
            {targets.length === 1
              ? targets[0].fullName
              : t("patient.directory.message_recipients", {
                  count: targets.length,
                })}
          </DialogDescription>
        </DialogHeader>
        <div className="nc-patients-messageTemplates">
          {templates.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => setMessage(template.content)}
            >
              {template.label}
            </button>
          ))}
        </div>
        <Label htmlFor="patient-directory-message">
          {t("patient.directory.message_label")}
        </Label>
        <Textarea
          id="patient-directory-message"
          value={message}
          rows={6}
          placeholder={t("patient.directory.message_placeholder")}
          onChange={(event) => setMessage(event.target.value)}
        />
        <p className="nc-patients-messageHint">
          {t("patient.directory.message_portal_hint")}
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={sending}
            onClick={() => void sendMessage()}
          >
            <Send aria-hidden="true" />
            {sending
              ? t("patient_portal.messages_sending")
              : t("patient.directory.send_message")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatientSummaryDrawer({
  item,
  onOpenChange,
}: {
  item: PatientDirectoryItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const isTauriDesktop =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as Window & {
          __TAURI__?: unknown;
          __TAURI_INTERNALS__?: unknown;
        }
      ).__TAURI__ ||
      (
        window as Window & {
          __TAURI__?: unknown;
          __TAURI_INTERNALS__?: unknown;
        }
      ).__TAURI_INTERNALS__,
    );
  const patientId = item?.patient.id.toString() ?? null;
  const { summary, loading, error } = usePatientClinicalSummary(patientId);
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  const formatValue = (value: number, maximumFractionDigits = 1) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits }).format(
      value,
    );
  const latestMeasurement = summary?.anthropometry.latest ?? null;
  const weightHistory = summary?.anthropometry.history ?? [];
  const weightValues = weightHistory.map((measurement) => measurement.weightKg);
  const minimumWeight = weightValues.length ? Math.min(...weightValues) : 0;
  const maximumWeight = weightValues.length ? Math.max(...weightValues) : 0;
  const weightRange = Math.max(maximumWeight - minimumWeight, 1);
  const chartPoints = weightHistory.map((measurement, index) => ({
    x:
      weightHistory.length === 1
        ? 160
        : (index / (weightHistory.length - 1)) * 320,
    y: 88 - ((measurement.weightKg - minimumWeight) / weightRange) * 70,
  }));
  const chartLine = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const chartArea = chartPoints.length ? `0,96 ${chartLine} 320,96` : "";
  const weightChange =
    weightValues.length > 1 ? weightValues.at(-1)! - weightValues[0] : null;
  const attendance = summary?.attendance ?? { attended: 0, total: 0 };
  const attendanceSlots =
    attendance.total > 0 ? Math.min(attendance.total, 7) : 7;
  const attendedSlots = Math.min(attendance.attended, attendanceSlots);
  const activePlan = summary?.activePlan ?? null;
  const planStart = activePlan ? new Date(activePlan.startDate) : null;
  const planEnd = activePlan?.endDate ? new Date(activePlan.endDate) : null;
  const totalPlanWeeks =
    planStart && planEnd
      ? Math.max(
          1,
          Math.ceil((planEnd.getTime() - planStart.getTime()) / 604_800_000),
        )
      : null;
  const currentPlanWeek = planStart
    ? Math.max(
        1,
        Math.min(
          totalPlanWeeks ?? Number.POSITIVE_INFINITY,
          Math.floor((Date.now() - planStart.getTime()) / 604_800_000) + 1,
        ),
      )
    : null;

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="nc-patients-summaryDrawer"
        data-tauri={isTauriDesktop || undefined}
        overlayClassName={`nc-patients-summaryDrawer__overlay${
          isTauriDesktop ? " nc-patients-summaryDrawer__overlay--tauri" : ""
        }`}
      >
        {item && (
          <>
            <DialogHeader className="nc-patients-summaryDrawer__header">
              <span
                className="nc-patients-summaryDrawer__avatar"
                aria-hidden="true"
              >
                {item.initials}
              </span>
              <div>
                <DialogTitle>{item.patient.fullName}</DialogTitle>
                <DialogDescription>
                  {t("patient.age_value", { age: item.patient.age })} ·{" "}
                  {t(`patient.sex_${item.patient.sex}`)} · {item.recordNumber}
                </DialogDescription>
                {item.patient.clinicalTags[0] && (
                  <span className="nc-patients-summaryDrawer__tag">
                    {item.patient.clinicalTags[0]}
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="nc-patients-summaryDrawer__body">
              {loading ? (
                <div
                  className="nc-patients-summaryDrawer__loading"
                  role="status"
                >
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-28 w-full" />
                </div>
              ) : error ? (
                <p className="nc-patients-summaryDrawer__error">{error}</p>
              ) : (
                <>
                  <section className="nc-patients-summaryDrawer__metrics">
                    {[
                      [
                        t("patient.directory.summary_weight"),
                        latestMeasurement
                          ? `${formatValue(latestMeasurement.weightKg)} kg`
                          : "—",
                      ],
                      [
                        t("patient.directory.summary_bmi"),
                        latestMeasurement?.bmi
                          ? formatValue(latestMeasurement.bmi)
                          : "—",
                      ],
                      [
                        t("patient.directory.summary_body_fat"),
                        latestMeasurement?.bodyFatPct != null
                          ? `${formatValue(latestMeasurement.bodyFatPct)}%`
                          : "—",
                      ],
                      [
                        t("patient.directory.summary_waist"),
                        latestMeasurement?.waistCm != null
                          ? `${formatValue(latestMeasurement.waistCm)} cm`
                          : "—",
                      ],
                    ].map(([label, value]) => (
                      <article key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </article>
                    ))}
                  </section>

                  <section className="nc-patients-summaryDrawer__card nc-patients-summaryDrawer__attendance">
                    <header>
                      <h3>{t("patient.directory.summary_attendance")}</h3>
                      <span>
                        {attendance.total > 0
                          ? t("patient.directory.summary_attendance_value", {
                              attended: attendance.attended,
                              total: attendance.total,
                            })
                          : t("patient.directory.summary_attendance_empty")}
                      </span>
                    </header>
                    <div className="nc-patients-summaryDrawer__attendanceTrack">
                      {Array.from({ length: attendanceSlots }).map(
                        (_, index) => (
                          <i
                            key={index}
                            data-attended={index < attendedSlots || undefined}
                            data-missed={
                              attendance.total > 0 && index >= attendedSlots
                                ? true
                                : undefined
                            }
                          />
                        ),
                      )}
                    </div>
                    <p>
                      {activePlan && currentPlanWeek
                        ? t("patient.directory.summary_current_stage", {
                            current: currentPlanWeek,
                            total: totalPlanWeeks ?? "—",
                          })
                        : t("patient.directory.no_active_plan")}
                    </p>
                  </section>

                  <section className="nc-patients-summaryDrawer__card nc-patients-summaryDrawer__evolution">
                    <header>
                      <h3>{t("patient.directory.summary_evolution")}</h3>
                      <span>
                        {t("patient.directory.summary_last_six_months")}
                      </span>
                    </header>
                    {chartPoints.length > 0 ? (
                      <>
                        <svg
                          viewBox="0 0 320 100"
                          preserveAspectRatio="none"
                          aria-label={t(
                            "patient.directory.summary_weight_chart",
                          )}
                        >
                          <polygon points={chartArea} />
                          <polyline points={chartLine} />
                          {chartPoints.map((point, index) => (
                            <circle
                              key={index}
                              cx={point.x}
                              cy={point.y}
                              r="2"
                            />
                          ))}
                        </svg>
                        <div className="nc-patients-summaryDrawer__chartLabels">
                          {weightHistory.map((measurement) => (
                            <span key={measurement.measuredAt}>
                              {new Intl.DateTimeFormat(i18n.language, {
                                month: "short",
                              }).format(new Date(measurement.measuredAt))}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="nc-patients-summaryDrawer__emptyChart">
                        {t("patient.directory.summary_no_measurements")}
                      </div>
                    )}
                    <footer>
                      <strong
                        data-positive={
                          weightChange !== null && weightChange > 0
                            ? true
                            : undefined
                        }
                      >
                        {weightChange === null
                          ? "—"
                          : `${weightChange > 0 ? "+" : ""}${formatValue(weightChange)} kg`}
                      </strong>
                      <span>
                        {item.goalProgress != null
                          ? t("patient.directory.summary_goal_progress", {
                              percentage: Math.round(item.goalProgress),
                            })
                          : t("patient.directory.summary_no_goal")}
                      </span>
                    </footer>
                  </section>

                  <section className="nc-patients-summaryDrawer__card nc-patients-summaryDrawer__plan">
                    <header>
                      <h3>{t("patient.directory.summary_active_plan")}</h3>
                      {activePlan && currentPlanWeek && (
                        <span>
                          {t("patient.directory.summary_plan_week", {
                            current: currentPlanWeek,
                            total: totalPlanWeeks ?? "—",
                          })}
                        </span>
                      )}
                    </header>
                    {activePlan ? (
                      <>
                        <strong>{activePlan.name}</strong>
                        <p>
                          {formatValue(activePlan.kcalTarget, 0)} kcal ·{" "}
                          {t("patient.directory.summary_meal_count", {
                            count: activePlan.mealCount,
                          })}
                        </p>
                        {activePlan.macroPercentages && (
                          <div className="nc-patients-summaryDrawer__macros">
                            {(
                              [
                                [
                                  "protein",
                                  t("patient.directory.summary_protein"),
                                ],
                                ["carbs", t("patient.directory.summary_carbs")],
                                ["fat", t("patient.directory.summary_fat")],
                              ] as const
                            ).map(([key, label]) => (
                              <span key={key} data-macro={key}>
                                <small>
                                  {label}
                                  <b>{activePlan.macroPercentages![key]}%</b>
                                </small>
                                <i>
                                  <em
                                    style={{
                                      width: `${activePlan.macroPercentages![key]}%`,
                                    }}
                                  />
                                </i>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p>{t("patient.directory.no_active_plan")}</p>
                    )}
                  </section>

                  <section className="nc-patients-summaryDrawer__card nc-patients-summaryDrawer__note">
                    <h3>{t("patient.directory.summary_last_note")}</h3>
                    <p>
                      {summary?.latestConsultation?.note ??
                        summary?.latestConsultation?.reason ??
                        t("patient.directory.no_consultations")}
                    </p>
                    <small>
                      {summary?.latestConsultation
                        ? t("patient.directory.summary_last_consultation_by", {
                            date: formatDate(summary.latestConsultation.date),
                          })
                        : t("patient.directory.not_available")}
                    </small>
                  </section>
                </>
              )}
            </div>

            <DialogFooter className="nc-patients-summaryDrawer__footer">
              <Button asChild>
                <Link to={`/pacientes/${patientId}`}>
                  {t("patient.directory.summary_open_record")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/pacientes/${patientId}/consultas/nueva`}>
                  {t("patient.directory.new_consultation")}
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PatientsPagination({
  page,
  totalPages,
  from,
  to,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useTranslation();
  const pages =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : Array.from(new Set([1, page - 1, page, page + 1, totalPages])).filter(
          (value) => value >= 1 && value <= totalPages,
        );

  return (
    <div className="nc-patients-pagination">
      <div className="nc-patients-pagination__summary">
        <p>{t("patient.directory.showing", { from, to, total })}</p>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value))}
        >
          <SelectTrigger aria-label={t("patient.directory.page_size")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {[10, 20, 50].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {t("patient.directory.per_page", { count: size })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav aria-label={t("patient.directory.pagination")}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          {t("common.previous")}
        </Button>
        <div className="nc-patients-pagination__pages">
          {pages.map((value, index) => (
            <React.Fragment key={value}>
              {index > 0 && value - pages[index - 1] > 1 && (
                <span aria-hidden="true">…</span>
              )}
              <Button
                type="button"
                variant={value === page ? "secondary" : "ghost"}
                size="icon-sm"
                aria-current={value === page ? "page" : undefined}
                onClick={() => onPageChange(value)}
              >
                {value}
              </Button>
            </React.Fragment>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("common.next")}
          <ChevronRight aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}

function PatientsEmptyState({
  deleted,
  filtered,
  onReset,
  onCreate,
}: {
  deleted: boolean;
  filtered: boolean;
  onReset: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  if (deleted) {
    return (
      <EmptyState
        icon={Trash2}
        title={t("patient.directory.empty_deleted_title")}
        description={t("patient.directory.empty_deleted_description")}
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        variant="search"
        title={t("patient.directory.no_results_title")}
        description={t("patient.directory.no_results_description")}
        action={{ label: t("common.clear_filters"), onClick: onReset }}
      />
    );
  }
  return (
    <EmptyState
      icon={UsersRound}
      title={t("patient.directory.no_patients_title")}
      description={t("patient.directory.no_patients_description")}
      action={{ label: t("patient.new"), onClick: onCreate }}
    />
  );
}

function PatientsLoadingState() {
  const { t } = useTranslation();
  return (
    <div className="nc-patients-loading" role="status">
      <span className="sr-only">{t("patient.directory.loading")}</span>
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="h-10 w-10 rounded-full" />
          <span>
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </span>
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
