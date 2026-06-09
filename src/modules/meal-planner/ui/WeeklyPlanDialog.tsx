import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { MealPlannerFormSchema, type MealPlannerFormInput } from "../application/mealPlannerFormSchema";

interface WeeklyPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MealPlannerFormInput) => Promise<void>;
}

export function WeeklyPlanDialog({ open, onOpenChange, onSubmit }: WeeklyPlanDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<MealPlannerFormInput>({
    resolver: zodResolver(MealPlannerFormSchema),
    defaultValues: {
      patientId: "",
      name: "",
      type: "weekly",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      targetKcal: 0,
      targetProteinPct: 20,
      targetFatPct: 25,
      targetCarbPct: 55,
      targetFiberG: 25,
      timesPerDay: 5,
      restrictions: [],
      days: [],
      professionalId: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        patientId: "",
        name: "",
        type: "weekly",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        targetKcal: 0,
        targetProteinPct: 20,
        targetFatPct: 25,
        targetCarbPct: 55,
        targetFiberG: 25,
        timesPerDay: 5,
        restrictions: [],
        days: [],
        professionalId: "",
      });
    }
  }, [open, form]);

  const handleSubmit = async (data: MealPlannerFormInput) => {
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Nuevo plan de alimentación</DialogTitle>
          <DialogDescription>
            Crea un plan semanal de alimentación para el paciente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del plan</Label>
            <Input id="name" {...form.register("name")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timesPerDay">Comidas por día</Label>
              <Input id="timesPerDay" type="number" min={3} max={6} {...form.register("timesPerDay", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input id="startDate" type="date" {...form.register("startDate")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">Fecha fin</Label>
              <Input id="endDate" type="date" {...form.register("endDate")} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="targetKcal">Kcal</Label>
              <Input id="targetKcal" type="number" min={0} {...form.register("targetKcal", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetProteinPct">Proteína %</Label>
              <Input id="targetProteinPct" type="number" min={0} max={100} {...form.register("targetProteinPct", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetFatPct">Grasa %</Label>
              <Input id="targetFatPct" type="number" min={0} max={100} {...form.register("targetFatPct", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetCarbPct">Carboh. %</Label>
              <Input id="targetCarbPct" type="number" min={0} max={100} {...form.register("targetCarbPct", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="targetFiberG">Fibra (g)</Label>
            <Input id="targetFiberG" type="number" min={0} {...form.register("targetFiberG", { valueAsNumber: true })} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" rows={2} placeholder="Notas del plan..." {...form.register("days.0.notes")} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando..." : "Crear plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
