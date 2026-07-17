import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Mail,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Search,
  Trash2,
  Upload,
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
import {
  DEFAULT_PATIENT_DIRECTORY_FILTERS,
  type PatientDirectoryBooleanFilter,
  type PatientDirectoryFilters,
  type PatientDirectoryItem,
  type PatientDirectoryStatusFilter,
} from "@modules/patient/application/patientDirectoryTypes";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Sex } from "@modules/patient/domain/Sex";
import { CascadeDeletePatientDialog } from "@modules/patient/ui/CascadeDeletePatientDialog";
import { useCascadeDeletePatient } from "@modules/patient/ui/useCascadeDeletePatient";
import { usePatientDirectory } from "@modules/patient/ui/usePatientDirectory";
import { patientService } from "@services/patientService";
import { useAuthStore } from "@store/authStore";
import { usePatientsUIStore } from "@store/patientsUIStore";
import "./PatientsListPage.css";

const STATUS_FILTERS: PatientDirectoryStatusFilter[] = [
  "all",
  "active",
  "inactive",
  "archived",
  "deleted",
];

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
    reset,
  } = usePatientsUIStore();
  const deferredSearch = React.useDeferredValue(search);
  const [page, setPage] = React.useState(1);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
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

  const { data, loading, error } = usePatientDirectory({
    branchId,
    search: deferredSearch,
    status: statusFilter,
    filters,
    page,
    pageSize,
    refreshToken,
  });

  React.useEffect(() => {
    if (!loading && data && page > data.totalPages) setPage(data.totalPages);
  }, [data, loading, page]);

  const refresh = () => setRefreshToken((value) => value + 1);

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

  const changeStatus = (status: PatientDirectoryStatusFilter) => {
    React.startTransition(() => {
      setStatusFilter(status);
      setPage(1);
    });
  };

  const clearAllFilters = () => {
    reset();
    setDraftFilters(DEFAULT_PATIENT_DIRECTORY_FILTERS);
    setPage(1);
    setFiltersOpen(false);
  };

  const filterCount = activeFilterCount(filters);
  const hasQuery =
    search.trim().length > 0 || statusFilter !== "all" || filterCount > 0;

  return (
    <>
      <PageContent className="nc-patients-page">
        <PatientsHero total={data?.counts.total ?? 0} loading={loading} />

        <section
          className="nc-patients-directory"
          aria-label={t("patient.directory.available_results")}
          aria-busy={loading}
        >
          <PatientsToolbar
            search={search}
            status={statusFilter}
            filterCount={filterCount}
            filtersOpen={filtersOpen}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onStatusChange={changeStatus}
            onToggleFilters={() => {
              setDraftFilters(filters);
              setFiltersOpen((open) => !open);
            }}
          />

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
                  onArchive={setArchiveTarget}
                  onDelete={(patient) => {
                    setDeleteTarget(patient);
                    void cascade.requestDelete(patient.id);
                  }}
                  onRestore={setRestoreTarget}
                />
                <PatientsPagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
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
    </>
  );
}

function PatientsHero({ total, loading }: { total: number; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="nc-patients-hero" aria-labelledby="patients-title">
      <div className="nc-patients-hero__identity">
        <span className="nc-patients-hero__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="7.5" cy="7" r="3.25" fill="currentColor" />
            <circle cx="16.5" cy="7" r="3.25" fill="currentColor" />
            <path d="M1.75 19.75v-2.1c0-3.45 2.58-5.9 5.75-5.9s5.75 2.45 5.75 5.9v2.1H1.75Z" fill="currentColor" />
            <path d="M10.75 19.75v-2.1c0-3.45 2.58-5.9 5.75-5.9s5.75 2.45 5.75 5.9v2.1h-11.5Z" fill="currentColor" />
          </svg>
        </span>
        <div>
          <div className="nc-patients-hero__titleRow">
            <h1 id="patients-title">{t("patient.title")}</h1>
            <Badge variant="info" className="nc-patients-hero__count">
              <UsersRound aria-hidden="true" />
              {loading
                ? "..."
                : t("patient.directory.total_patients", { count: total })}
            </Badge>
          </div>
          <p>{t("patient.directory.description")}</p>
        </div>
      </div>
    </section>
  );
}

