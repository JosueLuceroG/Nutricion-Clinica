import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Info,
  Upload,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageContent } from "@app/layout/AppLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Skeleton } from "@components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { toast } from "sonner";
import {
  closeCsvPreviewWindow,
  currentPatientRowsForBranch,
  downloadAndOpenCsv,
  patientImporterService,
  patientRowsToCsv,
  prepareCsvPreviewWindow,
  type ImporterPreview,
  type MappedRow,
} from "@services/importer";
import { db } from "@services/db/dexieSchema";
import { getActiveSucursalId } from "@services/tenancy/sucursalScope";
import { SexLabel } from "@modules/patient/domain/Sex";
import "./ImporterPage.css";

const MAX_CSV_SIZE = 10 * 1024 * 1024;
type CsvDownloadKind = "sample" | "current";

interface CsvDownloadFeedback {
  fileName: string;
  kind: CsvDownloadKind;
  opened: boolean;
  patientCount?: number;
}

const SAMPLE_CSV = `nombre,apellido,segundo apellido,fecha de nacimiento,sexo,correo,teléfono,whatsapp,ocupación,notas
María,García,López,1990-05-15,femenino,maria.garcia@example.com,+52 55 1234 5678,true,Ingeniera,Paciente referida por Dr. Pérez
Juan,Pérez,,1985-03-20,masculino,juan.perez@example.com,+52 55 8765 4321,false,Profesor,
Ana,López,Hernández,1992-11-08,F,ana.lopez@example.com,+52 33 1234 5678,true,Estudiante,Sin observaciones`;

