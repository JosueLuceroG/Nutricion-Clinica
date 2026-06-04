import * as React from "react";
import { Download, Upload, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { backupService } from "@services/backup/backupService";

type PasswordMode = "export" | "import" | null;

export function SettingsPage() {
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [passwordMode, setPasswordMode] = React.useState<PasswordMode>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const doExport = async (pwd: string | undefined) => {
    setExporting(true);
    try {
      const result = await backupService.exportBackup(pwd);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Respaldo exportado (${(result.sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (err) {
      toast.error("Error al exportar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExporting(false);
    }
  };

  const doImport = async (file: File, pwd: string | undefined) => {
    setImporting(true);
    try {
      const result = await backupService.importBackup(file, pwd);
      if (result.success) {
        toast.success(`Respaldo restaurado: ${result.rowCount} registros en ${result.tablesImported.length} tablas`);
      } else {
        toast.error("Errores al importar", {
          description: result.errors.join("\n"),
        });
      }
    } catch (err) {
      toast.error("Error al importar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onExportClick = (encrypt: boolean) => {
    if (encrypt) {
      setPasswordMode("export");
      setPassword("");
      setPasswordDialogOpen(true);
    } else {
      void doExport(undefined);
    }
  };

  const onPasswordSubmit = () => {
    if (!password.trim()) {
      toast.error("Debes ingresar una contraseña");
      return;
    }
    setPasswordDialogOpen(false);
    if (passwordMode === "export") {
      void doExport(password);
    } else if (passwordMode === "import" && pendingFile) {
      setConfirmDialogOpen(true);
    }
    setPasswordMode(null);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (file.name.endsWith(".enc")) {
      setPasswordMode("import");
      setPassword("");
      setPasswordDialogOpen(true);
    } else {
      setConfirmDialogOpen(true);
    }
  };

  const onConfirmImport = () => {
    setConfirmDialogOpen(false);
    if (pendingFile) {
      void doImport(pendingFile, fileIsEncrypted(pendingFile) ? password || undefined : undefined);
    }
    setPendingFile(null);
    setPassword("");
  };

  return (
    <>
      <PageHeader title="Configuración" description="Ajustes generales de la aplicación" />
      <PageContent>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Respaldo de datos
              </CardTitle>
              <CardDescription>
                Exporta toda la base de datos a un archivo JSON. Puedes cifrarlo con contraseña.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => onExportClick(false)} disabled={exporting} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                {exporting ? "Exportando..." : "Exportar respaldo (sin cifrar)"}
              </Button>
              <Button onClick={() => onExportClick(true)} disabled={exporting} variant="outline" className="w-full">
                <Lock className="mr-2 h-4 w-4" />
                {exporting ? "Exportando..." : "Exportar respaldo cifrado"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Restaurar respaldo
              </CardTitle>
              <CardDescription>
                Importa un archivo de respaldo (.json o .enc). Los datos actuales serán reemplazados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backup-password">Contraseña (solo si el archivo está cifrado)</Label>
                <Input
                  id="backup-password"
                  type="password"
                  placeholder="Dejar vacío si no está cifrado"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.enc"
                onChange={onImportFile}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importando..." : "Seleccionar archivo y restaurar"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Preferencias
              </CardTitle>
              <CardDescription>
                Tema, idioma, formato de fecha, zona horaria, unidades.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Configuración respaldada en Zustand persist. Pendiente de UI.
            </CardContent>
          </Card>
        </div>
      </PageContent>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {passwordMode === "export" ? "Cifrar respaldo" : "Restaurar respaldo cifrado"}
            </DialogTitle>
            <DialogDescription>
              Ingresa la contraseña para {passwordMode === "export" ? "cifrar el archivo" : "desbloquear el archivo"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dialog-password">Contraseña</Label>
            <Input
              id="dialog-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordDialogOpen(false); setPassword(""); setPendingFile(null); }}>
              Cancelar
            </Button>
            <Button onClick={onPasswordSubmit}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reemplazar datos actuales</DialogTitle>
            <DialogDescription>
              Esto reemplazará todos los datos actuales con los del archivo de respaldo. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onConfirmImport}>Continuar y reemplazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function fileIsEncrypted(file: File): boolean {
  return file.name.endsWith(".enc");
}