function PatientsToolbar({
  search,
  status,
  filterCount,
  filtersOpen,
  onSearchChange,
  onStatusChange,
  onToggleFilters,
}: {
  search: string;
  status: PatientDirectoryStatusFilter;
  filterCount: number;
  filtersOpen: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: PatientDirectoryStatusFilter) => void;
  onToggleFilters: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="nc-patients-toolbar">
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

      <div
        className="nc-patients-tabs"
        role="tablist"
        aria-label={t("common.status")}
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            id={`patient-status-${filter}`}
            type="button"
            role="tab"
            aria-selected={status === filter}
            aria-controls="patients-results"
            tabIndex={status === filter ? 0 : -1}
            data-active={status === filter || undefined}
            onClick={() => onStatusChange(filter)}
            onKeyDown={(event) => {
              const currentIndex = STATUS_FILTERS.indexOf(filter);
              const targetIndex =
                event.key === "ArrowRight"
                  ? (currentIndex + 1) % STATUS_FILTERS.length
                  : event.key === "ArrowLeft"
                    ? (currentIndex - 1 + STATUS_FILTERS.length) %
                      STATUS_FILTERS.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? STATUS_FILTERS.length - 1
                        : null;
              if (targetIndex === null) return;
              event.preventDefault();
              const target = STATUS_FILTERS[targetIndex];
              onStatusChange(target);
              window.requestAnimationFrame(() =>
                document.getElementById(`patient-status-${target}`)?.focus(),
              );
            }}
          >
            {statusFilterLabel(t, filter)}
          </button>
        ))}
      </div>

      <div className="nc-patients-toolbar__actions">
        <Button asChild variant="outline" className="nc-patients-importButton">
          <Link to="/pacientes/importar">
            <Upload aria-hidden="true" />
            {t("patient.directory.import_csv")}
          </Link>
        </Button>
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
  onArchive,
  onDelete,
  onRestore,
}: {
  items: PatientDirectoryItem[];
  onArchive: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  onRestore: (patient: Patient) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="nc-patients-tableWrap">
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
                {t("patient.directory.contact_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.age_column")}
              </TableHead>
              <TableHead scope="col">
                {t("patient.directory.status_column")}
              </TableHead>
              <TableHead scope="col" className="w-16 text-right">
                <span className="sr-only">
                  {t("patient.directory.actions_column")}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.patient.id.toString()}>
                <TableCell>
                  <PatientIdentity item={item} />
                </TableCell>
                <TableCell>
                  <PatientContact patient={item.patient} />
                </TableCell>
                <TableCell>
                  <span className="nc-patients-age">
                    {t("patient.age_value", { age: item.patient.age })}
                  </span>
                </TableCell>
                <TableCell>
                  <PatientStatusBadge patient={item.patient} />
                </TableCell>
                <TableCell className="text-right">
                  <PatientRowActions
                    patient={item.patient}
                    onArchive={onArchive}
                    onDelete={onDelete}
                    onRestore={onRestore}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="nc-patients-mobileList">
        {items.map((item) => (
          <article className="nc-patient-card" key={item.patient.id.toString()}>
            <div className="nc-patient-card__top">
              <PatientIdentity item={item} />
              <PatientRowActions
                patient={item.patient}
                onArchive={onArchive}
                onDelete={onDelete}
                onRestore={onRestore}
              />
            </div>
            <div className="nc-patient-card__meta">
              <PatientStatusBadge patient={item.patient} />
              <span>{t("patient.age_value", { age: item.patient.age })}</span>
            </div>
            <PatientContact patient={item.patient} />
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
        {item.patient.deletedAt ? (
          <strong>{item.patient.fullName}</strong>
        ) : (
          <Link to={`/pacientes/${patientId}`}>{item.patient.fullName}</Link>
        )}
        <small>
          {t("patient.age_value", { age: item.patient.age })} ·{" "}
          {t(`patient.sex_${item.patient.sex}`)}
        </small>
      </span>
    </div>
  );
}

function PatientContact({ patient }: { patient: Patient }) {
  const { t } = useTranslation();
  if (!patient.email && !patient.phone) {
    return (
      <span className="nc-patient-contact nc-patient-contact--empty">
        {t("patient.directory.no_contact")}
      </span>
    );
  }
  return (
    <span className="nc-patient-contact">
      {patient.email && (
        <span title={patient.email.toString()}>
          <Mail aria-hidden="true" />
          {patient.email.toString()}
        </span>
      )}
      {patient.phone && (
        <span>
          <Phone aria-hidden="true" />
          {patient.phone.toString()}
        </span>
      )}
    </span>
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
  patient,
  onArchive,
  onDelete,
  onRestore,
}: {
  patient: Patient;
  onArchive: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  onRestore: (patient: Patient) => void;
}) {
  const { t } = useTranslation();
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
            <DropdownMenuItem asChild>
              <Link to={`/pacientes/${patientId}/consultas`}>
                <ClipboardList aria-hidden="true" />
                {t("patient.directory.view_history")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/pacientes/${patientId}/planes`}>
                <Utensils aria-hidden="true" />
                {t("patient.directory.view_plan")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {patient.status !== "archived" && (
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

function PatientsPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
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
      <p>{t("patient.directory.page_summary", { page, totalPages })}</p>
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
