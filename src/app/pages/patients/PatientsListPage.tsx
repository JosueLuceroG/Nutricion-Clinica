import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Users as UsersIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Mail,
  Phone,
  Upload,
  Archive,
  Trash2,
} from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { EmptyState, NoResultsFound, ErrorState } from "@components/layout/EmptyState";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { usePatients } from "@modules/patient/ui/usePatientHooks";
import { useCascadeDeletePatient } from "@modules/patient/ui/useCascadeDeletePatient";
import { CascadeDeletePatientDialog } from "@modules/patient/ui/CascadeDeletePatientDialog";
import { usePatientsUIStore } from "@store/patientsUIStore";
import type { Patient } from "@modules/patient/domain/Patient";
import { patientService } from "@services/patientService";

function patientStatusLabel(t: ReturnType<typeof useTranslation>["t"], status: Patient["status"]) {
  if (status === "deceased") return t("patient.status_deceased");
  return t(`common.${status}`);
}

const columnHelper = createColumnHelper<Patient>();

export function PatientsListPage() {
  const navigate = useNavigate();
  const { search, statusFilter, setSearch, setStatusFilter, reset } = usePatientsUIStore();
  const { t } = useTranslation();
  const isDeletedView = statusFilter === "deleted";
  const { data, loading, error, reload } = usePatients(
    isDeletedView
      ? { search: search || undefined, includeDeleted: true, status: undefined, limit: 50 }
      : {
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          limit: 50,
        },
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [busy, setBusy] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Patient | null>(null);
  const [restoreTarget, setRestoreTarget] = React.useState<Patient | null>(null);

  // Flujo de eliminación: si el paciente tiene entidades vinculadas
  // abre el modal de cascada con dos opciones (Archivar / Eliminar todo).
  // Si no tiene, ejecuta el borrado simple directamente.
  const cascade = useCascadeDeletePatient({
    onComplete: (outcome) => {
      if (deleteTarget) {
        if (outcome === "deleted") {
          toast.success(t("patient.deleted_success", { name: deleteTarget.fullName }));
        } else if (outcome === "archived") {
          toast.success(t("patient.archived_success", { name: deleteTarget.fullName }));
        }
      }
      setDeleteTarget(null);
      void reload();
    },
    onError: (err) => {
      toast.error(t("patient.operation_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const executeArchive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      await patientService.archive.execute(archiveTarget.id);
      toast.success(t("patient.archived_success", { name: archiveTarget.fullName }));
      setArchiveTarget(null);
      void reload();
    } catch (err) {
      toast.error(t("patient.archive_error"), {
        description: err instanceof Error ? err.message : String(err),
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
      toast.success(t("patient.restored_success", { name: restoreTarget.fullName }));
      setRestoreTarget(null);
      void reload();
    } catch (err) {
      toast.error(t("patient.restore_error"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("fullName", {
        header: t("patient.title_single"),
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{info.getValue()}</span>
              <span className="text-xs text-muted-foreground">
                {t("dashboard.patient_age_sex", { age: p.age, sex: t(`patient.sex_${p.sex}`) })}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("email", {
        header: t("patient.contact"),
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="flex flex-col gap-0.5 text-xs">
              {p.email && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" /> {p.email.toString()}
                </span>
              )}
              {p.phone && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" /> {p.phone.toString()}
                </span>
              )}
              {!p.email && !p.phone && <span className="text-muted-foreground">—</span>}
            </div>
          );
        },
      }),
      columnHelper.accessor((row) => row.birthDate, {
        id: "birthDate",
        header: t("patient.birth_date"),
        cell: (info) => (
          <span className="text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("es-MX", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            }).format(info.getValue() as Date)}
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: t("common.status"),
        cell: (info) => (
          <StatusBadge status={info.getValue()} deletedAt={info.row.original.deletedAt} />
        ),
      }),
      columnHelper.display({
        id: "actions",
        cell: (info) => (
          <RowActions
            patient={info.row.original}
            isDeletedView={isDeletedView}
            onView={() => navigate(`/pacientes/${info.row.original.id.toString()}`)}
            onArchive={(p) => setArchiveTarget(p)}
            onDelete={(p) => {
              setDeleteTarget(p);
              void cascade.requestDelete(p.id);
            }}
            onRestore={(p) => setRestoreTarget(p)}
          />
        ),
      }),
    ],
    [navigate, cascade, isDeletedView, t],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const total = data?.total ?? 0;
  const showEmpty = !loading && !error && total === 0;
  const showNoResults = !loading && !error && total > 0 && (data?.items.length ?? 0) === 0;

  return (
    <>
      <PageHeader
        title={isDeletedView ? `${t("patient.title")} ${t("common.deleted")}` : t("patient.title")}
        description={
          isDeletedView
            ? t("patient.deleted_view_description")
            : total > 0
              ? t("patient.count", { count: total })
              : t("patient.manage_records")
        }
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/importar">
                <Upload className="mr-2 h-4 w-4" />
                {`${t("nav.import")} CSV`}
              </Link>
            </Button>
            <Button asChild>
              <Link to="/pacientes/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                {t("patient.new")}
              </Link>
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("patient.search_placeholder")}
              className="pl-9"
              aria-label={`${t("common.search")} ${t("patient.title")}`}
            />
          </div>
          <div className="flex gap-1 rounded-md border bg-background p-0.5">
            {(["all", "active", "inactive", "archived", "deleted"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="h-7 px-3 text-xs"
              >
                {s === "all" ? t("common.all") : s === "deleted" ? t("common.deleted") : patientStatusLabel(t, s)}
              </Button>
            ))}
          </div>
        </div>

        {error ? (
          <ErrorState
            message={error.message}
            onRetry={reload}
          />
        ) : loading && !data ? (
          <PatientsTableSkeleton />
        ) : showEmpty ? (
          <EmptyState
            icon={UsersIcon}
            title={t("patient.no_patients")}
            description={t("patient.register")}
            action={{ label: t("patient.new"), onClick: () => navigate("/pacientes/nuevo") }}
          />
        ) : showNoResults ? (
          <NoResultsFound onReset={reset} />
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border bg-card">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={
                            header.column.id === "birthDate"
                              ? "hidden md:table-cell"
                              : header.column.id === "email" || header.column.id === "status"
                                ? "hidden lg:table-cell"
                                : undefined
                          }
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="link"
                      onClick={() => navigate(`/pacientes/${row.original.id.toString()}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          navigate(`/pacientes/${row.original.id.toString()}`)
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            cell.column.id === "birthDate"
                              ? "hidden md:table-cell"
                              : cell.column.id === "email" || cell.column.id === "status"
                                ? "hidden lg:table-cell"
                                : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {table.getPageCount() > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t("common.page_info", { current: table.getState().pagination.pageIndex + 1, total: table.getPageCount() })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t("common.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    {t("common.next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PageContent>

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={archiveTarget ? t("patient.archive_title", { name: archiveTarget.fullName }) : ""}
        description={t("patient.archive_desc")}
        confirmLabel={t("common.archive")}
        tone="warning"
        busy={busy}
        onConfirm={executeArchive}
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
        title={restoreTarget ? t("patient.restore_title", { name: restoreTarget.fullName }) : ""}
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

function StatusBadge({ status, deletedAt }: { status: Patient["status"]; deletedAt: Date | null }) {
  const { t } = useTranslation();
  if (deletedAt !== null) {
    return <Badge variant="destructive">{t("common.deleted")}</Badge>;
  }
  const map: Record<Patient["status"], { variant: "success" | "secondary" | "warning" | "outline" }> = {
    active: { variant: "success" },
    inactive: { variant: "secondary" },
    archived: { variant: "outline" },
    deceased: { variant: "warning" },
  };
  return <Badge variant={map[status].variant}>{patientStatusLabel(t, status)}</Badge>;
}

function RowActions({
  patient,
  isDeletedView,
  onView,
  onArchive,
  onDelete,
  onRestore,
}: {
  patient: Patient;
  isDeletedView: boolean;
  onView: () => void;
  onArchive: (p: Patient) => void;
  onDelete: (p: Patient) => void;
  onRestore: (p: Patient) => void;
}) {
  const { t } = useTranslation();
  const isDeleted = patient.deletedAt !== null;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{patient.fullName}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>{t("common.view_details")}</DropdownMenuItem>
          {!isDeleted && (
            <>
              <DropdownMenuItem asChild>
                <Link to={`/pacientes/${patient.id.toString()}/editar`}>{t("common.edit")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/pacientes/${patient.id.toString()}/consultas`}>{t("consultation.new")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {patient.status !== "archived" && (
                <DropdownMenuItem onClick={() => onArchive(patient)}>
                  <Archive className="mr-2 h-4 w-4" />
                  {t("common.archive")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(patient)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </>
          )}
          {isDeleted && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRestore(patient)}
                className="text-primary focus:text-primary"
                data-testid="restore-patient-menu-item"
              >
                <Archive className="mr-2 h-4 w-4" />
                {t("common.restore")}
              </DropdownMenuItem>
            </>
          )}
          {isDeletedView && !isDeleted && null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PatientsTableSkeleton() {
  return (
    <div className="space-y-2 rounded-md border bg-card p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
