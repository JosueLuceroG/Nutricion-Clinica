/**
 * Formulario (Dialog) para alta y edición de alimentos personalizados.
 * Usa react-hook-form + zodResolver sobre SmaeCustomFoodFormSchema.
 */
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  SmaeCustomFoodFormSchema,
  type SmaeCustomFoodFormInput,
} from "@modules/smae/application/smaeFormSchema";
import {
  FOOD_GROUPS,
  FoodGroupLabel,
  type Food,
} from "@modules/smae/domain";
import { useAddCustomFood, useUpdateCustomFood } from "./useSmaeHooks";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";

interface SmaeFoodFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialFood?: Food;
  onSaved?: (food: Food) => void;
}

export function SmaeFoodForm({
  open,
  onOpenChange,
  mode,
  initialFood,
  onSaved,
}: SmaeFoodFormProps) {
  const { add, loading: adding } = useAddCustomFood();
  const { update, loading: updating } = useUpdateCustomFood();
  const submitting = adding || updating;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SmaeCustomFoodFormInput>({
    resolver: zodResolver(SmaeCustomFoodFormSchema),
    defaultValues: {
      id: "",
      group: "verduras",
      name: "",
      shortName: "",
      serving: "",
      servingGrams: 0,
      keywordsInput: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      if (mode === "edit" && initialFood) {
        reset({
          id: initialFood.id,
          group: initialFood.group,
          name: initialFood.name,
          shortName: initialFood.shortName,
          serving: initialFood.serving,
          servingGrams: initialFood.servingGrams,
          keywordsInput: initialFood.keywords.join(", "),
        });
      } else {
        reset({
          id: "",
          group: "verduras",
          name: "",
          shortName: "",
          serving: "",
          servingGrams: 0,
          keywordsInput: "",
        });
      }
    }
  }, [open, mode, initialFood, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const keywords = (values.keywordsInput ?? "")
      .split(",")
      .map((s) => s.toLowerCase().trim())
      .filter(Boolean);

    if (mode === "create") {
      const food = await add({
        id: values.id,
        group: values.group,
        name: values.name,
        shortName: values.shortName,
        serving: values.serving,
        servingGrams: values.servingGrams,
        keywords,
      });
      if (food) {
        toast.success(`Alimento "${food.name}" agregado`);
        onSaved?.(food);
        onOpenChange(false);
      } else {
        toast.error("No se pudo agregar el alimento");
      }
    } else if (initialFood) {
      const food = await update(initialFood.id, {
        group: values.group,
        name: values.name,
        shortName: values.shortName,
        serving: values.serving,
        servingGrams: values.servingGrams,
        keywords,
      });
      if (food) {
        toast.success(`Alimento "${food.name}" actualizado`);
        onSaved?.(food);
        onOpenChange(false);
      } else {
        toast.error("No se pudo actualizar el alimento");
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo alimento personalizado" : "Editar alimento"}
          </DialogTitle>
          <DialogDescription>
            Los valores nutrimentales se derivan del grupo SMAE seleccionado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="id">ID (slug)</Label>
            <Input
              id="id"
              placeholder="ej. verdura-quelites"
              disabled={mode === "edit"}
              {...register("id")}
            />
            {errors.id && <p className="text-xs text-destructive">{errors.id.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="group">Grupo SMAE</Label>
            <Select value={watch("group")} onValueChange={(v) => setValue("group", v as never)}>
              <SelectTrigger id="group"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOOD_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>{FoodGroupLabel[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.group && <p className="text-xs text-destructive">{errors.group.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" placeholder="Quelites" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="shortName">Nombre corto</Label>
              <Input id="shortName" placeholder="Quelites" {...register("shortName")} />
              {errors.shortName && (
                <p className="text-xs text-destructive">{errors.shortName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="serving">Ración</Label>
              <Input id="serving" placeholder="1 taza" {...register("serving")} />
              {errors.serving && (
                <p className="text-xs text-destructive">{errors.serving.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="servingGrams">Gramos por ración</Label>
              <Input
                id="servingGrams"
                type="number"
                step="0.1"
                min="0"
                placeholder="100"
                {...register("servingGrams", { valueAsNumber: true })}
              />
              {errors.servingGrams && (
                <p className="text-xs text-destructive">{errors.servingGrams.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="keywordsInput">Palabras clave (separadas por coma)</Label>
            <Input
              id="keywordsInput"
              placeholder="mexicano, hoja, hierro"
              {...register("keywordsInput")}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting || isSubmitting}
            >
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button type="submit" disabled={submitting || isSubmitting}>
              <Save className="mr-1 h-4 w-4" />
              {mode === "create" ? "Agregar" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
