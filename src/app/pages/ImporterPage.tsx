import * as React from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, FileUp, Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Label } from "@components/ui/label";
import { Badge } from "@components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
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
import { patientImporterService, type ImporterPreview, type MappedRow } from "@services/importer";
import { SexLabel } from "@modules/patient/domain/Sex";

const SAMPLE_CSV = `nombre,apellido,segundo apellido,fecha de nacimiento,sexo,correo,teléfono,ocupación,notas
María,García,López,1990-05-15,femenino,maria.garcia@example.com,+52 55 1234 5678,Ingeniera,Paciente referida por Dr. Pérez
Juan,Pérez,,1985-03-20,masculino,juan.perez@example.com,+52 55 8765 4321,Profesor,
Ana,López,Hernández,1992-11-08,F,juan.perez@example.com,+52 33 1234 5678,Estudiante,Sin observaciones`;

export function ImporterPage() {
  const { t } = useTranslation();
  const [csv, setCsv] = React.useState("");
  const [preview, setPreview] = React.useState<ImporterPreview | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const text = await file.text();
      setCsv(text);
      const result = patientImporterService.preview(text);
      setPreview(result);
    } catch (err) {
      toast.error(t("pages.importer_file_read_error"), {
        description: err instanceof Error ? err.message : String(err),
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
      const result = patientImporterService.preview(csv);
      setPreview(result);
    } catch (err) {
      toast.error(t("pages.importer_parse_error"), {
        description: err instanceof Error ? err.message : String(err),
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
        toast.success(t("pages.importer_imported_success", { count: result.imported }));
      } else {
        toast.warning(t("pages.importer_imported_warning", { imported: result.imported, failed: result.failed.length }), {
          description: result.failed.slice(0, 3).map((f) => t("pages.importer_failed_row", { row: f.rowNumber, errors: f.errors.join(", ") })).join("\n"),
        });
      }
      setPreview(null);
      setCsv("");
    } catch (err) {
      toast.error(t("pages.importer_import_error_short"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setApplying(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-pacientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={t("pages.importer_patients_title")}
        description={t("pages.importer_description")}
      />
      <PageContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                {t("pages.importer_step_upload")}
              </CardTitle>
              <CardDescription>
                {t("pages.importer_upload_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} className="w-full" disabled={parsing}>
                <Upload className="mr-2 h-4 w-4" />
                {parsing ? t("pages.importer_processing") : t("pages.importer_select_csv")}
              </Button>
              <div className="space-y-2">
                <Label htmlFor="csv-paste">{t("pages.importer_paste_csv")}</Label>
                <textarea
                  id="csv-paste"
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={t("pages.importer_csv_placeholder")}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handlePreview} variant="outline" disabled={!csv.trim() || parsing} className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  {t("pages.importer_analyze")}
                </Button>
                <Button onClick={downloadSample} variant="ghost">
                  <Download className="mr-2 h-4 w-4" />
                  {t("pages.importer_template")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <PreviewPanel
            preview={preview}
            applying={applying}
            onApply={() => setShowConfirm(true)}
            onClear={() => { setPreview(null); setCsv(""); }}
          />
        </div>
      </PageContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pages.importer_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("pages.importer_confirm_description", { count: preview?.valid.length ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={applying}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? t("pages.importer_importing") : t("pages.importer_import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("pages.importer_step_preview")}
          </CardTitle>
          <CardDescription>
            {t("pages.importer_preview_description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("pages.importer_preview_body")}
        </CardContent>
      </Card>
    );
  }

  if (preview.missingRequiredColumns.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("pages.importer_missing_columns")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            {t("pages.importer_missing_columns_description", { columns: preview.missingRequiredColumns.join(", ") })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("pages.importer_required_columns")}
          </p>
          <Button variant="outline" onClick={onClear}>{t("common.clear")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t("pages.importer_step_preview")}
        </CardTitle>
        <CardDescription className="space-x-3">
          <Badge variant="default">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t("pages.importer_valid_rows", { count: preview.valid.length })}
          </Badge>
          {preview.invalid.length > 0 && (
            <Badge variant="destructive">
              <X className="mr-1 h-3 w-3" />
              {t("pages.importer_invalid_rows", { count: preview.invalid.length })}
            </Badge>
          )}
          <span className="text-xs">{t("pages.importer_total_rows", { count: preview.totalRows })}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {applying ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {preview.invalid.length > 0 && (
              <details className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-destructive">
                  {t("pages.importer_view_invalid_rows", { count: preview.invalid.length })}
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {preview.invalid.map((r) => (
                    <li key={r.rowNumber}>
                      {t("pages.importer_row_error", { row: r.rowNumber, errors: r.errors.join("; ") })}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.valid.length > 0 ? (
              <div className="max-h-80 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>{t("pages.importer_birth_date_short")}</TableHead>
                      <TableHead>{t("patient.sex")}</TableHead>
                      <TableHead>{t("patient.email")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.valid.slice(0, 50).map((r) => (
                      <RowPreview key={r.rowNumber} row={r} />
                    ))}
                  </TableBody>
                </Table>
                {preview.valid.length > 50 && (
                  <p className="border-t p-2 text-center text-xs text-muted-foreground">
                    {t("pages.importer_showing_first_rows", { count: preview.valid.length })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("pages.importer_no_valid_rows")}</p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={onApply}
                disabled={preview.valid.length === 0 || applying}
                className="flex-1"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t("pages.importer_import_patients", { count: preview.valid.length })}
              </Button>
              <Button variant="outline" onClick={onClear} disabled={applying}>{t("common.clear")}</Button>
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
      <TableCell className="text-xs text-muted-foreground">{row.rowNumber}</TableCell>
      <TableCell className="font-medium">
        {row.mapped.firstName} {row.mapped.lastName} {row.mapped.secondLastName ?? ""}
      </TableCell>
      <TableCell>{row.mapped.birthDate}</TableCell>
      <TableCell className="text-xs">{SexLabel[sex as keyof typeof SexLabel] ?? sex}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{row.mapped.email ?? "—"}</TableCell>
    </TableRow>
  );
}
