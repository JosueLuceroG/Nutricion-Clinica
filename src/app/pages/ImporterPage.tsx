import * as React from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, FileUp, Download, X } from "lucide-react";
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
      toast.error("Error al leer el archivo", {
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
      toast.error("Error al analizar CSV", {
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
        toast.success(`${result.imported} pacientes importados`);
      } else {
        toast.warning(`${result.imported} importados, ${result.failed.length} con error`, {
          description: result.failed.slice(0, 3).map((f) => `Fila ${f.rowNumber}: ${f.errors.join(", ")}`).join("\n"),
        });
      }
      setPreview(null);
      setCsv("");
    } catch (err) {
      toast.error("Error al importar", {
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
        title="Importar pacientes desde CSV"
        description="Carga pacientes desde un archivo CSV. RN-IMP-01: requiere confirmación antes de aplicar."
      />
      <PageContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                1. Cargar archivo
              </CardTitle>
              <CardDescription>
                Acepta archivos .csv con encabezados. Los nombres de columna pueden estar en español o inglés.
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
                {parsing ? "Procesando..." : "Seleccionar archivo CSV"}
              </Button>
              <div className="space-y-2">
                <Label htmlFor="csv-paste">O pega el contenido CSV directamente</Label>
                <textarea
                  id="csv-paste"
                  className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="nombre,apellido,fecha de nacimiento,sexo..."
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handlePreview} variant="outline" disabled={!csv.trim() || parsing} className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Analizar
                </Button>
                <Button onClick={downloadSample} variant="ghost">
                  <Download className="mr-2 h-4 w-4" />
                  Plantilla
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
            <DialogTitle>Confirmar importación</DialogTitle>
            <DialogDescription>
              Se importarán {preview?.valid.length ?? 0} pacientes. Las filas con errores no se importarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={applying}>
              Cancelar
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? "Importando..." : "Importar"}
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
  if (!preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            2. Vista previa
          </CardTitle>
          <CardDescription>
            Carga un archivo o pega CSV para ver la vista previa de la importación.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          La vista previa muestra qué filas son válidas y cuáles tienen errores, sin persistir.
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
            Columnas faltantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            El CSV no contiene las columnas obligatorias: <strong>{preview.missingRequiredColumns.join(", ")}</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Columnas obligatorias: nombre, apellido, fecha de nacimiento, sexo.
          </p>
          <Button variant="outline" onClick={onClear}>Limpiar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          2. Vista previa
        </CardTitle>
        <CardDescription className="space-x-3">
          <Badge variant="default">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {preview.valid.length} válidas
          </Badge>
          {preview.invalid.length > 0 && (
            <Badge variant="destructive">
              <X className="mr-1 h-3 w-3" />
              {preview.invalid.length} con errores
            </Badge>
          )}
          <span className="text-xs">de {preview.totalRows} filas</span>
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
                  Ver {preview.invalid.length} filas con errores
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {preview.invalid.map((r) => (
                    <li key={r.rowNumber}>
                      Fila {r.rowNumber}: {r.errors.join("; ")}
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
                      <TableHead>Nombre</TableHead>
                      <TableHead>Fecha nac.</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Correo</TableHead>
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
                    Mostrando primeras 50 filas de {preview.valid.length}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay filas válidas para importar.</p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={onApply}
                disabled={preview.valid.length === 0 || applying}
                className="flex-1"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Importar {preview.valid.length} pacientes
              </Button>
              <Button variant="outline" onClick={onClear} disabled={applying}>Limpiar</Button>
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