export function ImporterPage() {
  const { t } = useTranslation();
  const [csv, setCsv] = React.useState("");
  const [preview, setPreview] = React.useState<ImporterPreview | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(
    null,
  );
  const [downloading, setDownloading] = React.useState<CsvDownloadKind | null>(
    null,
  );
  const [downloadFeedback, setDownloadFeedback] =
    React.useState<CsvDownloadFeedback | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const clearImport = () => {
    setPreview(null);
    setCsv("");
    setSelectedFileName(null);
  };

  const handleFile = async (file: File) => {
    const isCsv =
      file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      toast.error(t("pages.importer_invalid_file"));
      return;
    }
    if (file.size > MAX_CSV_SIZE) {
      toast.error(t("pages.importer_file_too_large"));
      return;
    }

    setParsing(true);
    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      setCsv(text);
      setPreview(patientImporterService.preview(text));
    } catch (error) {
      toast.error(t("pages.importer_file_read_error"), {
        description: error instanceof Error ? error.message : String(error),
      });
      setPreview(null);
    } finally {
      setParsing(false);
    }
  };

  const handlePreview = () => {
    if (!csv.trim()) return;
    setParsing(true);
    try {
      setPreview(patientImporterService.preview(csv));
    } catch (error) {
      toast.error(t("pages.importer_parse_error"), {
        description: error instanceof Error ? error.message : String(error),
      });
      setPreview(null);
    } finally {
      setParsing(false);
    }
  };

  const handleApply = async () => {
    setShowConfirm(false);
    setApplying(true);
    try {
      const result = await patientImporterService.apply(csv);
      if (result.failed.length === 0) {
        toast.success(
          t("pages.importer_imported_success", { count: result.imported }),
        );
      } else {
        toast.warning(
          t("pages.importer_imported_warning", {
            imported: result.imported,
            failed: result.failed.length,
          }),
          {
            description: result.failed
              .slice(0, 3)
              .map((failure) =>
                t("pages.importer_failed_row", {
                  row: failure.rowNumber,
                  errors: failure.errors.join(", "),
                }),
              )
              .join("\n"),
          },
        );
      }
      clearImport();
    } catch (error) {
      toast.error(t("pages.importer_import_error_short"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setApplying(false);
    }
  };

  const downloadCsv = async (kind: CsvDownloadKind) => {
    const previewWindow = prepareCsvPreviewWindow();
    setDownloading(kind);
    try {
      let content = SAMPLE_CSV;
      let fileName = "plantilla-ejemplo-pacientes.csv";
      let patientCount: number | undefined;

      if (kind === "current") {
        const rows = currentPatientRowsForBranch(
          await db.patients.toArray(),
          getActiveSucursalId(),
        );
        patientCount = rows.length;
        content = patientRowsToCsv(rows);
        fileName = `pacientes-actuales-${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const result = await downloadAndOpenCsv(content, fileName, previewWindow);
      setDownloadFeedback({
        fileName,
        kind,
        opened: result.opened,
        patientCount,
      });
      toast.success(
        t(
          kind === "sample"
            ? "pages.importer_sample_downloaded"
            : "pages.importer_patients_downloaded",
          { count: patientCount },
        ),
        { description: fileName },
      );
    } catch (error) {
      closeCsvPreviewWindow(previewWindow);
      toast.error(t("pages.importer_download_error"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const currentStep = showConfirm || applying ? 3 : preview ? 2 : 1;

  return (
    <>
      <PageContent className="nc-importer-page">
        <ImporterHero />
        <ImporterSteps currentStep={currentStep} />

        <div className="nc-importer-workspace">
          <Card className="nc-importer-card nc-importer-uploadCard">
            <ImporterCardHeader
              icon={CloudUpload}
              title={t("pages.importer_step_upload")}
              description={t("pages.importer_upload_description")}
            />
            <CardContent className="nc-importer-uploadContent">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="sr-only"
              />

              <div
                className="nc-importer-dropzone"
                data-dragging={dragging || undefined}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  ) {
                    setDragging(false);
                  }
                }}
                onDrop={handleDrop}
              >
                <span className="nc-importer-dropzone__icon" aria-hidden="true">
                  <CloudUpload />
                </span>
                <strong>{t("pages.importer_drop_title")}</strong>
                <p>{t("pages.importer_formats")}</p>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                  className="nc-importer-selectButton"
                >
                  <Upload aria-hidden="true" />
                  {parsing
                    ? t("pages.importer_processing")
                    : t("pages.importer_select_csv")}
                </Button>
              </div>

              {selectedFileName && (
                <div className="nc-importer-selectedFile" role="status">
                  <FileCheck2 aria-hidden="true" />
                  <span>
                    {t("pages.importer_selected_file")}:{" "}
                    <strong>{selectedFileName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={clearImport}
                    aria-label={t("common.clear")}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              )}

              <label className="nc-importer-divider" htmlFor="csv-paste">
                <span>{t("pages.importer_paste_csv")}</span>
              </label>
              <textarea
                id="csv-paste"
                className="nc-importer-textarea"
                placeholder={t("pages.importer_csv_placeholder")}
                value={csv}
                onChange={(event) => {
                  setCsv(event.target.value);
                  setPreview(null);
                  setSelectedFileName(null);
                }}
              />

              <div className="nc-importer-actions">
                <Button
                  type="button"
                  onClick={handlePreview}
                  variant="outline"
                  disabled={!csv.trim() || parsing}
                >
                  <FileText aria-hidden="true" />
                  {t("pages.importer_analyze")}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={downloading !== null}
                    >
                      <Download aria-hidden="true" />
                      {downloading
                        ? t("pages.importer_preparing_download")
                        : t("pages.importer_download_csv")}
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="nc-importer-downloadMenu"
                  >
                    <DropdownMenuItem
                      onSelect={() => void downloadCsv("sample")}
                    >
                      <FileSpreadsheet aria-hidden="true" />
                      <span>
                        <strong>{t("pages.importer_sample_template")}</strong>
                        <small>
                          {t("pages.importer_sample_template_description")}
                        </small>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void downloadCsv("current")}
                    >
                      <UsersRound aria-hidden="true" />
                      <span>
                        <strong>{t("pages.importer_current_patients")}</strong>
                        <small>
                          {t("pages.importer_current_patients_description")}
                        </small>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {downloadFeedback && (
                <p
                  className="nc-importer-downloadStatus"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 aria-hidden="true" />
                  <span>
                    {t(
                      downloadFeedback.kind === "sample"
                        ? "pages.importer_sample_downloaded"
                        : "pages.importer_patients_downloaded",
                      { count: downloadFeedback.patientCount },
                    )}
                    : <strong>{downloadFeedback.fileName}</strong>.{" "}
                    {t(
                      downloadFeedback.opened
                        ? "pages.importer_file_opened"
                        : "pages.importer_preview_blocked",
                    )}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>

          <PreviewPanel
            preview={preview}
            applying={applying}
            onApply={() => setShowConfirm(true)}
            onClear={clearImport}
          />
        </div>
      </PageContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.importer_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("pages.importer_confirm_description", {
                count: preview?.valid.length ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={applying}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying
                ? t("pages.importer_importing")
                : t("pages.importer_import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImporterHero() {
  const { t } = useTranslation();
  return (
    <section className="nc-importer-hero" aria-labelledby="importer-title">
      <span className="nc-importer-hero__icon" aria-hidden="true">
        <FileText />
        <small>CSV</small>
      </span>
      <div>
        <h1 id="importer-title">{t("pages.importer_patients_title")}</h1>
        <p>{t("pages.importer_description")}</p>
      </div>
    </section>
  );
}

function ImporterSteps({ currentStep }: { currentStep: number }) {
  const { t } = useTranslation();
  const steps = [
    t("pages.importer_step_upload"),
    t("pages.importer_step_preview"),
    t("pages.importer_step_confirm"),
  ];
  return (
    <ol className="nc-importer-steps" aria-label={t("pages.importer_progress")}>
      {steps.map((step, index) => {
        const number = index + 1;
        return (
          <li
            key={step}
            data-current={number === currentStep || undefined}
            data-complete={number < currentStep || undefined}
          >
            <span>{number < currentStep ? <CheckCircle2 /> : number}</span>
            <strong>{step.replace(/^\d+\.\s*/, "")}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function ImporterCardHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="nc-importer-cardHeader space-y-0">
      <span className="nc-importer-cardHeader__icon" aria-hidden="true">
        <Icon />
      </span>
      <div>
        <CardTitle className="nc-importer-cardTitle">{title}</CardTitle>
        <CardDescription className="nc-importer-cardDescription">
          {description}
        </CardDescription>
      </div>
    </CardHeader>
  );
}

function PreviewPanel({
  preview,
  applying,
  onApply,
  onClear,
}: {
  preview: ImporterPreview | null;
  applying: boolean;
  onApply: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();

  if (!preview) {
    return (
      <Card className="nc-importer-card nc-importer-previewCard">
        <ImporterCardHeader
          icon={Eye}
          title={t("pages.importer_step_preview")}
          description={t("pages.importer_preview_description")}
        />
        <CardContent className="nc-importer-emptyPreview">
          <div className="nc-importer-emptyPreview__body">
            <span aria-hidden="true">
              <FileSpreadsheet />
            </span>
            <h2>{t("pages.importer_empty_title")}</h2>
            <p>{t("pages.importer_empty_description")}</p>
          </div>
          <div className="nc-importer-infoBox">
            <Info aria-hidden="true" />
            <p>{t("pages.importer_preview_info")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (preview.missingRequiredColumns.length > 0) {
    return (
      <Card className="nc-importer-card nc-importer-previewCard">
        <ImporterCardHeader
          icon={Eye}
          title={t("pages.importer_step_preview")}
          description={t("pages.importer_preview_description")}
        />
        <CardContent className="nc-importer-errorState">
          <span aria-hidden="true">
            <AlertTriangle />
          </span>
          <h2>{t("pages.importer_missing_columns")}</h2>
          <p>
            {t("pages.importer_missing_columns_description", {
              columns: preview.missingRequiredColumns.join(", "),
            })}
          </p>
          <small>{t("pages.importer_required_columns")}</small>
          <Button variant="outline" onClick={onClear}>
            {t("common.clear")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="nc-importer-card nc-importer-previewCard">
      <CardHeader className="nc-importer-previewHeader space-y-0">
        <div className="nc-importer-previewHeader__title">
          <span className="nc-importer-cardHeader__icon" aria-hidden="true">
            <Eye />
          </span>
          <div>
            <CardTitle className="nc-importer-cardTitle">
              {t("pages.importer_step_preview")}
            </CardTitle>
            <CardDescription className="nc-importer-cardDescription">
              {t("pages.importer_total_rows", { count: preview.totalRows })}
            </CardDescription>
          </div>
        </div>
        <div className="nc-importer-previewHeader__badges">
          <Badge variant="default">
            <CheckCircle2 aria-hidden="true" />
            {t("pages.importer_valid_rows", { count: preview.valid.length })}
          </Badge>
          {preview.invalid.length > 0 && (
            <Badge variant="destructive">
              <X aria-hidden="true" />
              {t("pages.importer_invalid_rows", {
                count: preview.invalid.length,
              })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="nc-importer-previewContent">
        {applying ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {preview.invalid.length > 0 && (
              <details className="nc-importer-invalidRows">
                <summary>
                  {t("pages.importer_view_invalid_rows", {
                    count: preview.invalid.length,
                  })}
                </summary>
                <ul>
                  {preview.invalid.map((row) => (
                    <li key={row.rowNumber}>
                      {t("pages.importer_row_error", {
                        row: row.rowNumber,
                        errors: row.errors.join("; "),
                      })}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {preview.valid.length > 0 ? (
              <div className="nc-importer-previewTable">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>
                        {t("pages.importer_birth_date_short")}
                      </TableHead>
                      <TableHead>{t("patient.sex")}</TableHead>
                      <TableHead>{t("patient.email")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.slice(0, 50).map((row) => (
                      <RowPreview key={row.rowNumber} row={row} />
                    ))}
                  </TableBody>
                </Table>
                {preview.valid.length > 50 && (
                  <p>
                    {t("pages.importer_showing_first_rows", {
                      count: preview.valid.length,
                    })}
                  </p>
                )}
              </div>
            ) : (
              <p className="nc-importer-noRows">
                {t("pages.importer_no_valid_rows")}
              </p>
            )}

            <div className="nc-importer-previewActions">
              <Button
                onClick={onApply}
                disabled={preview.valid.length === 0 || applying}
              >
                <CheckCircle2 aria-hidden="true" />
                {t("pages.importer_import_patients", {
                  count: preview.valid.length,
                })}
              </Button>
              <Button variant="outline" onClick={onClear} disabled={applying}>
                {t("common.clear")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RowPreview({ row }: { row: MappedRow }) {
  if (!row.mapped) return null;
  const sex = row.mapped.sex?.toLowerCase().trim() ?? "";
  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground">
        {row.rowNumber}
      </TableCell>
      <TableCell className="font-medium">
        {row.mapped.firstName} {row.mapped.lastName}{" "}
        {row.mapped.secondLastName ?? ""}
      </TableCell>
      <TableCell>{row.mapped.birthDate}</TableCell>
      <TableCell className="text-xs">
        {SexLabel[sex as keyof typeof SexLabel] ?? sex}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.mapped.email ?? "—"}
      </TableCell>
    </TableRow>
  );
}
