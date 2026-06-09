import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { DocumentFormSchema, type DocumentFormInput } from "../application/documentFormSchema";
import { DocumentTypeLabel } from "../domain/DocumentTypes";
import { ScrollArea } from "@components/ui/scroll-area";

interface DocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DocumentFormInput) => Promise<void>;
}

export function DocumentDialog({ open, onOpenChange, onSubmit }: DocumentDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const form = useForm<DocumentFormInput>({
    resolver: zodResolver(DocumentFormSchema),
    defaultValues: {
      title: "",
      type: "clinical_report",
      contentHtml: "",
      patientId: undefined,
      consultationId: undefined,
      parameters: "{}",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ title: "", type: "clinical_report", contentHtml: "", patientId: undefined, consultationId: undefined, parameters: "{}" });
      setShowPreview(false);
    }
  }, [open, form]);

  const handleSubmit = async (data: DocumentFormInput) => {
    setSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Crear documento</DialogTitle>
          <DialogDescription>
            Genera un nuevo documento clínico para el paciente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" {...form.register("title")} />
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DocumentTypeLabel).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contentHtml">Contenido (HTML)</Label>
            <Textarea id="contentHtml" rows={6} {...form.register("contentHtml")} />
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? "Ocultar vista previa" : "Vista previa"}
          </Button>

          {showPreview && (
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: form.watch("contentHtml") || "<p class='text-muted-foreground'>Sin contenido</p>" }}
              />
            </ScrollArea>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Crear documento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
