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
import { SexLabel } from "@modules/patient/domain/Sex";
import { PatientStatusLabel } from "@modules/patient/domain/PatientStatus";
import { patientService } from "@services/patientService";

const columnHelper = createColumnHelper<Patient>();

export function PatientsListPage() {
  const navigate = useNavigate();
  const { search, statusFilter, setSearch, setStatusFilter, reset } = usePatientsUIStore();
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
          toast.success(`${deleteTarget.fullName} eliminado`);
        } else if (outcome === "archived") {
          toast.success(`${deleteTarget.fullName} archivado`);
        }
      }
      setDeleteTarget(null);
      void reload();
    },
    onError: (err) => {
      toast.error("No se pudo completar la operación", {
        description: err instanceof Error ? err.message : String(err),
      });
    },
  });

  const executeArchive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      await patientService.archive.execute(archiveTarget.id);
      toast.success(`${archiveTarget.fullName} archivado`);
      setArchiveTarget(null);
      void reload();
    } catch (err) {
      toast.error("No se pudo archivar", {
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
      toast.success(`${restoreTarget.fullName} restaurado`);
      setRestoreTarget(null);
      void reload();
    } catch (err) {
      toast.error("No se pudo restaurar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("fullName", {
        header: "Paciente",
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{info.getValue()}</span>
              <span className="text-xs text-muted-foreground">
                {p.age} años · {SexLabel[p.sex]}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("email", {
        header: "Contacto",
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
        header: "Nacimiento",
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
        header: "Estado",
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
    [navigate, cascade, isDeletedView],
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
        title={isDeletedView ? "Pacientes eliminados" : "Pacientes"}
        description={
          isDeletedView
            ? "Pacientes soft-deleted. Usa Restaurar para devolverlos al listado activo."
            : total > 0
              ? `${total} paciente${total === 1 ? "" : "s"}`
              : "Gestiona los expedientes"
        }
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/importar">
                <Upload className="mr-2 h-4 w-4" />
                Importar CSV
              </Link>
            </Button>
            <Button asChild>
              <Link to="/pacientes/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo paciente
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
              placeholder="Buscar por nombre o correo…"
              className="pl-9"
              aria-label="Buscar pacientes"
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
                {s === "all" ? "Todos" : s === "deleted" ? "Eliminados" : PatientStatusLabel[s]}
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
            title="Sin pacientes registrados"
            description="Comienza registrando tu primer paciente para crear consultas y planes alimentarios."
            action={{ label: "Crear paciente", onClick: () => navigate("/pacientes/nuevo") }}
          />
        ) : showNoResults ? (
          <NoResultsFound onReset={reset} />
        ) : (
          <>
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id}>
                      {hg.headers.map((header) => (
                        <TableHead key={header.id}>
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
                      onClick={() => navigate(`/pacientes/${row.original.id.toString()}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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
                  Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Siguiente
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
        title={archiveTarget ? `¿Archivar a ${archiveTarget.fullName}?` : ""}
        description="El paciente se ocultará de los listados activos, pero su expediente clínico se conserva. Podés revertir esta acción más tarde."
        confirmLabel="Archivar"
        tone="warning"
        busy={busy}
        onConfirm={executeArchive}
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
        title={restoreTarget ? `¿Restaurar a ${restoreTarget.fullName}?` : ""}
        description="El paciente volverá al listado activo y podrá editarse / recibir consultas y planes. El cambio se sincroniza con el servidor."
        confirmLabel="Restaurar"
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
  if (deletedAt !== null) {
    return <Badge variant="destructive">Eliminado</Badge>;
  }
  const map: Record<Patient["status"], { variant: "success" | "secondary" | "warning" | "outline" }> = {
    active: { variant: "success" },
    inactive: { variant: "secondary" },
    archived: { variant: "outline" },
    deceased: { variant: "warning" },
  };
  return <Badge variant={map[status].variant}>{PatientStatusLabel[status]}</Badge>;
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
  const isDeleted = patient.deletedAt !== null;
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{patient.fullName}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>Ver detalle</DropdownMenuItem>
          {!isDeleted && (
            <>
              <DropdownMenuItem asChild>
                <Link to={`/pacientes/${patient.id.toString()}/editar`}>Editar</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/pacientes/${patient.id.toString()}/consultas`}>Nueva consulta</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {patient.status !== "archived" && (
                <DropdownMenuItem onClick={() => onArchive(patient)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(patient)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
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
                Restaurar
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
