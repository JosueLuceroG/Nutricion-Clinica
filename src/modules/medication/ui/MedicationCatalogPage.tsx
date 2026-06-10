import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Badge } from "@components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { MedicationCatalogFormSchema, type MedicationCatalogFormInput } from "../application/medicationFormSchema";
import { MEDICATION_ROUTES, MedicationRouteLabel } from "../domain/MedicationCatalogTypes";
import { useMedicationCatalog, useCreateMedication, useDeleteMedication } from "./useMedicationHooks";
import { Search, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MedicationCatalog } from "../domain/MedicationCatalog";

export function MedicationCatalogPage() {
  const { t } = useTranslation();
  const { medications, loading, refresh } = useMedicationCatalog();
  const { create, loading: creating } = useCreateMedication();
  const { loading: deleting, confirmId, requestDelete, confirmDelete, cancelDelete } = useDeleteMedication();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingMedication, setEditingMedication] = React.useState<MedicationCatalog | null>(null);

  const filtered = React.useMemo(
    () => medications.filter(
      (m) =>
        m.nombre_comercial.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.principio_activo.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
    [medications, searchQuery],
  );

  const form = useForm<MedicationCatalogFormInput>({
    resolver: zodResolver(MedicationCatalogFormSchema),
    defaultValues: {
      nombre_comercial: "",
      principio_activo: "",
      presentacion: "",
      concentracion: "",
      via_administracion: "oral",
      categoria_farmacologica: "",
      efectos_secundarios: "",
      contraindicaciones: "",
      notas: "",
    },
  });

  const openCreate = () => {
    setEditingMedication(null);
    form.reset();
    setDialogOpen(true);
  };

  const openEdit = (med: MedicationCatalog) => {
    setEditingMedication(med);
    form.reset({
      nombre_comercial: med.nombre_comercial,
      principio_activo: med.principio_activo,
      presentacion: med.presentacion,
      concentracion: med.concentracion,
      via_administracion: med.via_administracion,
      categoria_farmacologica: med.categoria_farmacologica,
      efectos_secundarios: med.efectos_secundarios.join("\n"),
      contraindicaciones: med.contraindicaciones.join("\n"),
      notas: med.notas,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (data: MedicationCatalogFormInput) => {
    const input: MedicationCatalogFormInput = {
      ...data,
      categoria_farmacologica: data.categoria_farmacologica ?? "",
      efectos_secundarios: data.efectos_secundarios ?? "",
      contraindicaciones: data.contraindicaciones ?? "",
      notas: data.notas ?? "",
    };
    await create(input);
    setDialogOpen(false);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("medication.catalog_title")}</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> {t("medication.add")}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("medication.search_by_name")}
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">{t("medication.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("medication.not_found")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((med) => (
            <Card key={med.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium">{med.nombre_comercial}</CardTitle>
                    <p className="text-xs text-muted-foreground">{med.principio_activo}</p>
                  </div>
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {MedicationRouteLabel[med.via_administracion]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="mb-2 space-y-1 text-xs text-muted-foreground">
                  <p><span className="font-medium">{t("medication.presentation_label")}:</span> {med.presentacion}</p>
                  <p><span className="font-medium">{t("medication.concentration")}:</span> {med.concentracion}</p>
                  <p><span className="font-medium">{t("medication.category")}:</span> {med.categoria_farmacologica}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(med)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => requestDelete(med.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {med.efectos_secundarios.length > 0 && (
                    <Badge variant="secondary" className="h-5 gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />
                      {t("medication.effects_count", { count: med.efectos_secundarios.length })}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMedication ? t("medication.edit_title") : t("medication.new_title")}</DialogTitle>
            <DialogDescription>{t("medication.dialog_description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nombre_comercial">{t("medication.commercial_name")}</Label>
              <Input id="nombre_comercial" {...form.register("nombre_comercial")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="principio_activo">{t("medication.active_ingredient")}</Label>
              <Input id="principio_activo" {...form.register("principio_activo")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="presentacion">{t("medication.presentation_label")}</Label>
                <Input id="presentacion" {...form.register("presentacion")} placeholder={t("medication.presentation_placeholder")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="concentracion">{t("medication.concentration")}</Label>
                <Input id="concentracion" {...form.register("concentracion")} placeholder={t("medication.concentration_placeholder")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("medication.column_route")}</Label>
              <Select value={form.watch("via_administracion")} onValueChange={(v) => form.setValue("via_administracion", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDICATION_ROUTES.map((r) => (<SelectItem key={r} value={r}>{t(`medication.route_${r}`, { defaultValue: MedicationRouteLabel[r] })}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoria_farmacologica">{t("medication.pharmacological_category")}</Label>
              <Input id="categoria_farmacologica" {...form.register("categoria_farmacologica")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="efectos_secundarios">{t("medication.side_effects_per_line")}</Label>
              <Textarea id="efectos_secundarios" rows={3} {...form.register("efectos_secundarios")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contraindicaciones">{t("medication.contraindications_per_line")}</Label>
              <Textarea id="contraindicaciones" rows={3} {...form.register("contraindicaciones")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notas">{t("common.notes")}</Label>
              <Textarea id="notas" rows={2} {...form.register("notas")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={creating}>
                {creating ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmId} onOpenChange={(open) => { if (!open) cancelDelete(); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("medication.confirm_delete_title")}</DialogTitle>
            <DialogDescription>
              {t("medication.confirm_delete_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelDelete}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? t("medication.deleting") : t("common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
